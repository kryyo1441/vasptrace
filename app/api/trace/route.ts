import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isTraceInputError, parseTraceInput, runTrace } from "@/lib/trace";

export async function POST(req: NextRequest) {
  // proxy.ts already turns away unauthenticated requests, but per Next's
  // own guidance (see proxy.ts's comment), re-check here rather than trust
  // the matcher covered this route.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = parseTraceInput(body);
  if (isTraceInputError(input)) {
    return NextResponse.json({ error: input.error }, { status: input.status });
  }

  try {
    const result = await runTrace(input, user.id);
    return NextResponse.json({ ...result.graph, caseId: result.caseId, warnings: result.warnings });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
