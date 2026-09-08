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
import { AlertTriangle, ArrowRight, Network, Shield, Wallet } from "lucide-react";

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
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Shield className="size-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">VASPtrace</h1>
            <p className="text-sm text-muted-foreground">
              Multi-chain wallet tracer — live on Ethereum, Bitcoin, and Tron.
            </p>
          </div>
        </div>
        <Link
          href="/cases"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          Case dashboard
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="size-4 text-muted-foreground" />
            New trace
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative w-full">
              <Wallet className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={ADDRESS_PLACEHOLDER[chain]}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="pl-8 font-mono"
              />
            </div>
            <Select value={chain} onValueChange={(v) => v && setChain(v)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ETHEREUM">Ethereum</SelectItem>
                <SelectItem value="BITCOIN">Bitcoin</SelectItem>
                <SelectItem value="TRON">Tron</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              max={10}
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
              className="w-full sm:w-24"
            />
          </div>
          <Button onClick={runTrace} disabled={!address || loading} className="w-fit">
            {loading ? "Tracing…" : "Run trace"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {graph && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Network className="size-4 text-muted-foreground" />
                Trace result — {graph.nodes.length} addresses, {graph.edges.length} transfers
              </CardTitle>
              {caseId && (
                <Link
                  href={`/cases/${caseId}`}
                  className="inline-flex items-center gap-1 text-xs text-foreground underline-offset-4 hover:underline"
                >
                  Open case, generate report, route disclosure request
                  <ArrowRight className="size-3" />
                </Link>
              )}
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" style={{ borderColor: "#dc2626", color: "#dc2626" }}>Suspect</Badge>
              <Badge variant="outline" style={{ borderColor: "#6b7280", color: "#6b7280" }}>Intermediary</Badge>
              <Badge variant="outline" style={{ borderColor: "#16a34a", color: "#16a34a" }}>Exchange</Badge>
              <Badge variant="outline" style={{ borderColor: "#ea580c", color: "#ea580c" }}>Mixer</Badge>
              <Badge variant="outline" style={{ borderColor: "#7f1d1d", color: "#7f1d1d" }}>Darknet/Ransomware</Badge>
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

      {graph?.recommendation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="size-4 text-muted-foreground" />
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
