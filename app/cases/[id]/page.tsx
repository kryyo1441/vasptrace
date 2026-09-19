import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canAccessCase, getCurrentUser } from "@/lib/auth";
import { audit, verifyAuditChain } from "@/lib/audit";
import { assetTotalsLabel, edgeCountLabel, evidenceTrail, hasValueTransfer } from "@/lib/format";
import { GraphView, LinkedCasesSummary } from "@/components/graph-view";
import { linkedCasesFor } from "@/lib/linking";
import { SahyogButton } from "@/components/sahyog-button";
import { ChainOfCustody } from "@/components/chain-of-custody";
import { VaspResponseForm } from "@/components/vasp-response-form";
import { CaseNarrative } from "@/components/case-narrative";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TYPOLOGY_LABEL } from "@/lib/typology";
import { RISK_COLOR } from "@/lib/format";
import type { TraceGraph } from "@/lib/tracers/types";
import { AlertTriangle, ArrowLeft, FileText, Network, Shield, Wallet } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { VaspScoreGauge } from "@/components/vasp-score-gauge";
import { DesignationAlerts, IssuerLeads, UnregisteredExchanges, VaspRecLine } from "@/components/vasp-rec-line";

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const kase = await prisma.case.findUnique({ where: { id } });
  // Same response (404) whether the case doesn't exist or belongs to a
  // different investigator — a distinct "yes this exists, you can't see
  // it" response would confirm a case id belongs to someone by its mere
  // existence, the same enumeration concern as the login route's identical
  // error for "no such user" vs. "wrong password".
  if (!kase || !canAccessCase(user, kase)) notFound();

  await audit(user.id, "VIEW_CASE", kase.id, {});

  // Chain of custody (ROADMAP: "who ran what, when, and what did the report
  // say at the time" — a credibility feature for a tool whose output is
  // meant to support legal process). Verified against the *whole* log's hash
  // chain, not just this case's rows, since a tampered row anywhere breaks
  // every hash after it.
  const [caseEvents, allEvents] = await Promise.all([
    prisma.auditEvent.findMany({ where: { caseId: kase.id }, orderBy: { createdAt: "asc" } }),
    prisma.auditEvent.findMany({ orderBy: { id: "asc" } }),
  ]);
  const tamperedAtId = verifyAuditChain(allEvents);

  const graph: TraceGraph | null = kase.traceResult ? JSON.parse(kase.traceResult) : null;
  const typologyFlags: string[] = kase.typologyFlags ? JSON.parse(kase.typologyFlags) : [];
  const linked = graph ? await linkedCasesFor(graph, kase.chain, user, kase.id) : {};

  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8 lg:px-10 xl:px-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/cases"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            <ArrowLeft className="size-3" aria-hidden="true" />
            Case dashboard
          </Link>
          <h1 className="mt-1 flex min-w-0 items-center gap-2 font-mono text-lg font-semibold break-all">
            <Wallet className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {kase.address}
          </h1>
          <p className="text-sm text-muted-foreground">
            {kase.chain} · opened {kase.createdAt.toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {kase.riskLevel && (
            <Badge variant="outline" style={{ borderColor: RISK_COLOR[kase.riskLevel], color: RISK_COLOR[kase.riskLevel] }}>
              {kase.riskLevel}
            </Badge>
          )}
          <Badge variant="secondary">{kase.status}</Badge>
          {graph && (
            <a
              href={`/api/cases/${kase.id}/report`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium backdrop-blur-xl hover:bg-accent"
            >
              <FileText className="size-4" aria-hidden="true" />
              Download PDF report
            </a>
          )}
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>

      {typologyFlags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <AlertTriangle className="size-3.5" />
            Typology flags (rule-based heuristics):
          </span>
          {typologyFlags.map((f) => (
            <Badge key={f} variant="secondary">
              {TYPOLOGY_LABEL[f as keyof typeof TYPOLOGY_LABEL] ?? f}
            </Badge>
          ))}
        </div>
      )}

      {graph ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Network className="size-4 text-muted-foreground" />
              Trace graph — {graph.nodes.length} addresses, {edgeCountLabel(graph)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LinkedCasesSummary linked={linked} />
            <GraphView graph={graph} linked={linked} />
            <DesignationAlerts graph={graph} />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">No trace data stored for this case.</p>
      )}

      {graph && !graph.recommendation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="size-4 text-muted-foreground" aria-hidden="true" />
              Recommended VASP for disclosure request
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No registered VASP reached within {graph.maxDepth} hop{graph.maxDepth === 1 ? "" : "s"} — no disclosure
            request can be recommended for this trace.
            <div className="mt-2 flex flex-col gap-3">
              <UnregisteredExchanges graph={graph} />
              <IssuerLeads graph={graph} />
            </div>
            {/* The trace's own warnings say *why* — e.g. a chain with no
                seeded labels (Arbitrum), or a truncated search — which is
                the difference between "clean" and "couldn't tell". */}
            {graph.warnings.length > 0 && (
              <ul className="mt-2 list-disc pl-5">
                {graph.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {graph?.recommendation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="size-4 text-muted-foreground" aria-hidden="true" />
              Recommended VASP for disclosure request
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <VaspScoreGauge rec={graph.recommendation.top} />
              <div className="flex flex-1 flex-col gap-2 text-sm">
                <VaspRecLine rec={graph.recommendation.top} primary />
                {graph.recommendation.alternatives.map((alt) => (
                  <VaspRecLine key={alt.address} rec={alt} />
                ))}
                <UnregisteredExchanges graph={graph} />
              </div>
            </div>
            <IssuerLeads graph={graph} />
            <SahyogButton
              caseId={kase.id}
              vaspName={graph.recommendation.top.vaspName}
              alreadyRouted={kase.status === "ROUTED"}
              address={kase.address}
              chain={kase.chain}
              // Same lib/format.ts builder the real (simulated) routed
              // payload uses, so the draft can't cite different evidence
              // than the request does.
              evidenceTrail={evidenceTrail(graph)}
              valueMoved={hasValueTransfer(graph)}
              attribution={
                graph.recommendation.top.sameWallet && {
                  address: graph.recommendation.top.address,
                  ...graph.recommendation.top.sameWallet,
                }
              }
              depositAddress={graph.recommendation.top.depositAddress}
              // Same derivation as the routed freeze payload
              // (app/api/cases/[id]/sahyog/route.ts).
              amountsAtStake={(() => {
                const credited = graph.nodes.find((n) => n.address === graph.recommendation!.top.address)?.receivedInTrace;
                return credited?.length ? assetTotalsLabel(credited, kase.chain) : undefined;
              })()}
            />
            {kase.status === "ROUTED" && (
              <VaspResponseForm
                caseId={kase.id}
                vaspName={graph.recommendation.top.vaspName}
                current={kase.vaspResponse}
              />
            )}
          </CardContent>
        </Card>
      )}

      <ChainOfCustody events={caseEvents} tamperedAtId={tamperedAtId} />

      {graph && (
        <CaseNarrative caseId={kase.id} hasNarrative={!!kase.narrativeDraft} initialText={kase.narrativeDraft} />
      )}
    </div>
  );
}
