// Run: npx tsx lib/typology.test.ts
import assert from "node:assert";
import { applyTypologyFlags } from "./typology";
import type { TraceEdge, TraceNode } from "./tracers/types";

const node = (address: string, depth: number, kind: TraceNode["kind"] = "INTERMEDIARY"): TraceNode => ({
  address,
  depth,
  kind,
  confidence: null,
  stopReason: null,
  typologyFlags: [],
});

const edge = (from: string, to: string, valueWei: string): TraceEdge => ({
  from,
  to,
  valueWei,
  txCount: 1,
  latestTxHash: "0xhash",
  latestTimestamp: 0,
  typologyFlags: [],
});

// Fan-out: one node splitting to 3+ destinations.
{
  const nodes = [node("a", 0), node("b", 1), node("c", 1), node("d", 1)];
  const edges = [edge("a", "b", "1"), edge("a", "c", "1"), edge("a", "d", "1")];
  applyTypologyFlags(nodes, edges);
  assert.deepEqual(nodes[0].typologyFlags, ["FAN_OUT"]);
  assert(edges.every((e) => e.typologyFlags.includes("FAN_OUT")));
}

// Peel chain: 2 destinations, one leg >=4x the other.
{
  const nodes = [node("a", 0), node("b", 1), node("c", 1)];
  const edges = [edge("a", "b", "1000"), edge("a", "c", "100")]; // 10x
  applyTypologyFlags(nodes, edges);
  assert.deepEqual(nodes[0].typologyFlags, ["PEEL_CHAIN"]);
}

// 2 destinations but near-even split -> not a peel chain.
{
  const nodes = [node("a", 0), node("b", 1), node("c", 1)];
  const edges = [edge("a", "b", "100"), edge("a", "c", "80")];
  applyTypologyFlags(nodes, edges);
  assert.deepEqual(nodes[0].typologyFlags, []);
}

// Rapid mixer hop: mixer reached within the depth threshold.
{
  const nodes = [node("a", 0), node("mixer", 1, "MIXER")];
  const edges = [edge("a", "mixer", "1")];
  applyTypologyFlags(nodes, edges);
  assert.deepEqual(nodes[1].typologyFlags, ["RAPID_MIXER_HOP"]);
  assert.deepEqual(edges[0].typologyFlags, ["RAPID_MIXER_HOP"]);
}

// Mixer reached late (past the threshold) -> not flagged as "rapid".
{
  const nodes = [node("a", 0), node("mixer", 5, "MIXER")];
  const edges = [edge("a", "mixer", "1")];
  applyTypologyFlags(nodes, edges);
  assert.deepEqual(nodes[1].typologyFlags, []);
}

console.log("typology self-check passed");
