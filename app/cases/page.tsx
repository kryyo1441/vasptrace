import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Plus, Layers, Send, ShieldAlert, TrendingUp, type LucideIcon } from "lucide-react";
import { RISK_COLOR } from "@/lib/format";
import { TYPOLOGY_LABEL } from "@/lib/typology";
import type { RiskLevel, Chain } from "@/lib/generated/prisma/client";
import type { TypologyFlag } from "@/lib/tracers/types";

const RISK_ORDER: RiskLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const CHAIN_LABEL: Record<Chain, string> = { ETHEREUM: "Ethereum", BITCOIN: "Bitcoin", TRON: "Tron" };

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-start justify-between gap-3 pt-1">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4.5" />
        </div>
      </CardContent>
    </Card>
  );
}

// Horizontal bar list — no charting dependency needed for a handful of rows.
function BarRow({ label, count, max, color }: { label: string; count: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max((count / max) * 100, count > 0 ? 4 : 0) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 truncate text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color ?? "var(--primary)" }}
        />
      </div>
      <span className="w-6 shrink-0 text-right font-medium tabular-nums">{count}</span>
    </div>
  );
}

// Cheap inline SVG sparkline of cases/day — no charting dependency, and it
// makes an otherwise static dashboard look alive during a demo.
function Sparkline({ counts }: { counts: number[] }) {
  const max = Math.max(...counts, 1);
  const w = 240;
  const h = 40;
  const step = counts.length > 1 ? w / (counts.length - 1) : 0;
  const points = counts.map((c, i) => `${i * step},${h - (c / max) * (h - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full text-primary" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function CasesPage() {
  const [cases, vasps] = await Promise.all([
    prisma.case.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.vaspRegistry.findMany(),
  ]);
  const vaspName = new Map(vasps.map((v) => [v.id, v.name]));

  const total = cases.length;
  const routed = cases.filter((c) => c.status === "ROUTED").length;
  const highRiskCount = cases.filter((c) => c.riskLevel === "HIGH" || c.riskLevel === "CRITICAL").length;

  const riskCounts = new Map<RiskLevel, number>();
  const chainCounts = new Map<Chain, number>();
  const vaspCounts = new Map<string, number>();
  // ponytail: typologyFlags is a JSON string column, so this is an O(all
  // cases) parse on every dashboard load — fine at demo volume (tens to low
  // hundreds of rows); move to a denormalized count table if that changes.
  const flagCounts = new Map<TypologyFlag, number>();

  for (const c of cases) {
    if (c.riskLevel) riskCounts.set(c.riskLevel, (riskCounts.get(c.riskLevel) ?? 0) + 1);
    chainCounts.set(c.chain, (chainCounts.get(c.chain) ?? 0) + 1);
    if (c.recommendedVaspId) vaspCounts.set(c.recommendedVaspId, (vaspCounts.get(c.recommendedVaspId) ?? 0) + 1);
    if (c.typologyFlags) {
      for (const f of JSON.parse(c.typologyFlags) as TypologyFlag[]) {
        flagCounts.set(f, (flagCounts.get(f) ?? 0) + 1);
      }
    }
  }

  const topVasps = [...vaspCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topFlags = [...flagCounts.entries()].sort((a, b) => b[1] - a[1]);
  const maxVaspCount = Math.max(...topVasps.map(([, n]) => n), 1);
  const maxFlagCount = Math.max(...topFlags.map(([, n]) => n), 1);

  // Last 14 days of trace volume, oldest first.
  const DAYS = 14;
  const dayCounts = Array.from({ length: DAYS }, (_, i) => {
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - (DAYS - 1 - i));
    const next = new Date(day);
    next.setUTCDate(next.getUTCDate() + 1);
    return cases.filter((c) => c.createdAt >= day && c.createdAt < next).length;
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <FolderOpen className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Case dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {total} case{total === 1 ? "" : "s"} traced so far.
            </p>
          </div>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          <Plus className="size-4" aria-hidden="true" />
          New trace
        </Link>
      </div>

      {total === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No cases yet — run a trace from the home page to populate the dashboard.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile icon={FolderOpen} label="Cases traced" value={total} />
            <StatTile
              icon={Send}
              label="Disclosure requests routed"
              value={routed}
              sub={`of ${total} traced`}
            />
            <StatTile icon={ShieldAlert} label="High / critical risk" value={highRiskCount} />
            <StatTile icon={Layers} label="Chains covered" value={chainCounts.size} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Risk-level distribution</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5">
                {RISK_ORDER.map((r) => (
                  <BarRow key={r} label={r} count={riskCounts.get(r) ?? 0} max={total} color={RISK_COLOR[r]} />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cases per chain</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5">
                {(Object.keys(CHAIN_LABEL) as Chain[]).map((c) => (
                  <BarRow key={c} label={CHAIN_LABEL[c]} count={chainCounts.get(c) ?? 0} max={total} />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Most-recommended VASPs</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5">
                {topVasps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recommendations yet.</p>
                ) : (
                  topVasps.map(([id, n]) => (
                    <BarRow key={id} label={vaspName.get(id) ?? id} count={n} max={maxVaspCount} />
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Most-common typology flags</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5">
                {topFlags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No flags raised yet.</p>
                ) : (
                  topFlags.map(([f, n]) => (
                    <BarRow key={f} label={TYPOLOGY_LABEL[f]} count={n} max={maxFlagCount} />
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="size-4 text-muted-foreground" aria-hidden="true" />
                Traces over time — last 14 days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Sparkline counts={dayCounts} />
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cases</CardTitle>
        </CardHeader>
        <CardContent>
          {cases.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cases yet — run a trace from the home page.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Address</th>
                    <th className="py-2 pr-4 font-medium">Chain</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Risk</th>
                    <th className="py-2 pr-4 font-medium">Recommended VASP</th>
                    <th className="py-2 pr-4 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/50">
                      <td className="py-2 pr-4 font-mono">
                        <Link href={`/cases/${c.id}`} className="hover:underline">
                          {c.address}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">{c.chain}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="secondary">{c.status}</Badge>
                      </td>
                      <td className="py-2 pr-4">
                        {c.riskLevel ? (
                          <Badge
                            variant="outline"
                            style={{ borderColor: RISK_COLOR[c.riskLevel], color: RISK_COLOR[c.riskLevel] }}
                          >
                            {c.riskLevel}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {c.recommendedVaspId ? (
                          (vaspName.get(c.recommendedVaspId) ?? c.recommendedVaspId)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {c.createdAt.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
