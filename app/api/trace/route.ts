import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isTraceInputError, parseTraceInput, runTrace } from "@/lib/trace";
import { linkedCasesFor } from "@/lib/linking";

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

  // Streamed as newline-delimited JSON (added 2026-09-18) — PS 26182's
  // "real-time generation of investigative intelligence". A deep trace can
  // run 20-30s (docs/CASE_SCENARIOS.md); without this the UI just sat on a
  // spinner the whole time. Each line is `{"type":"progress",...}` until one
  // final `{"type":"done",...}` or `{"type":"error",...}` — the client reads
  // the stream and only the last line carries the graph, exactly what a
  // plain `await res.json()` used to return. See node_modules/next/dist/docs
  // /01-app/02-guides/streaming.md's "Streaming in Route Handlers" (Next 16
  // route-handler streaming is Web Streams API, same as any other runtime).
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const result = await runTrace(input, user.id, undefined, (p) => send({ type: "progress", ...p }));
        const linkedCases = await linkedCasesFor(result.graph, result.graph.chain, user, result.caseId);
        send({ type: "done", ...result.graph, caseId: result.caseId, warnings: result.warnings, linkedCases });
      } catch (err) {
        send({ type: "error", error: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "X-Content-Type-Options": "nosniff" },
  });
}
