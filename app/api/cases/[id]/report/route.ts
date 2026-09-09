import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { CaseReportDocument } from "@/lib/pdf/report";
import { canAccessCase, getCurrentUser } from "@/lib/auth";
import type { TraceGraph } from "@/lib/tracers/types";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // proxy.ts already turns away requests with no session; this route
  // re-checks (Next's own proxy docs ask for it) and additionally
  // authorizes *this* case, not just proves a session exists — the report
  // carries the suspect address, chain, and evidence trail as a PDF.
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Not authenticated", { status: 401 });
  }

  const kase = await prisma.case.findUnique({ where: { id } });
  if (!kase || !canAccessCase(user, kase)) {
    return new Response("Case not found", { status: 404 });
  }
  if (!kase.traceResult) {
    return new Response("No trace data stored for this case", { status: 400 });
  }

  const graph = JSON.parse(kase.traceResult) as TraceGraph;
  const buffer = await renderToBuffer(CaseReportDocument({ kase, graph }));

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="vasptrace-case-${kase.id}.pdf"`,
    },
  });
}
