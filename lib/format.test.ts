// Run: npx tsx lib/format.test.ts
import assert from "node:assert";
import { edgeAmountLabel, edgeCountLabel, evidenceTrail, hasValueTransfer, isContractCall } from "./format";
import type { TraceEdge, TraceGraph } from "./tracers/types";

const edge = (overrides: Partial<TraceEdge> = {}): TraceEdge => ({
  from: "0xaaa",
  to: "0xbbb",
  valueWei: "1000000000000000000", // 1 ETH
  kind: "TRANSFER",
  txCount: 1,
  latestTxHash: "0xhash",
  latestTimestamp: 0,
  typologyFlags: [],
  ...overrides,
});

// A transfer leads with its value.
{
  const label = edgeAmountLabel(edge(), "ETHEREUM");
  assert.equal(label, "1.0000 ETH · 1 tx");
  assert.equal(isContractCall(edge()), false);
}

// A contract call never shows a value — that was the whole bug. The headline
// demo's edge (92 zero-value calls into WazirX's multisig) used to render as
// "0.0000 ETH · 92 tx", which reads as a payment of nothing.
{
  const call = edge({ kind: "CONTRACT_CALL", valueWei: "0", txCount: 92 });
  const label = edgeAmountLabel(call, "ETHEREUM");
  assert.equal(isContractCall(call), true);
  assert.equal(label, "92 contract calls · no value moved");
  assert.ok(!label.includes("ETH"), "a contract-call label must not name a currency");
  assert.ok(!label.includes("0.0000"), "a contract-call label must not show an amount");
}

// Singular, because "1 contract calls" is the kind of thing a judge notices.
{
  assert.equal(
    edgeAmountLabel(edge({ kind: "CONTRACT_CALL", valueWei: "0", txCount: 1 }), "ETHEREUM"),
    "1 contract call · no value moved"
  );
}

// Cases traced before 2026-09-12 have no `kind` in their stored traceResult.
// They must keep rendering exactly as they did when they were generated —
// i.e. as transfers — so the predicate tests for CONTRACT_CALL, never for
// "not TRANSFER". Guards the `Case.traceResult` back-compat contract.
{
  const legacy = { from: "0xaaa", to: "0xbbb", valueWei: "500000000", txCount: 2 } as unknown as TraceEdge;
  assert.equal(isContractCall(legacy), false);
  assert.equal(edgeAmountLabel(legacy, "BITCOIN"), "5.0000 BTC · 2 tx");
}

// Per-chain base units still resolve off the chain, not the field name.
{
  assert.equal(edgeAmountLabel(edge({ valueWei: "100000000" }), "BITCOIN"), "1.0000 BTC · 1 tx");
  assert.equal(edgeAmountLabel(edge({ valueWei: "1000000" }), "TRON"), "1.0000 TRX · 1 tx");
}

// A dust transfer must not render as "0.0000 ETH". That string is what this
// whole change existed to remove, and on a TRANSFER edge there's no dashed
// line or legend key to explain it away — so it has to be distinguishable
// from nothing at all.
{
  for (const [wei, chain] of [["1", "ETHEREUM"], ["10000000000000", "ETHEREUM"], ["1", "BITCOIN"]] as const) {
    const label = edgeAmountLabel(edge({ valueWei: wei }), chain);
    assert.ok(!label.includes("0.0000"), `${wei} on ${chain} rendered as zero: ${label}`);
    assert.ok(label.startsWith("< 0.0001 "), `expected a dust label, got: ${label}`);
  }
}

// Exactly zero still reads "0.0000" — a pre-2026-09-12 stored case has no
// `kind`, renders as a TRANSFER, and must look as it did when generated.
{
  const legacyZero = { from: "a", to: "b", valueWei: "0", txCount: 3 } as unknown as TraceEdge;
  assert.equal(edgeAmountLabel(legacyZero, "ETHEREUM"), "0.0000 ETH · 3 tx");
}

// Above Number's 2^53 ceiling the 4-dp figure must still be exact — the old
// implementation divided a lossy Number.
{
  // 123456.789 ETH, well past 2^53 wei.
  assert.equal(
    edgeAmountLabel(edge({ valueWei: "123456789000000000000000" }), "ETHEREUM"),
    "123456.7890 ETH · 1 tx"
  );
  // 21,000,000 BTC in satoshis — more than exists.
  assert.equal(
    edgeAmountLabel(edge({ valueWei: "2100000000000000" }), "BITCOIN"),
    "21000000.0000 BTC · 1 tx"
  );
}

const graph = (edges: TraceEdge[]): TraceGraph => ({
  rootAddress: "0xaaa",
  chain: "ETHEREUM",
  maxDepth: 3,
  nodes: [],
  edges,
  warnings: [],
  recommendation: null,
});

const call = (hash: string) => edge({ kind: "CONTRACT_CALL", valueWei: "0", latestTxHash: hash });
const xfer = (hash: string) => edge({ kind: "TRANSFER", latestTxHash: hash });

// The evidence trail is quoted verbatim into a disclosure request. A
// contract-call hash in it must be marked, or the request implies funds
// arrived that never did.
{
  const trail = evidenceTrail(graph([call("0xcall1"), xfer("0xxfer1")]));
  assert.deepEqual(trail, ["0xxfer1", "0xcall1 (contract call — no value moved)"]);
}

// The headline-demo shape: calls only. Trail is non-empty (the calls are real
// evidence) but nothing in it may read as a transfer, and the draft must take
// its no-funds branch.
{
  const g = graph([call("0xa"), call("0xb")]);
  assert.equal(hasValueTransfer(g), false);
  for (const entry of evidenceTrail(g)) assert.ok(entry.includes("contract call"), entry);
}
{
  assert.equal(hasValueTransfer(graph([call("0xa"), xfer("0xb")])), true);
  assert.equal(hasValueTransfer(null), false);
  assert.deepEqual(evidenceTrail(null), []);
}

// Capped at 10, and transfers get the slots first — truncation must never
// drop a real transfer in favour of a contract call.
{
  const edges = [...Array(9)].map((_, i) => call(`0xc${i}`)).concat([...Array(4)].map((_, i) => xfer(`0xt${i}`)));
  const trail = evidenceTrail(graph(edges));
  assert.equal(trail.length, 10);
  assert.equal(trail.filter((h) => !h.includes("contract call")).length, 4);
}

// The "N transfers" line was untrue of a call edge on /, /cases/[id] and the PDF.
{
  assert.equal(edgeCountLabel(graph([xfer("0xa"), xfer("0xb")])), "2 transfers");
  assert.equal(edgeCountLabel(graph([call("0xa")])), "0 transfers, 1 contract-call link (no value)");
  assert.equal(
    edgeCountLabel(graph([xfer("0xa"), call("0xb"), call("0xc")])),
    "1 transfer, 2 contract-call links (no value)"
  );
}

console.log("format self-check passed");
