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
  kind: valueWei === "0" ? "CONTRACT_CALL" : "TRANSFER",
  txCount: 1,
  latestTxHash: "0xhash",
  latestTimestamp: 0,
  typologyFlags: [],
});

// Fan-out: one node splitting to FAN_OUT_MIN_DESTINATIONS (5) destinations.
{
  const dests = ["b", "c", "d", "e", "f"];
  const nodes = [node("a", 0), ...dests.map((d) => node(d, 1))];
  const edges = dests.map((d) => edge("a", d, "1"));
  applyTypologyFlags(nodes, edges);
  assert.deepEqual(nodes[0].typologyFlags, ["FAN_OUT"]);
  assert(edges.every((e) => e.typologyFlags.includes("FAN_OUT")));
}

// Below the threshold (3 destinations) -> not flagged. Old threshold was 3;
// raised to 5 because 3 mostly just detected bfs.ts's own FANOUT_CAP
// truncation, not real fan-out — see the comment on FAN_OUT_MIN_DESTINATIONS.
{
  const nodes = [node("a", 0), node("b", 1), node("c", 1), node("d", 1)];
  const edges = [edge("a", "b", "1"), edge("a", "c", "1"), edge("a", "d", "1")];
  applyTypologyFlags(nodes, edges);
  assert.deepEqual(nodes[0].typologyFlags, []);
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

// Token edges: a 10x ratio between wei and USDT base units is meaningless, so
// two legs in different assets are not a peel chain.
{
  const usdt = { symbol: "USDT", decimals: 6, contract: "0xusdt" };
  const nodes = [node("a", 0), node("b", 1), node("c", 1)];
  const edges = [edge("a", "b", "1000"), { ...edge("a", "c", "100"), asset: usdt }];
  applyTypologyFlags(nodes, edges);
  assert.deepEqual(nodes[0].typologyFlags, []);
}

// FAN_OUT counts destinations, not edges: paying 3 addresses in both ETH and
// USDT is 6 edges but still 3 destinations.
{
  const usdt = { symbol: "USDT", decimals: 6, contract: "0xusdt" };
  const dests = ["b", "c", "d"];
  const nodes = [node("a", 0), ...dests.map((d) => node(d, 1))];
  const edges = dests.flatMap((d) => [edge("a", d, "1"), { ...edge("a", d, "1"), asset: usdt }]);
  applyTypologyFlags(nodes, edges);
  assert.deepEqual(nodes[0].typologyFlags, []);
}

// Contract calls moved nothing, so they don't count toward fan-out: 4 real
// transfers + 3 zero-value calls is 4 destinations, not 7.
{
  const dests = ["b", "c", "d", "e", "f", "g", "h"];
  const nodes = [node("a", 0), ...dests.map((d) => node(d, 1))];
  const edges = dests.map((d, i) => edge("a", d, i < 4 ? "1" : "0"));
  applyTypologyFlags(nodes, edges);
  assert.deepEqual(nodes[0].typologyFlags, []);
}

console.log("typology self-check passed");
