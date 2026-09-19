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
import { GraphView, LinkedCasesSummary } from "@/components/graph-view";
import type { LinkedCases } from "@/lib/linking";
import { TYPOLOGY_LABEL } from "@/lib/typology";
import { CHAIN_LABEL, edgeCountLabel } from "@/lib/format";
import { ADDRESS_VALIDATORS, detectChains } from "@/lib/address";
import { isTxHash, type TxRecipient } from "@/lib/txresolve";
import { formatAssetValue } from "@/lib/format";
import type { Chain } from "@/lib/generated/prisma/client";
import type { TraceGraph, TypologyFlag } from "@/lib/tracers/types";
import { AlertTriangle, ArrowRight, Loader2, Network, Search, Shield, ShieldCheck, Wallet } from "lucide-react";
import { NetworkBackdrop } from "@/components/network-backdrop";

const CHAINS = ["Ethereum", "Polygon", "Arbitrum", "BNB Chain", "Bitcoin", "Tron", "Solana"];
const HOW_IT_WORKS = [
  { icon: Search, title: "Paste an address or tx hash", body: "Off the complaint — a hash resolves to who it paid." },
  { icon: Network, title: "Trace it hop by hop", body: "Live on-chain data, until it hits an exchange, mixer or sanctioned wallet." },
  { icon: ShieldCheck, title: "Get who to serve, and why", body: "Ranked by legal actionability, arithmetic shown, not a black box." },
];
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { VaspScoreGauge } from "@/components/vasp-score-gauge";
import { DesignationAlerts, IssuerLeads, UnregisteredExchanges, VaspRecLine } from "@/components/vasp-rec-line";

const ADDRESS_PLACEHOLDER: Record<string, string> = {
  ETHEREUM: "0x… wallet address",
  POLYGON: "0x… wallet address",
  ARBITRUM: "0x… wallet address",
  BSC: "0x… wallet address",
  BITCOIN: "1…/3…/bc1… wallet address",
  TRON: "T… wallet address",
  SOLANA: "Base58 wallet address (43–44 chars)",
};

