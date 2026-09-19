// Run: npx tsx lib/linking.test.ts
import assert from "node:assert";
import { findLinks } from "./linking";
import type { TraceNode } from "./tracers/types";

const n = (address: string, extra: Partial<TraceNode> = {}): TraceNode => ({
  address, depth: 1, kind: "INTERMEDIARY", confidence: null, stopReason: null, typologyFlags: [], ...extra,
});
const hot = n("0xhot", { kind: "EXCHANGE", confidence: "high", stopReason: "LABEL_MATCH", entityName: "Binance 14" });
const current = { nodes: [n("0xroot", { kind: "SUSPECT", depth: 0 }), n("0xdeposit", { confidence: "medium" }), hot] };
const other = (id: string, nodes: TraceNode[]) => ({
  id, address: `root-${id}`, createdAt: new Date("2026-09-01T00:00:00Z"), traceResult: JSON.stringify({ nodes }),
});

const links = findLinks(current, [
  other("a", [n("0xdeposit"), hot]), // shares the deposit address and the hot wallet
  other("b", [hot]), // shares only the hot wallet
  other("c", [n("0xroot", { kind: "SUSPECT", depth: 0 })]), // same suspect traced before
  { id: "d", address: "x", createdAt: new Date(), traceResult: "not json" },
  { id: "e", address: "x", createdAt: new Date(), traceResult: null },
]);

assert.deepEqual(Object.keys(links).sort(), ["0xdeposit", "0xroot"], "labeled hot wallet is never a link");
assert.deepEqual(links["0xdeposit"], [{ caseId: "a", rootAddress: "root-a", createdAt: "2026-09-01T00:00:00.000Z" }]);
assert.equal(links["0xroot"][0].caseId, "c");
assert.deepEqual(findLinks(current, []), {});

console.log("linking self-check passed");
