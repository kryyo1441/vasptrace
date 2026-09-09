"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { GraphView } from "@/components/graph-view";
import { TYPOLOGY_LABEL } from "@/lib/typology";
import { vaspLine } from "@/lib/format";
import type { TraceGraph, TypologyFlag } from "@/lib/tracers/types";
import { AlertTriangle, ArrowRight, Loader2, Network, Search, Shield, Wallet } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const ADDRESS_PLACEHOLDER: Record<string, string> = {
  ETHEREUM: "0x… wallet address",
  BITCOIN: "1…/3…/bc1… wallet address",
  TRON: "T… wallet address",
};

export default function Home() {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState("ETHEREUM");
  const [maxDepth, setMaxDepth] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [graph, setGraph] = useState<TraceGraph | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);

  const typologyFlags: TypologyFlag[] = graph
    ? Array.from(new Set(graph.nodes.flatMap((n) => n.typologyFlags)))
    : [];
  const hasResult = loading || graph !== null;

  async function runTrace() {
    setLoading(true);
    setError(null);
    setGraph(null);
    try {
      const res = await fetch("/api/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim(), chain, maxDepth }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Trace failed");
      setGraph(data);
      setCaseId(data.caseId ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8 lg:px-10 xl:px-16">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link
          href="/cases"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          Case dashboard
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <ThemeToggle />
      </div>

      {/* Search-engine landing hero: centered mark, one dominant input, the
          rest of the app (results, empty state) lives below it — reads as a
          search landing page until a trace runs, then as a results page. */}
      <div
        className={
          hasResult
            ? "flex flex-col items-center gap-5 pt-2 pb-2"
            : "flex flex-col items-center gap-6 pt-16 pb-6 sm:pt-24"
        }
      >
        <div className="flex items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <Shield className="size-7" aria-hidden="true" />
          </div>
        </div>
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">VASPtrace</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Trace a suspect wallet to the nearest legally-actionable exchange — live on Ethereum, Bitcoin, and Tron.
          </p>
        </div>

        <Card className="w-full max-w-4xl">
          <CardContent className="flex flex-col gap-3 pt-1">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                aria-label="Wallet address"
                placeholder={ADDRESS_PLACEHOLDER[chain]}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && address && !loading) runTrace();
                }}
                className="h-14 rounded-xl pr-4 pl-11 font-mono text-base shadow-sm"
              />
            </div>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Select value={chain} onValueChange={(v) => v && setChain(v)}>
                  <SelectTrigger aria-label="Blockchain" size="sm" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ETHEREUM">Ethereum</SelectItem>
                    <SelectItem value="BITCOIN">Bitcoin</SelectItem>
                    <SelectItem value="TRON">Tron</SelectItem>
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Max depth
                  <Input
                    aria-label="Max trace depth"
                    type="number"
                    min={1}
                    max={10}
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(Number(e.target.value))}
                    className="h-8 w-16"
                  />
                </label>
              </div>
              <Button onClick={runTrace} disabled={!address || loading} size="lg" className="gap-2">
                {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Wallet className="size-4" aria-hidden="true" />}
                {loading ? "Tracing…" : "Run trace"}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      </div>

      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Tracing on-chain hops — this can take a few seconds per hop…
          </CardContent>
        </Card>
      )}

      {graph && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Network className="size-4 text-muted-foreground" aria-hidden="true" />
                Trace result — {graph.nodes.length} addresses, {graph.edges.length} transfers
              </CardTitle>
              {caseId && (
                <Link
                  href={`/cases/${caseId}`}
                  className="mt-1 inline-flex items-center gap-1 text-xs text-foreground underline-offset-4 hover:underline"
                >
                  Open case, generate report, route disclosure request
                  <ArrowRight className="size-3" />
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {typologyFlags.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <AlertTriangle className="size-3.5" />
                  Typology flags (rule-based heuristics):
                </span>
                {typologyFlags.map((f) => (
                  <Badge key={f} variant="secondary">
                    {TYPOLOGY_LABEL[f]}
                  </Badge>
                ))}
              </div>
            )}
            {graph.warnings.length > 0 && (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 backdrop-blur-xl dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <div className="flex flex-col gap-0.5">
                  {graph.warnings.map((w, i) => (
                    <div key={i}>{w}</div>
                  ))}
                </div>
              </div>
            )}
            <GraphView graph={graph} />
          </CardContent>
        </Card>
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
              {graph.recommendation.alternatives.length > 0 &&
                ` — ${graph.recommendation.top.vaspName} over ${graph.recommendation.alternatives[0].vaspName}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="font-medium text-foreground">{vaspLine(graph.recommendation.top)}</p>
            {graph.recommendation.alternatives.map((alt) => (
              <p key={alt.address} className="text-muted-foreground">
                {vaspLine(alt)}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