export default function Home() {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState("ETHEREUM");
  const [maxDepth, setMaxDepth] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [graph, setGraph] = useState<TraceGraph | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [linked, setLinked] = useState<LinkedCases>({});
  // Live trace progress (2026-09-18) — the last line the NDJSON stream from
  // /api/trace sends before "done" is what this shows.
  const [progress, setProgress] = useState<{ nodesVisited: number; currentAddress: string } | null>(null);
  // Tx-hash intake (2026-09-18): a pasted hash resolves to one or more
  // recipient addresses before a trace ever runs. Populated when there's
  // more than one candidate and the investigator has to pick.
  const [txCandidates, setTxCandidates] = useState<{ chain: string; recipients: TxRecipient[] } | null>(null);
  const [resolving, setResolving] = useState(false);

  const typologyFlags: TypologyFlag[] = graph
    ? Array.from(new Set(graph.nodes.flatMap((n) => n.typologyFlags)))
    : [];
  const hasResult = loading || graph !== null;

  // Resolves a pasted tx hash to its recipient(s), then either runs the trace
  // straight away (exactly one candidate) or asks which one (several).
  async function resolveAndTrace(hash: string, traceChain: string) {
    setResolving(true);
    setError(null);
    try {
      const res = await fetch("/api/resolve-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash, chain: traceChain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not resolve transaction");
      const recipients = data.recipients as TxRecipient[];
      if (recipients.length === 1) {
        setAddress(recipients[0].address);
        setTxCandidates(null);
        await runTrace(recipients[0].address, traceChain);
      } else {
        setTxCandidates({ chain: traceChain, recipients });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setResolving(false);
    }
  }

  async function runTrace(overrideAddress?: string, overrideChain?: string) {
    setLoading(true);
    setError(null);
    setGraph(null);
    setTxCandidates(null);
    // The address formats name their chain family, so when the pasted address
    // is invalid for the selected chain and valid on exactly one other, just
    // switch and say so. A 0x address matches all three EVM chains — that
    // stays the API's "which one did you mean" error, since guessing would
    // trace the wrong chain.
    const trimmed = (overrideAddress ?? address).trim();
    const activeChain = overrideChain ?? chain;
    // A hash, not an address — resolve it to a recipient first. Checked
    // against every chain family's own hash shape, not just the selected
    // chain, so a mis-selected chain still gets steered toward resolution
    // rather than falling through to the "invalid address" trace error.
    if (!overrideAddress && isTxHash(trimmed, activeChain as Chain)) {
      return resolveAndTrace(trimmed, activeChain);
    }
    const detected = detectChains(trimmed);
    const traceChain =
      !ADDRESS_VALIDATORS[chain as Chain].test(trimmed) && detected.length === 1 ? detected[0] : chain;
    if (traceChain !== chain) setChain(traceChain);
    setNotice(
      traceChain !== chain
        ? `Switched the chain selector to ${CHAIN_LABEL[traceChain as Chain]} — this address is only valid there.`
        : null
    );
    setProgress(null);
    try {
      const res = await fetch("/api/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: trimmed, chain: overrideChain ?? traceChain, maxDepth }),
      });
      if (!res.ok) {
        // parseTraceInput rejected before the stream ever started (bad
        // address, bad chain, no session) — this is still a plain JSON body.
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Trace failed");
      }
      // NDJSON: progress lines until one "done" (or "error") line. A chunk
      // boundary can split a line in half, so buffer and only parse whole
      // lines — the same reason a naive `res.text().split("\n")` isn't safe.
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      while (!finished) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const msg = JSON.parse(line);
          if (msg.type === "progress") {
            setProgress({ nodesVisited: msg.nodesVisited, currentAddress: msg.currentAddress });
          } else if (msg.type === "done") {
            setGraph(msg);
            setCaseId(msg.caseId ?? null);
            setLinked(msg.linkedCases ?? {});
            finished = true;
          } else if (msg.type === "error") {
            throw new Error(msg.error);
          }
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setProgress(null);
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
        <UserMenu />
      </div>

      {/* Search-engine landing hero: centered mark, one dominant input, the
          rest of the app (results, empty state) lives below it — reads as a
          search landing page until a trace runs, then as a results page. */}
      <div
        className={
          hasResult
            ? "relative flex flex-col items-center gap-5 pt-2 pb-2"
            : "relative flex flex-col items-center gap-6 overflow-hidden pt-16 pb-6 sm:pt-24"
        }
      >
        {!hasResult && <NetworkBackdrop />}
        <div className="flex items-center gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <Shield className="size-7" aria-hidden="true" />
          </div>
        </div>
        <div className="text-center motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700 motion-safe:[animation-delay:75ms] motion-safe:fill-mode-both">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">VASPtrace</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Trace a suspect wallet to the nearest legally-actionable exchange.
          </p>
          {!hasResult && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1.5">
              {CHAINS.map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-border bg-card/60 px-2.5 py-0.5 text-[11px] text-muted-foreground backdrop-blur-xl"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">PS Number SIH26182 made by Team Async/Pray</p>
        </div>

        <Card className="w-full max-w-4xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700 motion-safe:[animation-delay:150ms] motion-safe:fill-mode-both">
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
                    <SelectItem value="POLYGON">Polygon</SelectItem>
                    <SelectItem value="ARBITRUM">Arbitrum</SelectItem>
                    <SelectItem value="BSC">BNB Chain</SelectItem>
                    <SelectItem value="BITCOIN">Bitcoin</SelectItem>
                    <SelectItem value="TRON">Tron</SelectItem>
                    <SelectItem value="SOLANA">Solana</SelectItem>
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
              <Button onClick={() => runTrace()} disabled={!address || loading || resolving} size="lg" className="gap-2">
                {loading || resolving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Wallet className="size-4" aria-hidden="true" />}
                {resolving ? "Resolving…" : loading ? "Tracing…" : "Run trace"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              A wallet address, or a transaction hash off the complaint — a hash resolves to who it paid first.
            </p>
            {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {txCandidates && (
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm">
                <p className="text-xs text-muted-foreground">
                  This transaction paid {txCandidates.recipients.length} addresses — pick the one to trace:
                </p>
                {txCandidates.recipients.map((r) => (
                  <Button
                    key={`${r.address}-${r.asset?.symbol ?? "native"}`}
                    variant="outline"
                    className="h-auto justify-between gap-3 py-2 font-mono text-xs"
                    onClick={() => runTrace(r.address, txCandidates.chain)}
                  >
                    <span className="wrap-anywhere text-left">{r.address}</span>
                    <span className="shrink-0 font-sans text-muted-foreground">
                      {formatAssetValue(r.valueBaseUnits, r.asset, txCandidates.chain as Chain)}
                    </span>
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fills the empty space below the search card on first visit —
            onboarding for a judge who's never seen this tool, not shown
            once a trace has run and the page has real content instead. */}
        {!hasResult && (
          <div className="grid w-full max-w-4xl grid-cols-1 gap-3 pt-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700 motion-safe:[animation-delay:225ms] motion-safe:fill-mode-both sm:grid-cols-3">
            {HOW_IT_WORKS.map(({ icon: Icon, title, body }, i) => (
              <div key={title} className="glass-panel flex flex-col gap-2 p-4">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" aria-hidden="true" />
                </div>
                <p className="text-sm font-medium">
                  {i + 1}. {title}
                </p>
                <p className="text-xs text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {progress ? (
              <span>
                Explored {progress.nodesVisited} address{progress.nodesVisited === 1 ? "" : "es"} — now checking{" "}
                <span className="font-mono">
                  {progress.currentAddress.slice(0, 8)}…{progress.currentAddress.slice(-6)}
                </span>
              </span>
            ) : (
              <span>Tracing on-chain hops — this can take a few seconds per hop…</span>
            )}
          </CardContent>
        </Card>
      )}

      {graph && (
        <Card className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Network className="size-4 text-muted-foreground" aria-hidden="true" />
                Trace result — {graph.nodes.length} addresses, {edgeCountLabel(graph)}
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
            <LinkedCasesSummary linked={linked} />
            <GraphView graph={graph} linked={linked} />
            <DesignationAlerts graph={graph} />
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
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <p>
              No registered VASP reached within {graph.maxDepth} hop{graph.maxDepth === 1 ? "" : "s"} — no disclosure
              request can be recommended for this trace.
            </p>
            <UnregisteredExchanges graph={graph} />
            <IssuerLeads graph={graph} />
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
