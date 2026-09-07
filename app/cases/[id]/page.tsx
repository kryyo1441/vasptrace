import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GraphView } from "@/components/graph-view";
import { SahyogButton } from "@/components/sahyog-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TYPOLOGY_LABEL } from "@/lib/typology";
import { vaspLine } from "@/lib/format";
import type { TraceGraph } from "@/lib/tracers/types";

const RISK_COLOR: Record<string, string> = {
  LOW: "#16a34a",
  MEDIUM: "#ca8a04",
  HIGH: "#ea580c",
  CRITICAL: "#dc2626",
};

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kase = await prisma.case.findUnique({ where: { id } });
  if (!kase) notFound();

  const graph: TraceGraph | null = kase.traceResult ? JSON.parse(kase.traceResult) : null;
  const typologyFlags: string[] = kase.typologyFlags ? JSON.parse(kase.typologyFlags) : [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/cases" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
            ← Case dashboard
          </Link>
          <h1 className="mt-1 font-mono text-lg font-semibold break-all">{kase.address}</h1>
          <p className="text-sm text-muted-foreground">
            {kase.chain} · opened {kase.createdAt.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {kase.riskLevel && (
            <Badge variant="outline" style={{ borderColor: RISK_COLOR[kase.riskLevel], color: RISK_COLOR[kase.riskLevel] }}>
              {kase.riskLevel}
            </Badge>
          )}
          <Badge variant="secondary">{kase.status}</Badge>
          {graph && (
            <a
              href={`/api/cases/${kase.id}/report`}
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Download PDF report
            </a>
          )}
        </div>
      </div>

      {typologyFlags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Typology flags (rule-based heuristics):</span>
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
            <CardTitle className="text-base">
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

      {graph?.recommendation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recommended VASP for disclosure request</CardTitle>
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
