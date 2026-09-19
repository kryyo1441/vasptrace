// Run: npx tsx lib/solana.test.ts
import assert from "node:assert";
import { solanaTransfersFrom, SPL_ALLOWLIST, type SolanaParsedTx } from "./solana";

const USDC = Object.keys(SPL_ALLOWLIST).find((m) => SPL_ALLOWLIST[m].symbol === "USDC")!;
const SUSPECT = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9";

// Native SOL transfer, real shape from a live tx (see docs/PROGRESS.md's
// 2026-09-18 entry).
{
  const tx: SolanaParsedTx = {
    blockTime: 100,
    meta: { err: null },
    transaction: {
      signatures: ["sig"],
      message: {
        accountKeys: [{ pubkey: SUSPECT, signer: true }, { pubkey: "dest", signer: false }],
        instructions: [{ program: "system", parsed: { type: "transfer", info: { source: SUSPECT, destination: "dest", lamports: 5000 } } }],
      },
    },
  };
  const out = solanaTransfersFrom(tx, SUSPECT);
  assert.deepEqual(out, [{ to: "dest", valueBaseUnits: "5000" }]);
}

// A zero-lamport transfer (address-poisoning-style) moves nothing.
{
  const tx: SolanaParsedTx = {
    blockTime: 100,
    meta: { err: null },
    transaction: {
      signatures: ["sig"],
      message: {
        accountKeys: [{ pubkey: SUSPECT, signer: true }],
        instructions: [{ program: "system", parsed: { type: "transfer", info: { source: SUSPECT, destination: "dest", lamports: 0 } } }],
      },
    },
  };
  assert.deepEqual(solanaTransfersFrom(tx, SUSPECT), []);
}

// SPL transfer: destination is a *token account*, and the real wallet is its
// owner, read from postTokenBalances — never the token account itself.
{
  const tx: SolanaParsedTx = {
    blockTime: 100,
    meta: {
      err: null,
      postTokenBalances: [{ accountIndex: 1, mint: USDC, owner: "realOwner" }],
    },
    transaction: {
      signatures: ["sig"],
      message: {
        accountKeys: [{ pubkey: SUSPECT, signer: true }, { pubkey: "tokenAcct", signer: false }],
        instructions: [
          {
            program: "spl-token",
            parsed: { type: "transferChecked", info: { authority: SUSPECT, source: "srcAcct", destination: "tokenAcct", mint: USDC, tokenAmount: { amount: "1000000" } } },
          },
        ],
      },
    },
  };
  const out = solanaTransfersFrom(tx, SUSPECT);
  assert.deepEqual(out, [{ to: "realOwner", valueBaseUnits: "1000000", asset: SPL_ALLOWLIST[USDC] }]);
}

// A non-allowlisted mint (spam token) is dropped, exactly like the EVM tracer.
{
  const tx: SolanaParsedTx = {
    blockTime: 100,
    meta: { err: null, postTokenBalances: [{ accountIndex: 1, mint: "SpamMint111", owner: "realOwner" }] },
    transaction: {
      signatures: ["sig"],
      message: {
        accountKeys: [{ pubkey: SUSPECT, signer: true }, { pubkey: "tokenAcct", signer: false }],
        instructions: [
          { program: "spl-token", parsed: { type: "transferChecked", info: { authority: SUSPECT, destination: "tokenAcct", mint: "SpamMint111", tokenAmount: { amount: "999" } } } },
        ],
      },
    },
  };
  assert.deepEqual(solanaTransfersFrom(tx, SUSPECT), []);
}

// A failed transaction (err set) is the caller's job to skip before calling
// this — solanaTransfersFrom itself only reads instructions, so this just
// documents that getOutgoingSolana checks tx.meta.err, not this function.
{
  const tx: SolanaParsedTx = {
    blockTime: 100,
    meta: { err: null },
    transaction: {
      signatures: ["sig"],
      message: {
        accountKeys: [{ pubkey: SUSPECT, signer: true }],
        // Someone else's transfer — must not attribute it to the suspect.
        instructions: [{ program: "system", parsed: { type: "transfer", info: { source: "other", destination: "dest", lamports: 100 } } }],
      },
    },
  };
  assert.deepEqual(solanaTransfersFrom(tx, SUSPECT), []);
}

console.log("solana self-check passed");
