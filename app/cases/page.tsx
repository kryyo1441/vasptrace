import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RankedBarChart, Sparkline } from "@/components/dashboard-charts";
import { SanctionsSyncButton } from "@/components/sanctions-sync-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { Bell, Coins, FolderOpen, Plus, Layers, Send, ShieldAlert, TrendingUp, type LucideIcon } from "lucide-react";
import { CHAIN_LABEL, formatBySymbol, RISK_COLOR } from "@/lib/format";
import { aggregateReceivedByVasp } from "@/lib/scoring";
import { TYPOLOGY_LABEL } from "@/lib/typology";
import type { RiskLevel, Chain } from "@/lib/generated/prisma/client";
import type { TypologyFlag } from "@/lib/tracers/types";

const RISK_ORDER: RiskLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
// Non-functional chart colors (the CSS custom properties in globals.css) —
// distinct from RISK_COLOR, which stays reserved for meaning.
const CHAIN_COLOR: Record<Chain, string> = {
  ETHEREUM: "var(--chart-2)",
  BITCOIN: "var(--chart-3)",
  TRON: "var(--chart-4)",
  POLYGON: "var(--chart-1)",
  ARBITRUM: "var(--chart-5)",
};

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

export default async function CasesPage() {
  // proxy.ts already turns away requests with no session, but per Next's
  // own proxy docs, re-check here rather than trust the matcher covered
  // this route — and RBAC needs the current user's role/id regardless.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [cases, vasps] = await Promise.all([
    prisma.case.findMany({
      // SUPERVISOR sees every case; INVESTIGATOR only their own. Same rule
      // as lib/auth.ts's canAccessCase, applied here as a query filter
      // instead of a post-fetch check since this is a list, not one case.
      where: user.role === "SUPERVISOR" ? {} : { createdById: user.id },
      orderBy: { createdAt: "desc" },
    }),
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

  // The confirmedByVaspResponse feedback loop (day-1 placeholder, wired up
  // 2026-09-14): per-VASP counts of routed requests that got a recorded
  // response, shown next to the seeded reliability score — never written
  // back into it, since one case's outcome shouldn't silently drift a
  // hand-verified figure.
  const responseCounts = new Map<string, { total: number; responded: number }>();

  for (const c of cases) {
    if (c.riskLevel) riskCounts.set(c.riskLevel, (riskCounts.get(c.riskLevel) ?? 0) + 1);
    chainCounts.set(c.chain, (chainCounts.get(c.chain) ?? 0) + 1);
    if (c.recommendedVaspId) {
      vaspCounts.set(c.recommendedVaspId, (vaspCounts.get(c.recommendedVaspId) ?? 0) + 1);
      if (c.status === "ROUTED") {
        const entry = responseCounts.get(c.recommendedVaspId) ?? { total: 0, responded: 0 };
        entry.total++;
        if (c.vaspResponse) entry.responded++;
        responseCounts.set(c.recommendedVaspId, entry);
      }
    }
    if (c.typologyFlags) {
      for (const f of JSON.parse(c.typologyFlags) as TypologyFlag[]) {
        flagCounts.set(f, (flagCounts.get(f) ?? 0) + 1);
      }
    }
  }

  const riskChartData = RISK_ORDER.map((r) => ({ label: r, count: riskCounts.get(r) ?? 0, fill: RISK_COLOR[r] }));
  const chainChartData = (Object.keys(CHAIN_LABEL) as Chain[]).map((c) => ({
    label: CHAIN_LABEL[c],
    count: chainCounts.get(c) ?? 0,
    fill: CHAIN_COLOR[c],
  }));
  const vaspChartData = [...vaspCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, n]) => ({ label: vaspName.get(id) ?? id, count: n, fill: "var(--chart-1)" }));
  const responseRows = [...responseCounts.entries()]
    .filter(([, r]) => r.total > 0)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([id, r]) => ({ name: vaspName.get(id) ?? id, ...r }));
  const flagChartData = [...flagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([f, n]) => ({ label: TYPOLOGY_LABEL[f], count: n, fill: "var(--chart-5)" }));

  // "How much money has gone to each wallet/VASP" — an actual investigator
  // question, answered across every stored case, not just this one trace.
  // Grouped by VASP + asset symbol, never blended into one dollar figure
  // (no live price feed here) — see aggregateReceivedByVasp's own comment.
  const inflowTotals = aggregateReceivedByVasp(cases);
  const inflowByVasp = new Map<string, typeof inflowTotals>();
  for (const t of inflowTotals) inflowByVasp.set(t.vaspName, [...(inflowByVasp.get(t.vaspName) ?? []), t]);

  // Last 14 days of trace volume, oldest first.
  const DAYS = 14;
  const dayData = Array.from({ length: DAYS }, (_, i) => {
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - (DAYS - 1 - i));
    const next = new Date(day);
    next.setUTCDate(next.getUTCDate() + 1);
    const count = cases.filter((c) => c.createdAt >= day && c.createdAt < next).length;
    return { day: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }), count };
  });

  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8 lg:px-10 xl:px-16">
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
        <div className="flex flex-wrap items-center gap-3">
          {user.role === "SUPERVISOR" && <SanctionsSyncButton />}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            <Plus className="size-4" aria-hidden="true" />
            New trace
          </Link>
          <Link
            href="/watches"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            <Bell className="size-4" aria-hidden="true" />
            Watchlist
          </Link>
          <ThemeToggle />
          <UserMenu />
        </div>
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

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Risk-level distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <RankedBarChart data={riskChartData} emptyMessage="No risk-scored cases yet." />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cases per chain</CardTitle>
              </CardHeader>
              <CardContent>
                <RankedBarChart data={chainChartData} emptyMessage="No cases yet." />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Most-recommended VASPs</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <RankedBarChart data={vaspChartData} emptyMessage="No recommendations yet." />
                {responseRows.length > 0 && (
                  <div className="flex flex-col gap-1 border-t border-border pt-2 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Observed response rate (routed requests)</p>
                    {responseRows.map((r) => (
                      <p key={r.name}>
                        {r.name}: {r.responded}/{r.total} responded
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Most-common typology flags</CardTitle>
              </CardHeader>
              <CardContent>
                <RankedBarChart data={flagChartData} emptyMessage="No flags raised yet." />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="size-4 text-muted-foreground" aria-hidden="true" />
                  Traces over time — last 14 days
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Sparkline data={dayData} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Coins className="size-4 text-muted-foreground" aria-hidden="true" />
                  Money into each VASP — all cases
                </CardTitle>
              </CardHeader>
              <CardContent>
                {inflowByVasp.size === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No confirmed value has reached a labeled exchange across any stored case yet.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {[...inflowByVasp.entries()].map(([vasp, totals]) => (
                      <div key={vasp} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
                        <span className="font-medium">{vasp}</span>
                        <span className="text-muted-foreground">
                          {totals.map((t) => formatBySymbol(t.totalBaseUnits, t.symbol)).join(" + ")}
                          {" · "}
                          {totals[0].caseCount} case{totals[0].caseCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  Sums confirmed-transfer edges into each labeled exchange across every stored case — never a
                  blended total (no live price feed), and excludes same-wallet inferences.
                </p>
              </CardContent>
            </Card>
          </div>
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
