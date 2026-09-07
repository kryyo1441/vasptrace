// SIMULATED (SIH plan item 9): Sahyog API access isn't publicly available.
// This builds the payload that WOULD be sent to a real disclosure-request
// endpoint and returns it for on-screen display — nothing is transmitted.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyN8n } from "@/lib/n8n";
import type { TraceGraph } from "@/lib/tracers/types";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kase = await prisma.case.findUnique({ where: { id } });
  if (!kase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }
  if (!kase.recommendedVaspId) {
    return NextResponse.json({ error: "This case has no recommended VASP to route to" }, { status: 400 });
  }

  const graph = kase.traceResult ? (JSON.parse(kase.traceResult) as TraceGraph) : null;
  const evidenceTrail = graph?.edges.slice(0, 10).map((e) => e.latestTxHash) ?? [];

  const simulatedPayload = {
    caseId: kase.id,
    requestType: "DISCLOSURE_REQUEST",
    suspectAddress: kase.address,
    chain: kase.chain,
    targetVasp: kase.recommendedVaspId,
    riskLevel: kase.riskLevel,
    legalBasis: "Section 91, Code of Criminal Procedure (India)",
    evidenceTrail,
    submittedAt: new Date().toISOString(),
  };

  const updated = await prisma.case.update({ where: { id }, data: { status: "ROUTED" } });

  // SIH plan item 6/9 — mirror the mock routing on n8n's canvas. Same
  // fire-and-forget contract as the trace webhook: never blocks or fails
  // the (already-simulated) routing that already happened above.
  const n8nWarning = await notifyN8n(process.env.N8N_SAHYOG_WEBHOOK_URL, simulatedPayload);

  return NextResponse.json({
    simulated: true,
    status: updated.status,
    payload: simulatedPayload,
    warning: n8nWarning,
  });
}
