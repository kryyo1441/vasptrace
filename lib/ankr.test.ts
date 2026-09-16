// Run: npx tsx lib/ankr.test.ts
// Covers pickNativeAsset and hexToDecimalString — the two places an unverified
// API response shape (see lib/ankr.ts's comment) could silently produce a
// wrong balance instead of an error.
import assert from "node:assert";
import { hexToDecimalString, pickNativeAsset } from "./ankr";

// tokenType: "NATIVE" present — the recalled-but-unverified shape.
assert.strictEqual(
  pickNativeAsset([{ tokenType: "ERC20", contractAddress: "0xabc", balanceRawInteger: "1" }, { tokenType: "NATIVE", balanceRawInteger: "42" }], "BNB")
    ?.balanceRawInteger,
  "42"
);

// No tokenType field at all, but the native entry has no contractAddress.
assert.strictEqual(
  pickNativeAsset([{ contractAddress: "0xabc", balanceRawInteger: "1" }, { balanceRawInteger: "77" }], "BNB")
    ?.balanceRawInteger,
  "77"
);

// Neither of the above — falls back to matching the symbol.
assert.strictEqual(
  pickNativeAsset(
    [
      { contractAddress: "0xabc", tokenSymbol: "USDT", balanceRawInteger: "1" },
      { contractAddress: "0xdef", tokenSymbol: "BNB", balanceRawInteger: "9" },
    ],
    "BNB"
  )?.balanceRawInteger,
  "9"
);

// No match at all — caller's `?? "0"` fallback, not this function's job to
// invent a value.
assert.strictEqual(pickNativeAsset([{ contractAddress: "0xabc", tokenSymbol: "USDT" }], "BNB"), undefined);

assert.strictEqual(hexToDecimalString("0x1a"), "26");
assert.strictEqual(hexToDecimalString(undefined), "0");
assert.strictEqual(hexToDecimalString("0x0"), "0");
// Large enough that Number() would lose precision — must stay BigInt end to end.
assert.strictEqual(hexToDecimalString("0xffffffffffffffff"), "18446744073709551615");

console.log("lib/ankr.test.ts — all assertions passed");
