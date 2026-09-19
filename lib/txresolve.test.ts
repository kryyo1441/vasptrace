// Run: npx tsx lib/txresolve.test.ts
import assert from "node:assert";
import { isTxHash, recipientsFromBitcoin, recipientsFromBsc, recipientsFromEvm, recipientsFromTron } from "./txresolve";
import { ERC20_ALLOWLIST } from "./etherscan";
import type { EsploraTx } from "./blockstream";

const USDT_1 = Object.keys(ERC20_ALLOWLIST[1])[0];

// Hash-shape families don't collide with each other or with address shapes
// (lib/address.ts's own families) — a 64-hex string is ambiguous between
// Bitcoin and Tron on purpose (both use it), everything else is disjoint.
assert.ok(isTxHash("0x" + "a".repeat(64), "ETHEREUM"));
assert.ok(!isTxHash("0x" + "a".repeat(63), "ETHEREUM"), "wrong length");
assert.ok(isTxHash("a".repeat(64), "BITCOIN"));
assert.ok(isTxHash("a".repeat(64), "TRON"));
assert.ok(!isTxHash("0x6eedf92fb92dd68a270c3205e96dccc527728066", "ETHEREUM"), "an address is not a tx hash");
assert.ok(isTxHash("41cYJKVxD1XLtgkunvvgo4NmhJHjDvNUYfJkcH997rKUP1kE9ocJiqVrv4MMpF26GKguptNrnEdXdrreLQUpNZrF", "SOLANA"));

// EVM: native value, plus an allowlisted ERC-20 Transfer log. A reverted tx
// yields nothing regardless of what its logs claim.
{
  const tx = { from: "0xsender", to: "0xreceiver", value: "0xde0b6b3a7640000" }; // 1 ETH
  const receipt = {
    status: "0x1",
    logs: [
      {
        address: USDT_1,
        topics: [
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          "0x000000000000000000000000" + "aa".repeat(20),
          "0x000000000000000000000000" + "bb".repeat(20),
        ],
        data: "0x" + (5000000).toString(16).padStart(64, "0"),
      },
    ],
  };
  const out = recipientsFromEvm(tx, receipt, 1);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { from: "0xsender", address: "0xreceiver", valueBaseUnits: "1000000000000000000" });
  assert.equal(out[1].address, "0x" + "bb".repeat(20));
  assert.equal(out[1].asset?.symbol, "USDT");

  assert.deepEqual(recipientsFromEvm(tx, { status: "0x0", logs: [] }, 1), [], "reverted tx moved nothing");
  assert.deepEqual(recipientsFromEvm({ ...tx, value: "0x0" }, { logs: [] }, 1), [], "zero value, no logs = nothing");
}

// Bitcoin: outputs that don't pay back to an input address (excludes change).
{
  const tx: EsploraTx = {
    txid: "t",
    status: { confirmed: true },
    vin: [{ prevout: { scriptpubkey_address: "1input" } }],
    vout: [
      { scriptpubkey_address: "1recipient", value: 50000 },
      { scriptpubkey_address: "1input", value: 1000 }, // change, excluded
      { scriptpubkey_address: "1zero", value: 0 }, // dust/OP_RETURN-adjacent, excluded
    ],
  };
  assert.deepEqual(recipientsFromBitcoin(tx), [{ from: "1input", address: "1recipient", valueBaseUnits: "50000" }]);
}

// Tron: native (contractType 1) and USDT-TRC20, only on success.
{
  const info = {
    contractRet: "SUCCESS",
    contractType: 1,
    ownerAddress: "Towner",
    toAddress: "Trecipient",
    contractData: { amount: 1000000 },
    trc20TransferInfo: [
      { from_address: "Towner", to_address: "Tusdt", contract_address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", amount_str: "5000000" },
      { from_address: "Towner", to_address: "Tspam", contract_address: "TspamContract", amount_str: "9999999" }, // not USDT contract
    ],
  };
  const out = recipientsFromTron(info);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { from: "Towner", address: "Trecipient", valueBaseUnits: "1000000" });
  assert.equal(out[1].address, "Tusdt");
  assert.deepEqual(recipientsFromTron({ ...info, contractRet: "REVERT" }), []);
}

// BSC: hex value decoded, zero/failed excluded.
{
  const tx = { from: "0xA", to: "0xB", hash: "h", value: "0x2386f26fc10000", timestamp: "0x0", status: "0x1" };
  assert.deepEqual(recipientsFromBsc(tx), [{ from: "0xa", address: "0xb", valueBaseUnits: "10000000000000000" }]);
  assert.deepEqual(recipientsFromBsc({ ...tx, value: "0x0" }), []);
  assert.deepEqual(recipientsFromBsc({ ...tx, status: "0x0" }), []);
}

console.log("txresolve self-check passed");
