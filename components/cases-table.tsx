"use client";

// Filtering happens in the browser over the rows the dashboard already
// fetched — no extra query, no round-trip per keystroke.
// ponytail: fine while a caseload is tens-to-hundreds of rows (98 at the time
// of writing); push search/filter into the Prisma query if it reaches
// thousands.
import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RISK_COLOR } from "@/lib/format";
import type { RiskLevel } from "@/lib/generated/prisma/client";
import { Search } from "lucide-react";

export type CaseRow = {
  id: string;
  address: string;
  chain: string;
  status: string;
  riskLevel: RiskLevel | null;
  vasp: string | null;
  // Preformatted on the server so the rendered string doesn't change when
  // this row is filtered client-side under a different locale.
  date: string;
};

const ALL = "ALL";

export function CasesTable({ rows }: { rows: CaseRow[] }) {
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState(ALL);
  const [chain, setChain] = useState(ALL);
  const [status, setStatus] = useState(ALL);

  const chains = useMemo(() => [...new Set(rows.map((r) => r.chain))].sort(), [rows]);
  const statuses = useMemo(() => [...new Set(rows.map((r) => r.status))].sort(), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (q === "" || r.address.toLowerCase().includes(q) || (r.vasp?.toLowerCase().includes(q) ?? false)) &&
        (risk === ALL || r.riskLevel === risk) &&
        (chain === ALL || r.chain === chain) &&
        (status === ALL || r.status === status)
    );
  }, [rows, query, risk, chain, status]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search address or VASP…"
            aria-label="Search cases by address or recommended VASP"
            className="pl-8"
          />
        </div>

        <Select value={risk} onValueChange={(v) => v && setRisk(v)}>
          <SelectTrigger aria-label="Filter by risk level" className="w-36">
            <SelectValue>{(v: string) => (v === ALL ? "All risk" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All risk</SelectItem>
            {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as RiskLevel[]).map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={chain} onValueChange={(v) => v && setChain(v)}>
          <SelectTrigger aria-label="Filter by chain" className="w-36">
            <SelectValue>{(v: string) => (v === ALL ? "All chains" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All chains</SelectItem>
            {chains.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(v) => v && setStatus(v)}>
          <SelectTrigger aria-label="Filter by status" className="w-36">
            <SelectValue>{(v: string) => (v === ALL ? "All statuses" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <p className="ml-auto shrink-0 text-xs text-muted-foreground" aria-live="polite">
          {filtered.length === rows.length
            ? `${rows.length} case${rows.length === 1 ? "" : "s"}`
            : `${filtered.length} of ${rows.length} cases`}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No cases match these filters.</p>
      ) : (
        // Bounded height so a long caseload scrolls inside the card instead of
        // stretching the whole page.
        <div className="max-h-[26rem] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {["Address", "Chain", "Status", "Risk", "Recommended VASP", "Date"].map((h) => (
                  // `bg-card` is translucent by design (glass surface), so rows
                  // would scroll visibly through a sticky header using it —
                  // `bg-background` is the only opaque surface token.
                  <th
                    key={h}
                    className="sticky top-0 z-10 border-b border-border bg-background py-2 pr-4 text-xs font-medium text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
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
                  <td className="py-2 pr-4">{c.vasp ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{c.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
