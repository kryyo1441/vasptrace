import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GraphView } from "@/components/graph-view";
import { SahyogButton } from "@/components/sahyog-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TYPOLOGY_LABEL } from "@/lib/typology";
import { vaspLine, RISK_COLOR } from "@/lib/format";
import type { TraceGraph } from "@/lib/tracers/types";
import { AlertTriangle, ArrowLeft, FileText, Network, Shield, Wallet } from "lucide-react";

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kase = await prisma.case.findUnique({ where: { id } });
  if (!kase) notFound();

  const graph: TraceGraph | null = kase.traceResult ? JSON.parse(kase.traceResult) : null;
  const typologyFlags: string[] = kase.typologyFlags ? JSON.parse(kase.typologyFlags) : [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
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
              Trace graph — {graph.nodes.length} addresses, {graph.edges.length} transfers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GraphView graph={graph} />
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
            No labeled VASP reached within {graph.maxDepth} hop{graph.maxDepth === 1 ? "" : "s"} — no disclosure
            request can be recommended for this trace.
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
            <div className="flex flex-col gap-2 text-sm">
              <p className="font-medium text-foreground">{vaspLine(graph.recommendation.top)}</p>
              {graph.recommendation.alternatives.map((alt) => (
                <p key={alt.address} className="text-muted-foreground">
                  {vaspLine(alt)}
                </p>
              ))}
            </div>
            <SahyogButton
              caseId={kase.id}
              vaspName={graph.recommendation.top.vaspName}
              alreadyRouted={kase.status === "ROUTED"}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
