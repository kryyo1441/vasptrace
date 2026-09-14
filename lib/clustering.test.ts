// Run: npx tsx lib/clustering.test.ts
import assert from "node:assert";
import { applyCoSpendAttribution, applyConfidenceClustering } from "./clustering";
import { isLikelyCoinJoin, type EsploraTx } from "./blockstream";
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
  kind: valueWei === "0" ? "CONTRACT_CALL" : "TRANSFER",
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

// Share is per asset. All of this address's USDT goes to the exchange, while
// 1 ETH goes elsewhere. Summed in raw base units the 100 USDT (1e8) is ~0% of
// 1e18 wei and the deposit address is missed — the exact bug grouping fixes.
{
  const usdt = { symbol: "USDT", decimals: 6, contract: "0xusdt" };
  const exchange = node("0xexchange3", { kind: "EXCHANGE", confidence: "high", entityName: "Binance 14" });
  const deposit = node("0xdeposit3");
  const edges = [
    edge("0xdeposit3", "0xother", "1000000000000000000"),
    { ...edge("0xdeposit3", "0xexchange3", "100000000"), asset: usdt },
  ];
  applyConfidenceClustering([exchange, deposit], edges);
  assert.equal(deposit.confidence, "medium");
  assert.match(deposit.confidenceReason!, /100% of its outgoing USDT/);
}

// Co-spend: an address spent alongside a labeled one is that entity's wallet
// — medium, never high, and an exact match is never overridden.
{
  const labels = new Map([["3binance", { entityName: "Binance (cold wallet)", labelType: "EXCHANGE" }]]);
  const suspect = node("3suspect", { kind: "SUSPECT", depth: 0 });
  const exact = node("3exact", { kind: "EXCHANGE", confidence: "high", entityName: "Binance 1" });
  const stranger = node("3stranger");
  const coSpenders = new Map([
    ["3suspect", new Map([["3other", "tx0"], ["3binance", "tx1"]])],
    ["3exact", new Map([["3binance", "tx2"]])],
    ["3stranger", new Map([["3other", "tx3"]])],
  ]);
  applyCoSpendAttribution([suspect, exact, stranger], coSpenders, labels);
  assert.equal(suspect.confidence, "medium");
  assert.equal(suspect.kind, "SUSPECT"); // root stays red on the graph
  assert.match(suspect.confidenceReason!, /3binance in tx tx1/);
  assert.deepEqual(suspect.coSpend, { labeledAddress: "3binance", labelType: "EXCHANGE", txHash: "tx1" });
  assert.equal(exact.entityName, "Binance 1");
  assert.equal(stranger.confidence, null);

  // Co-spend wins over the forwards-80% rule, which skips attributed nodes.
  const exchange = node("3ex", { kind: "EXCHANGE", confidence: "high", entityName: "Coinbase 1" });
  const both = node("3both");
  applyCoSpendAttribution([both], new Map([["3both", new Map([["3binance", "tx4"]])]]), labels);
  applyConfidenceClustering([exchange, both], [edge("3both", "3ex", "100")]);
  assert.match(both.entityName!, /Binance \(cold wallet\) — same wallet/);
}

// CoinJoin shape: inputs must not be read as one owner.
{
  const tx = (inputs: string[], outputs: number[]): EsploraTx => ({
    txid: "t",
    vin: [...inputs.map((a) => ({ prevout: { scriptpubkey_address: a } })), { prevout: null }],
    vout: outputs.map((value) => ({ value })),
    status: { confirmed: true, block_time: 1 },
  });
  assert.equal(isLikelyCoinJoin(tx(["a", "b", "c"], [100, 100, 100, 37])), true);
  assert.equal(isLikelyCoinJoin(tx(["a", "b"], [100, 37])), false); // ordinary payment + change
  assert.equal(isLikelyCoinJoin(tx(["a", "b"], [100, 250, 37])), false); // batch, distinct amounts
  assert.equal(isLikelyCoinJoin(tx(["a", "a"], [100, 100, 100])), false); // one owner can't CoinJoin itself
}

console.log("clustering self-check passed");
