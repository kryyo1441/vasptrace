// Run: npx tsx lib/clustering.test.ts
import assert from "node:assert";
import { applyConfidenceClustering } from "./clustering";
import type { TraceEdge, TraceNode } from "./tracers/types";

const node = (address: string, overrides: Partial<TraceNode> = {}): TraceNode => ({
  address,
  depth: 1,
  kind: "INTERMEDIARY",
  confidence: null,
  stopReason: null,
  typologyFlags: [],
  ...overrides,
});

const edge = (from: string, to: string, valueWei: string): TraceEdge => ({
  from,
  to,
  valueWei,
  txCount: 1,
  latestTxHash: "0xtest",
  latestTimestamp: 0,
  typologyFlags: [],
});

// Medium: forwards 100% of outgoing value to a known (high-confidence) exchange.
{
  const exchange = node("0xexchange", { kind: "EXCHANGE", confidence: "high", entityName: "Binance 14" });
  const unlabeled = node("0xdeposit");
  const edges = [edge("0xdeposit", "0xexchange", "100")];
  applyConfidenceClustering([exchange, unlabeled], edges);
  assert.equal(unlabeled.confidence, "medium");
  assert.match(unlabeled.entityName!, /Binance 14/);
}

// Low: fan-in from 3+ distinct senders, then forwards onward, no exchange link.
{
  const hub = node("0xhub");
  const edges = [
    edge("0xa", "0xhub", "10"),
    edge("0xb", "0xhub", "10"),
    edge("0xc", "0xhub", "10"),
    edge("0xhub", "0xdest", "30"),
  ];
  applyConfidenceClustering([hub], edges);
  assert.equal(hub.confidence, "low");
}

// Below threshold: only 2 distinct senders — no fan-in guess.
{
  const hub = node("0xhub2");
  const edges = [edge("0xa", "0xhub2", "10"), edge("0xb", "0xhub2", "10"), edge("0xhub2", "0xdest", "20")];
  applyConfidenceClustering([hub], edges);
  assert.equal(hub.confidence, null);
}

// Existing high confidence is never overridden.
{
  const exchange = node("0xexchange2", { kind: "EXCHANGE", confidence: "high", entityName: "Coinbase 1" });
  const labeled = node("0xlabeled", { kind: "MIXER", confidence: "high", entityName: "Tornado Cash" });
  const edges = [edge("0xlabeled", "0xexchange2", "100")];
  applyConfidenceClustering([exchange, labeled], edges);
  assert.equal(labeled.confidence, "high");
  assert.equal(labeled.entityName, "Tornado Cash");
}

console.log("clustering self-check passed");
