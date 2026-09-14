// Run: npx tsx lib/format.test.ts
import assert from "node:assert";
import {
  assetTotalsLabel,
  buildEmailDraft,
  edgeAmountLabel,
  edgeCountLabel,
  evidenceTrail,
  formatAssetValue,
  formatBySymbol,
  hasValueTransfer,
  isContractCall,
  LEGAL_BASIS,
  lowActionabilityNote,
  sameWalletEvidence,
  sumValuesByAsset,
  vaspLine,
} from "./format";
import type { TraceEdge, TraceGraph, VaspRecommendation } from "./tracers/types";

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

// A token edge is labelled in its own asset's units, not the chain's — the
// same 1,411.608923 USDT read against TRX's 6 decimals happens to coincide,
// but against ETH's 18 it would print dust. And an edge with no `asset` (every
// case stored before token tracing) still reads as the native currency.
{
  const usdt = { symbol: "USDT", decimals: 6, contract: "0xdac17f958d2ee523a2206206994597c13d831ec7" };
  assert.equal(edgeAmountLabel(edge({ valueWei: "1411608923", asset: usdt }), "ETHEREUM"), "1411.6089 USDT · 1 tx");
  assert.equal(edgeAmountLabel(edge({ valueWei: "1411608923", asset: usdt }), "TRON"), "1411.6089 USDT · 1 tx");
  const legacy = { from: "T1", to: "T2", valueWei: "1000000", txCount: 1 } as unknown as TraceEdge;
  assert.equal(edgeAmountLabel(legacy, "TRON"), "1.0000 TRX · 1 tx");
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

// A same-wallet recommendation names its basis on every line that shows it,
// and the evidence sentence cites the exact address and tx.
{
  const rec: VaspRecommendation = {
    address: "3root",
    entityName: "Binance (cold wallet) — same wallet",
    vaspName: "Binance",
    breakdown: { hopDistance: 0, fiuindRegistered: true, hasIndiaNodalOfficer: false, responseReliabilityScore: 2, score: 5 },
    sameWallet: { labeledAddress: "3binance", txHash: "tx1" },
  };
  assert.match(vaspLine(rec), /score 5 · same-wallet inference — confirm ownership$/);
  assert.doesNotMatch(vaspLine({ ...rec, sameWallet: undefined }), /inference/);
  assert.equal(
    sameWalletEvidence(rec),
    "3root (hop 0) was spent as an input together with known Binance address 3binance in tx tx1"
  );
  assert.equal(sameWalletEvidence({ ...rec, sameWallet: undefined }), "");
}

// Disclosure draft wording — the legal output path.
{
  const base = { caseId: "c1", vaspName: "Binance", chain: "BITCOIN" as const, evidenceTrail: ["txA"], valueMoved: true };
  const attribution = { labeledAddress: "3known", txHash: "txK" };

  // Hop 0: the attributed address is the suspect — named once, never twice.
  const hop0 = buildEmailDraft({ ...base, address: "3suspect", attribution: { ...attribution, address: "3suspect" } });
  assert.match(hop0.subject, /^Ownership Confirmation and Disclosure Request/);
  assert.match(hop0.body, /This is an inference\./);
  assert.match(hop0.body, /Please first confirm whether 3suspect is controlled by\nBinance\./);
  assert.match(hop0.body, /records associated with it,\nper the evidence trail/);
  assert.doesNotMatch(hop0.body, /suspect address above/);
  assert.match(hop0.body, /If it is not, please tell us/);
  assert.doesNotMatch(hop0.body, /received funds/, "an inference draft must not assert receipt of funds");

  // Hop 2: a different address was attributed, so the suspect is named too.
  const hop2 = buildEmailDraft({ ...base, address: "3suspect", attribution: { ...attribution, address: "3downstream" } });
  assert.match(hop2.body, /records associated with it and with the suspect address above,\nper the evidence trail/);

  // Prose wraps like the rest of the draft (short fake addresses, so any
  // over-long line is the template's, not the data's).
  for (const line of hop2.body.split("\n")) assert.ok(line.length <= 80, `draft line too long: ${line}`);

  // Exact label: no inference wording at all, both existing branches intact.
  const exact = buildEmailDraft({ ...base, address: "3suspect" });
  assert.match(exact.subject, /^Disclosure Request/);
  assert.doesNotMatch(exact.body, /inference|confirm ownership/);
  assert.match(exact.body, /received funds traced from it/);
  assert.match(buildEmailDraft({ ...base, address: "0xs", valueMoved: false }).body, /no value transfers/);
}

// Negative/zero scores still recommend (the arithmetic stays visible) but
// carry a low-actionability note; a positive score carries none.
{
  const rec = (score: number): VaspRecommendation => ({
    address: "T1",
    entityName: "Bitfinex",
    vaspName: "Bitfinex",
    breakdown: { hopDistance: 3, fiuindRegistered: false, hasIndiaNodalOfficer: false, responseReliabilityScore: 1, score },
  });
  assert.match(lowActionabilityNote(rec(-2)), /score -2 ≤ 0/);
  assert.match(lowActionabilityNote(rec(0)), /Low actionability/);
  assert.equal(lowActionabilityNote(rec(1)), "");
}

// The citation names the in-force code (BNSS, since 2024-07-01) and the
// repealed one it replaced.
assert.match(LEGAL_BASIS, /Section 94, Bharatiya Nagarik Suraksha Sanhita/);
assert.match(LEGAL_BASIS, /formerly Section 91, CrPC/);

// sumValuesByAsset groups by asset contract — native and each token get
// their own total, and repeated items of the same asset accumulate.
{
  const usdt = { symbol: "USDT", decimals: 6, contract: "0xusdt" };
  const totals = sumValuesByAsset([
    { valueBaseUnits: "1000000000000000000" }, // 1 ETH, native
    { valueBaseUnits: "500000000000000000" }, // 0.5 ETH, native
    { asset: usdt, valueBaseUnits: "1000000" }, // 1 USDT
    { asset: usdt, valueBaseUnits: "2000000" }, // 2 USDT
  ]);
  assert.equal(totals.length, 2);
  const native = totals.find((t) => !t.asset)!;
  const usdtTotal = totals.find((t) => t.asset?.contract === "0xusdt")!;
  assert.equal(native.valueBaseUnits, "1500000000000000000");
  assert.equal(usdtTotal.valueBaseUnits, "3000000");
}

// An empty list produces an empty totals array, and assetTotalsLabel reads
// that as "" — no observed inflow is not the same claim as a zero amount.
{
  assert.deepEqual(sumValuesByAsset([]), []);
  assert.equal(assetTotalsLabel([], "ETHEREUM"), "");
}

// assetTotalsLabel joins multiple assets on one line, each in its own units.
{
  const usdt = { symbol: "USDT", decimals: 6, contract: "0xusdt" };
  const totals = [
    { valueBaseUnits: "1000000000000000000" },
    { asset: usdt, valueBaseUnits: "1411608923" },
  ];
  assert.equal(assetTotalsLabel(totals, "ETHEREUM"), "1.0000 ETH + 1411.6089 USDT");
}

// formatAssetValue is the same per-chain-native fallback edgeAmountLabel
// already relies on, exposed for non-edge callers (a node's balance).
assert.equal(formatAssetValue("100000000", undefined, "BITCOIN"), "1.0000 BTC");

// formatBySymbol resolves decimals from the symbol alone (cross-case
// aggregation, where there's no edge/asset object to read decimals off) —
// native symbols use their real chain decimals, everything else here is a
// 6-decimal stablecoin.
{
  assert.equal(formatBySymbol("1000000000000000000", "ETH"), "1.0000 ETH");
  assert.equal(formatBySymbol("100000000", "BTC"), "1.0000 BTC");
  assert.equal(formatBySymbol("1000000", "TRX"), "1.0000 TRX");
  assert.equal(formatBySymbol("1000000", "USDT"), "1.0000 USDT");
  assert.equal(formatBySymbol("1000000", "USDT0"), "1.0000 USDT0"); // unknown symbol -> 6dp fallback
}

console.log("format self-check passed");
