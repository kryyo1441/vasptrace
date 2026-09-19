// SIMULATED (SIH plan item 9): Sahyog API access isn't publicly available.
// This builds the payload that WOULD be sent to a real disclosure-request
// endpoint and returns it for on-screen display — nothing is transmitted.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyN8n } from "@/lib/n8n";
import {
  assetTotalsLabel,
  CROSS_BORDER_NOTE,
  evidenceTrail as buildEvidenceTrail,
  FREEZE_LEGAL_BASIS,
  FREEZE_LEGAL_CAVEAT,
  LEGAL_BASIS,
  type RequestKind,
} from "@/lib/format";
import { canAccessCase, getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { TraceGraph } from "@/lib/tracers/types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // proxy.ts gates login; this route re-checks and authorizes the specific
  // case, not just that a session exists — otherwise investigator A could
  // route a disclosure request on investigator B's case by guessing/
  // enumerating a cuid.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const kase = await prisma.case.findUnique({ where: { id } });
  if (!kase || !canAccessCase(user, kase)) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }
  if (!kase.recommendedVaspId) {
    return NextResponse.json({ error: "This case has no recommended VASP to route to" }, { status: 400 });
  }

  // Body is optional: an empty POST is a disclosure request, exactly as
  // before freeze requests existed (2026-09-18).
  const body = (await req.json().catch(() => null)) as { kind?: string } | null;
  const kind: RequestKind = body?.kind === "FREEZE" ? "FREEZE" : "DISCLOSURE";

  const graph = kase.traceResult ? (JSON.parse(kase.traceResult) as TraceGraph) : null;
  const evidenceTrail = buildEvidenceTrail(graph);
  const top = graph?.recommendation?.top;
  // What this trace saw credited to the recommended VASP's address — the
  // amount a freeze is about. Only what the trace observed, per asset, never
  // converted (no price feed in this app).
  const creditedNode = graph?.nodes.find((n) => n.address === top?.address);
  const amountsAtStake = creditedNode?.receivedInTrace?.length
    ? assetTotalsLabel(creditedNode.receivedInTrace, kase.chain)
    : null;

  const simulatedPayload = {
    caseId: kase.id,
    // A same-wallet inference (lib/scoring.ts) is not a confirmed label, so
    // the request must say so and ask the VASP to confirm ownership before
    // any disclosure — never assert the address is theirs.
    requestType: `${top?.sameWallet ? "OWNERSHIP_CONFIRMATION_AND_" : ""}${kind}_REQUEST`,
    suspectAddress: kase.address,
    chain: kase.chain,
    targetVasp: kase.recommendedVaspId,
    attribution: top?.sameWallet
      ? {
          basis: "SAME_WALLET_INFERENCE",
          method: "Common-input ownership",
          attributedAddress: top.address,
          knownVaspAddress: top.sameWallet.labeledAddress,
          evidenceTx: top.sameWallet.txHash,
          requestedAction: "CONFIRM_OWNERSHIP_BEFORE_DISCLOSURE",
        }
      : { basis: "EXACT_LABEL_MATCH", attributedAddress: top?.address ?? null },
    // The account selector: an exchange keys KYC on the deposit address it
    // assigned, not its hot wallet. Always marked as an inference.
    depositAddress: top?.depositAddress
      ? { ...top.depositAddress, basis: "INFERRED_FORWARDING_PATTERN" }
      : null,
    // How the request actually reaches this VASP — Sahyog for an FIU-IND
    // reporting entity, the exchange's own LE portal (or a BNSS s.112 Letter
    // of Request) for an offshore one.
    routingChannel: top?.channel
      ? { ...top.channel, ...(top.channel.crossBorder && { crossBorderNote: CROSS_BORDER_NOTE }) }
      : null,
    riskLevel: kase.riskLevel,
    legalBasis: kind === "FREEZE" ? FREEZE_LEGAL_BASIS : LEGAL_BASIS,
    ...(kind === "FREEZE" && {
      requestedAction: "IMMEDIATE_HOLD_PENDING_MAGISTRATE_ORDER",
      legalCaveat: FREEZE_LEGAL_CAVEAT,
      creditedInTrace: amountsAtStake,
      issuerFreezeLeads: graph?.issuerLeads ?? [],
    }),
    evidenceTrail,
    submittedAt: new Date().toISOString(),
  };

  const updated = await prisma.case.update({ where: { id }, data: { status: "ROUTED" } });

  // SIH plan item 6/9 — mirror the mock routing on n8n's canvas. Same
  // fire-and-forget contract as the trace webhook: never blocks or fails
  // the (already-simulated) routing that already happened above.
  const n8nWarning = await notifyN8n(process.env.N8N_SAHYOG_WEBHOOK_URL, simulatedPayload);

  await audit(user.id, kind === "FREEZE" ? "ROUTE_FREEZE" : "ROUTE_SAHYOG", kase.id, {
    targetVasp: kase.recommendedVaspId,
    requestType: simulatedPayload.requestType,
  });

  return NextResponse.json({
    simulated: true,
    status: updated.status,
    payload: simulatedPayload,
    warning: n8nWarning,
  });
}
