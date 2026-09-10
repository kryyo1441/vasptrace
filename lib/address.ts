// Address-shape validation for the trace API's trust boundary. Lives here
// rather than inline in the route so it can carry a self-check
// (lib/address.test.ts) — this is a parser on untrusted input, and it
// silently accepting or rejecting the wrong thing is the kind of bug that
// only shows up in front of a judge.
import type { Chain } from "@/lib/generated/prisma/client";

export const ADDRESS_VALIDATORS: Record<Chain, RegExp> = {
  // An uppercase 0X prefix is accepted because some wallets and block
  // explorers emit one; lib/tracers/ethereum.ts lowercases the whole
  // address downstream, so nothing after this point can tell the
  // difference. Bitcoin and Tron are base58/bech32 and case-sensitive —
  // they must NOT be case-folded.
  ETHEREUM: /^0[xX][a-fA-F0-9]{40}$/,
  BITCOIN: /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{25,90})$/,
  TRON: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
};

// The three formats don't overlap (0x… / 1,3,bc1… / T…), so at most one
// validator can match — which is what lets the API tell someone who picked
// the wrong chain selector which chain their address actually belongs to,
// instead of only that it's invalid.
export function detectChain(address: string): Chain | undefined {
  return (Object.keys(ADDRESS_VALIDATORS) as Chain[]).find((c) => ADDRESS_VALIDATORS[c].test(address));
}
