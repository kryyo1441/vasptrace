// Self-check: npx tsx lib/address.test.ts
import assert from "node:assert";
import { ADDRESS_VALIDATORS, detectChains } from "./address";

// Real addresses from docs/DEMO_ADDRESSES.md, one per chain family.
const ETH = "0x6eedf92fb92dd68a270c3205e96dccc527728066";
const BTC = "1CRLGcaXajtWVF5EopZgQUqE12dKn8Rtuh";
const BECH32 = "bc1qshmka805v0s9tcxumupntznxptamen2nnym5y9";
const TRON = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const EVM = ["ETHEREUM", "POLYGON", "ARBITRUM"];

// Each address validates for its own chain.
assert.ok(ADDRESS_VALIDATORS.ETHEREUM.test(ETH));
assert.ok(ADDRESS_VALIDATORS.BITCOIN.test(BTC));
assert.ok(ADDRESS_VALIDATORS.BITCOIN.test(BECH32));
assert.ok(ADDRESS_VALIDATORS.TRON.test(TRON));

// The families don't overlap — this is the property the wrong-chain message
// relies on. The EVM chains share one format, so a 0x address matches all
// three of them and nothing else.
assert.deepStrictEqual(detectChains(ETH), EVM);
assert.deepStrictEqual(detectChains(BTC), ["BITCOIN"]);
assert.deepStrictEqual(detectChains(BECH32), ["BITCOIN"]);
assert.deepStrictEqual(detectChains(TRON), ["TRON"]);

// An uppercase 0X prefix is valid (some explorers emit it); the EVM tracer
// lowercases downstream.
assert.ok(ADDRESS_VALIDATORS.ETHEREUM.test("0X6EEDF92FB92DD68A270C3205E96DCCC527728066"));
assert.deepStrictEqual(detectChains(ETH.toUpperCase()), EVM);

// Bitcoin/Tron are case-sensitive and must not be case-folded — a
// lowercased Tron address is not the same address, so it must not validate.
assert.ok(!ADDRESS_VALIDATORS.TRON.test(TRON.toLowerCase()));

// Whitespace must be trimmed by the caller before validating; these are
// exactly the pastes (from a PDF, an email) that used to reach a confusing
// "not a valid address" error.
assert.ok(!ADDRESS_VALIDATORS.ETHEREUM.test(` ${ETH}`));
assert.ok(!ADDRESS_VALIDATORS.ETHEREUM.test(`${ETH}\n`));
assert.ok(ADDRESS_VALIDATORS.ETHEREUM.test(` ${ETH}\n`.trim()));

// Garbage matches nothing rather than falling through to a chain.
assert.deepStrictEqual(detectChains("0xnotanaddress"), []);
assert.deepStrictEqual(detectChains(""), []);
assert.deepStrictEqual(detectChains("   "), []);
// Right prefix, wrong length.
assert.deepStrictEqual(detectChains(ETH.slice(0, -1)), []);
assert.deepStrictEqual(detectChains(TRON + "x"), []);

console.log("lib/address.test.ts — all assertions passed");
