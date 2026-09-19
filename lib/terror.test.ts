// Run: npx tsx lib/terror.test.ts
import assert from "node:assert";
import { parseNbctfJsonl, sanctionLabelType, syncDecision } from "./terror";

const wallet = (publicKey: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    schema: "CryptoWallet",
    properties: { publicKey: [publicKey], sanctions: [{ properties: { authorityId: ["ASO 19/23"] } }], ...extra },
  });

// Real-shaped rows: a Tron wallet with a holder, an EVM one (lowercased), a
// BNB-tagged EVM one (BSC), a Cyrillic homoglyph (dropped), a non-wallet
// entity (ignored), and a malformed line (skipped, not a crash).
const out = parseNbctfJsonl(
  [
    wallet("TDnytyeHuRrpQ2wbpDot8io92bHs78XrMv", { holder: [{ caption: "SAEED KHUDRY" }] }),
    wallet("0x7FF9cFad3877F21d41Da833E2F775dB0569eE3D9"),
    wallet("0x1111111111111111111111111111111111111111", { currency: ["BNB"] }),
    wallet("ТТxELSY2kΗc9EGP2o4RnMxgLN8FEMWNyԛ6"),
    JSON.stringify({ schema: "Person", properties: { publicKey: ["TDnytyeHuRrpQ2wbpDot8io92bHs78XrMv"] } }),
    "{not json",
  ].join("\n")
);
assert.equal(out.length, 3);
assert.deepEqual(out[0], {
  address: "TDnytyeHuRrpQ2wbpDot8io92bHs78XrMv",
  chain: "TRON",
  order: "ASO 19/23",
  name: "SAEED KHUDRY — NBCTF seizure order ASO 19/23",
});
assert.equal(out[1].chain, "ETHEREUM");
assert.equal(out[1].address, "0x7ff9cfad3877f21d41da833e2f775db0569ee3d9");
assert.equal(out[1].name, "NBCTF seizure order ASO 19/23");
assert.equal(out[2].chain, "BSC");

assert.equal(sanctionLabelType("IRAN] [SDGT"), "TERROR_FINANCING");
assert.equal(sanctionLabelType("CYBER2"), "SANCTIONED");
assert.equal(sanctionLabelType("SDGTX"), "SANCTIONED", "whole program code only");

// Sync rules: create when absent; never touch a hand-curated label; never
// downgrade terror financing to generic sanctioned; upgrade the other way.
assert.equal(syncDecision(undefined, "SANCTIONED"), "create");
assert.equal(syncDecision("RANSOMWARE", "TERROR_FINANCING"), "skip");
assert.equal(syncDecision("EXCHANGE", "SANCTIONED"), "skip");
assert.equal(syncDecision("TERROR_FINANCING", "SANCTIONED"), "skip");
assert.equal(syncDecision("TERROR_FINANCING", "TERROR_FINANCING"), "update");
assert.equal(syncDecision("SANCTIONED", "TERROR_FINANCING"), "update");

console.log("terror self-check passed");
