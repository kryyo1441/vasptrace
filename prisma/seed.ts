// Real, public seed data — no synthetic addresses.
// Sources noted per entry. Extend this array to add more.
import "dotenv/config";
import { Chain, LabelType, Role } from "../lib/generated/prisma/client";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth";

// Demo accounts only — rotate these before any real deployment. Two roles
// so the RBAC story (investigators see their own cases, supervisors see
// all) is demonstrable, not just a login screen. See docs/PLAN.md's "Final
// stretch" for why auth exists at all.
const demoUsers: { username: string; password: string; role: Role }[] = [
  { username: "investigator", password: "vasptrace-investigator-2026", role: "INVESTIGATOR" },
  { username: "supervisor", password: "vasptrace-supervisor-2026", role: "SUPERVISOR" },
];

// Every address below was individually verified against a block explorer or
// the OFAC action itself before seeding (see source field). Do not add an
// address here without doing the same — this feeds a law-enforcement demo,
// and a wrong "this address is X" label is worse than no label.
const labeledAddresses: {
  address: string;
  chain: Chain;
  labelType: LabelType;
  entityName: string;
  source: string;
}[] = [
  // --- Exchange hot wallets (publicly documented on block explorers) ---
  {
    address: "0x28c6c06298d514db089934071355e5743bf21d60",
    chain: Chain.ETHEREUM,
    labelType: LabelType.EXCHANGE,
    entityName: "Binance 14",
    source: "Etherscan public label",
  },
  {
    address: "0x27fd43babfbe83a81d14665b1a6fb8030a60c9b4",
    chain: Chain.ETHEREUM,
    labelType: LabelType.EXCHANGE,
    entityName: "WazirX 2",
    source: "Etherscan public label",
  },
  {
    address: "0x71660c4005ba85c37ccec55d0c4493e66fe775d3",
    chain: Chain.ETHEREUM,
    labelType: LabelType.EXCHANGE,
    entityName: "Coinbase 1",
    source: "Etherscan public label",
  },
  {
    address: "1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s",
    chain: Chain.BITCOIN,
    labelType: LabelType.EXCHANGE,
    entityName: "Binance (deprecated hot wallet)",
    source: "WalletExplorer / Blockchair public label",
  },
  {
    address: "3M219KR5vEneNb47ewrPfWyb5jQ2DjxRP6",
    chain: Chain.BITCOIN,
    labelType: LabelType.EXCHANGE,
    entityName: "Binance (cold wallet)",
    source: "Blockchair public label",
  },
  {
    address: "TXFBqBbqJommqZf7BV8NNYzePh97UmJodJ",
    chain: Chain.TRON,
    labelType: LabelType.EXCHANGE,
    entityName: "Bitfinex",
    source: "Tronscan public address tag (addressTag: Bitfinex)",
  },
  // --- Day 2 breadth expansion: VASPs already in vaspRegistry (Kraken,
  // KuCoin, OKX, MEXC, Bitbns) had no labeled address on any chain, so a
  // live trace could never actually recommend them. Sourced from
  // Etherscan's server-rendered "Public Name Tag" (scraped 2026-09-08,
  // same provenance as the original Etherscan entries above) and
  // Tronscan's public hot-wallet directory (api/hot/exchanges, cross-
  // checked against api/account's addressTag field for each address). ---
  {
    address: "0x2910543af39aba0cd09dbb2d50200b3e800a63d2",
    chain: Chain.ETHEREUM,
    labelType: LabelType.EXCHANGE,
    entityName: "Kraken 1",
    source: "Etherscan public name tag",
  },
  {
    address: "0x236f9f97e0e62388479bf9e5ba4889e46b0273c3",
    chain: Chain.ETHEREUM,
    labelType: LabelType.EXCHANGE,
    entityName: "OKX 2",
    source: "Etherscan public name tag",
  },
  {
    address: "0x2b5634c42055806a59e9107ed44d43c426e58258",
    chain: Chain.ETHEREUM,
    labelType: LabelType.EXCHANGE,
    entityName: "KuCoin 1",
    source: "Etherscan public name tag",
  },
  {
    address: "TByxhqkBrdKuW984Yt9wJP3Kmsy57dnirw",
    chain: Chain.TRON,
    labelType: LabelType.EXCHANGE,
    entityName: "Bitbns",
    source: "Tronscan public hot-wallet directory (addressTag: Bitbns)",
  },
  {
    address: "TXe3EibZP9jFogwyqLPd3APdwxZbiQBUqi",
    chain: Chain.TRON,
    labelType: LabelType.EXCHANGE,
    entityName: "WazirX Exchange Hot Wallet",
    source: "Tronscan public hot-wallet directory (addressTag: WazirX Exchange Hot Wallet)",
  },
  {
    address: "TTd9qHyjqiUkfTxe3gotbuTMpjU8LEbpkN",
    chain: Chain.TRON,
    labelType: LabelType.EXCHANGE,
    entityName: "Kraken (Tron hot wallet)",
    source: "Tronscan public hot-wallet directory (addressTag: Kraken)",
  },
  {
    address: "TLWE45u7eusdewSDCjZqUNmyhTUL1NBMzo",
    chain: Chain.TRON,
    labelType: LabelType.EXCHANGE,
    entityName: "KuCoin (Tron hot wallet, tagged Kucoin 1)",
    source: "Tronscan public hot-wallet directory (addressTag: Kucoin 1)",
  },
  {
    address: "TM1zzNDZD2DPASbKcgdVoTYhfmYgtfwx9R",
    chain: Chain.TRON,
    labelType: LabelType.EXCHANGE,
    entityName: "OKX (Tron hot wallet, tagged Okex 1)",
    source: "Tronscan public hot-wallet directory (addressTag: Okex 1)",
  },
  {
    address: "TB37WWozkkenGVYWD7Do2N5WT2CedqDktJ",
    chain: Chain.TRON,
    labelType: LabelType.EXCHANGE,
    entityName: "MEXC (Tron hot wallet, tagged MXC 2)",
    source: "Tronscan public hot-wallet directory (addressTag: MXC 2)",
  },
  // --- Polygon exchange wallets (added 2026-09-13 with the POLYGON chain).
  // Each read from PolygonScan's own public name tag for that address — the
  // page title, scraped individually, not inferred from the same address's
  // Ethereum label. Only VASPs already in vaspRegistry (a label with no
  // registry entry can never be recommended). entityName drops the explorer's
  // "Binance:" colon, because lib/scoring.ts matches the registry on the
  // first word. No Arbitrum labels: Arbiscan is Cloudflare-blocked to
  // scripts and Etherscan's name-tag API is a paid endpoint, so nothing
  // there could be verified to this bar. ---
  ...(
    [
      ["0x28c6c06298d514db089934071355e5743bf21d60", "Binance 14", "Binance 14"],
      ["0xf977814e90da44bfa03b6295a0616a897441acec", "Binance Hot Wallet 20", "Binance: Hot Wallet 20"],
      ["0xb38e8c17e38363af6ebdcb3dae12e0243582891d", "Binance 54", "Binance 54"],
      ["0xe7804c37c13166ff0b37f5ae0bb07a3aebb6e245", "Binance 48", "Binance 48"],
      ["0x082489a616ab4d46d1947ee3f912e080815b08da", "Binance 53", "Binance 53"],
      ["0x5a52e96bacdabb82fd05763e25335261b270efcb", "Binance 28", "Binance 28"],
      ["0x2910543af39aba0cd09dbb2d50200b3e800a63d2", "Kraken 1", "Kraken 1"],
      ["0x06959153b974d0d5fdfd87d561db6d8d4fa0bb0b", "OKX 1", "OKX 1"],
      ["0x236f9f97e0e62388479bf9e5ba4889e46b0273c3", "OKX 2", "OKX 2"],
      ["0x6cc5f688a315f3dc28a7781717a9a798a59fda7b", "OKX", "OKX"],
      ["0x2b5634c42055806a59e9107ed44d43c426e58258", "KuCoin 1", "KuCoin 1"],
      ["0xd6216fc19db775df9774a6e33526131da7d19a2c", "KuCoin 6", "KuCoin 6"],
      ["0x71660c4005ba85c37ccec55d0c4493e66fe775d3", "Coinbase 1", "Coinbase 1"],
    ] as const
  ).map(([address, entityName, tag]) => ({
    address,
    chain: Chain.POLYGON,
    labelType: LabelType.EXCHANGE,
    entityName,
    source: `PolygonScan public name tag (${tag})`,
  })),
  // --- Arbitrum exchange wallets (added 2026-09-14). Arbiscan is
  // Cloudflare-blocked to scripts (ROADMAP item, HANDOFF.md) — unblocked by
  // reading each page in a real browser session (Claude-in-Chrome) instead of
  // curl, same public-name-tag provenance as every other explorer-sourced
  // label here. Bybit ("Bybit: Hot Wallet", 0xf89d7b9c…) was also confirmed
  // but skipped: not in vaspRegistry, same reason Polygon's seed skipped it. ---
  {
    address: "0xf977814e90da44bfa03b6295a0616a897441acec",
    chain: Chain.ARBITRUM,
    labelType: LabelType.EXCHANGE,
    entityName: "Binance 20",
    source: "Arbiscan public name tag (Binance: Hot Wallet 20)",
  },
  {
    address: "0x631fc1ea2270e98fbd9d92658ece0f5a269aa161",
    chain: Chain.ARBITRUM,
    labelType: LabelType.EXCHANGE,
    entityName: "Binance",
    source: "Arbiscan public name tag (Binance: Hot Wallet)",
  },
  {
    address: "0xa7efae728d2936e78bda97dc267687568dd593f3",
    chain: Chain.ARBITRUM,
    labelType: LabelType.EXCHANGE,
    entityName: "OKX 3",
    source: "Arbiscan public name tag (OKX 3)",
  },
  // --- BNB Chain exchange wallets (added 2026-09-16 with the BSC chain).
  // Read from BscScan's own public name tag for that address — bscscan.com
  // is Cloudflare-gated to scripts like Arbiscan was, unblocked the same way
  // (a real browser session), and the top-accounts-by-balance page surfaces
  // exchange-tagged addresses directly, no guessing. Four of these addresses
  // are the exact same 0x… address already seeded on Ethereum/Polygon — real
  // cross-chain hot-wallet reuse (an EVM address is one keypair across every
  // EVM chain), confirmed individually on BscScan, not assumed from the
  // other chain's label. ---
  {
    address: "0xbe0eb53f46cd790cd13851d5eff43d12404d33e8",
    chain: Chain.BSC,
    labelType: LabelType.EXCHANGE,
    entityName: "Binance 7",
    source: "BscScan top-accounts-by-balance page (name tag: Binance 7)",
  },
  {
    address: "0x835678a611b28684005a5e2233695fb6cbbb0007",
    chain: Chain.BSC,
    labelType: LabelType.EXCHANGE,
    entityName: "Binance 70",
    source: "BscScan top-accounts-by-balance page (name tag: Binance 70)",
  },
  {
    address: "0xf977814e90da44bfa03b6295a0616a897441acec",
    chain: Chain.BSC,
    labelType: LabelType.EXCHANGE,
    entityName: "Binance Hot Wallet 20",
    source: "BscScan public name tag (Binance: Hot Wallet 20)",
  },
  {
    address: "0x5a52e96bacdabb82fd05763e25335261b270efcb",
    chain: Chain.BSC,
    labelType: LabelType.EXCHANGE,
    entityName: "Binance 28",
    source: "BscScan public name tag (Binance 28)",
  },
  {
    address: "0x2910543af39aba0cd09dbb2d50200b3e800a63d2",
    chain: Chain.BSC,
    labelType: LabelType.EXCHANGE,
    entityName: "Kraken 1",
    source: "BscScan public name tag (Kraken 1)",
  },
  {
    address: "0x71660c4005ba85c37ccec55d0c4493e66fe775d3",
    chain: Chain.BSC,
    labelType: LabelType.EXCHANGE,
    entityName: "Coinbase 1",
    source: "BscScan public name tag (Coinbase 1)",
  },
  {
    address: "0x06959153b974d0d5fdfd87d561db6d8d4fa0bb0b",
    chain: Chain.BSC,
    labelType: LabelType.EXCHANGE,
    // Different tag number from the same address's Polygon label ("OKX 1") —
    // BscScan tags this one "OKX 33", kept as BscScan wrote it rather than
    // homogenized to match the other chain's number.
    entityName: "OKX 33",
    source: "BscScan public name tag (OKX 33)",
  },
  // --- Tornado Cash mixer contracts. OFAC-sanctioned 2022, delisted by
  // Treasury March 2025 — still labeled MIXER here since the tracer's job
  // is AML pattern detection, not live sanctions-list matching. ---
  {
    address: "0x722122df12d4e14e13ac3b6895a86e84145b6967",
    chain: Chain.ETHEREUM,
    labelType: LabelType.MIXER,
    entityName: "Tornado Cash Router (ex-OFAC SDN, delisted Mar 2025)",
    source: "Treasury/OFAC designation 2022-08-08",
  },
  {
    address: "0x8589427373d6d84e98730d7795d8f6f8731fda16",
    chain: Chain.ETHEREUM,
    labelType: LabelType.MIXER,
    entityName: "Tornado Cash 100 ETH pool (ex-OFAC SDN, delisted Mar 2025)",
    source: "Treasury/OFAC designation 2022-08-08",
  },
  // --- Bridge / cross-chain-swap contracts (added 2026-09-16), from
  // Etherscan's own "Bridge" label directory (etherscan.io/accounts/label/
  // bridge — Cloudflare-gated to scripts like Arbiscan/BscScan, unblocked
  // the same way, a real browser session). LabelType.BRIDGE already existed
  // in the schema and NodeKind/graph-view.tsx already render it (teal,
  // "Bridge") — nothing here needed new plumbing, only the missing seed
  // data. A BRIDGE match stops the trace exactly like MIXER/EXCHANGE does
  // (lib/tracers/bfs.ts's stopReason check doesn't care which label type),
  // so this identifies and flags a bridge honestly — it does NOT claim to
  // follow the funds across to the destination chain. That's the deferred,
  // harder half (ROADMAP.md item 4: LayerZero/Wormhole/Across message
  // lookups, verified reachable but not wired in), left alone rather than
  // rushed to avoid the "silently continues tracing on a second chain"
  // overclaim ROADMAP.md itself already flagged as the risk here. Also
  // excluded from scoring.ts's recommendation (kind === "EXCHANGE" only)
  // and from CRITICAL/HIGH risk escalation (bridge use alone isn't
  // suspicious the way mixer use is) — both already correct by construction,
  // not something this addition needed to change. ---
  {
    address: "0x0a9f824c05a74f577a536a8a0c673183a872dff4",
    chain: Chain.ETHEREUM,
    labelType: LabelType.BRIDGE,
    entityName: "LayerZero: Swappable Bridge",
    source: "Etherscan bridge-label directory (71,481 txns)",
  },
  {
    address: "0x0439e60f02a8900a951603950d8d4527f400c3f1",
    chain: Chain.ETHEREUM,
    labelType: LabelType.BRIDGE,
    entityName: "MetaMask: Meta Bridge",
    source: "Etherscan bridge-label directory (1,841,276 txns)",
  },
  {
    address: "0x05b70fb5477a93be33822bfb31fdaf2c171970df",
    chain: Chain.ETHEREUM,
    labelType: LabelType.BRIDGE,
    // Explicitly a cross-chain swap service, not just a bridge — the other
    // category problem statement 26182 names alongside bridges.
    entityName: "Mayan: Swap Bridge (cross-chain swap service)",
    source: "Etherscan bridge-label directory (598 txns)",
  },
  {
    address: "0x00cd000000003f7f682be4813200893d4e690000",
    chain: Chain.ETHEREUM,
    labelType: LabelType.BRIDGE,
    entityName: "Synapse Protocol: FastBridge RFQ Router V2",
    source: "Etherscan bridge-label directory (18,946 txns)",
  },
  {
    address: "0x0b9857ae2d4a3dbe74ffe1d7df045bb7f96e4840",
    chain: Chain.ETHEREUM,
    labelType: LabelType.BRIDGE,
    entityName: "Arbitrum: Outbox 4 (official L2 exit bridge)",
    source: "Etherscan bridge-label directory (111,212 txns)",
  },
  // --- Solana exchange wallets (added 2026-09-18) ---
  // Each is Solscan's own public name tag for the account (the tag is the
  // account page's title), checked 2026-09-18. solscan.io blocks scripts, so
  // these were read from its indexed page titles rather than curl; only
  // addresses whose tag was visible verbatim are seeded. Candidates whose tag
  // couldn't be confirmed (a claimed Kraken, KuCoin and second Binance hot
  // wallet) were left out. Entity names avoid Solscan's "OKX: Hot Wallet"
  // colon form, since lib/scoring.ts matches the registry on the first word.
  {
    address: "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9",
    chain: Chain.SOLANA,
    labelType: LabelType.EXCHANGE,
    entityName: "Binance 2",
    source: "Solscan name tag \"Binance 2\" (solscan.io/account/5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9)",
  },
  {
    address: "GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE",
    chain: Chain.SOLANA,
    labelType: LabelType.EXCHANGE,
    entityName: "Coinbase Hot Wallet 2",
    source: "Solscan name tag \"Coinbase Hot Wallet 2\"",
  },
  {
    address: "D89hHJT5Aqyx1trP6EnGY9jJUB3whgnq3aUvvCqedvzf",
    chain: Chain.SOLANA,
    labelType: LabelType.EXCHANGE,
    entityName: "Coinbase Hot Wallet 3",
    source: "Solscan name tag \"Coinbase Hot Wallet 3\"",
  },
  {
    address: "5VCwKtCXgCJ6kit5FybXjvriW3xELsFDhYrPSqtJNmcD",
    chain: Chain.SOLANA,
    labelType: LabelType.EXCHANGE,
    entityName: "OKX 1",
    source: "Solscan name tag \"OKX\"",
  },
  {
    address: "C68a6RCGLiPskbPYtAcsCjhG8tfTWYcoB4JjCrXFdqyo",
    chain: Chain.SOLANA,
    labelType: LabelType.EXCHANGE,
    entityName: "OKX Hot Wallet 1",
    source: "Solscan name tag \"OKX: Hot Wallet\"",
  },
  {
    address: "is6MTRHEgyFLNTfYcuV4QBWLjrZBfmhVNYR6ccgr8KV",
    chain: Chain.SOLANA,
    labelType: LabelType.EXCHANGE,
    entityName: "OKX Hot Wallet 2",
    source: "Solscan name tag \"OKX: Hot Wallet\"",
  },
  {
    address: "AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2",
    chain: Chain.SOLANA,
    labelType: LabelType.EXCHANGE,
    entityName: "Bybit Hot Wallet",
    source: "Solscan name tag \"Bybit Hot Wallet\"",
  },
  {
    address: "AobVSwdW9BbpMdJvTqeCN4hPAmh4rHm7vwLnQ5ATSyrS",
    chain: Chain.SOLANA,
    labelType: LabelType.EXCHANGE,
    entityName: "Crypto.com Hot Wallet 2",
    source: "Solscan name tag \"Crypto.com Hot Wallet 2\"",
  },
  // --- OFAC SDN ransomware-linked address (first-ever crypto SDN listing) ---
  {
    address: "149w62rY42aZBox8fGcmqNsXUzSStKeq8C",
    chain: Chain.BITCOIN,
    labelType: LabelType.RANSOMWARE,
    entityName: "SamSam ransomware cash-out (Khorashadizadeh/Ghorbaniyan, Iran)",
    source: "OFAC SDN List, designated 2018-11-28",
  },
];

const SAHYOG = "https://sahyog.mha.gov.in/";
const DOMESTIC = "Sahyog Portal (I4C) — Indian FIU-IND reporting entity; serve under BNSS s.94";

const vaspRegistry: {
  name: string;
  fiuindRegistered: boolean;
  hasIndiaNodalOfficer: boolean;
  responseReliabilityScore: number;
  jurisdiction: string;
  leChannel: string;
  leChannelUrl: string;
}[] = [
  // Status reflects public FIU-IND registration info as of the seed date.
  // fiuindRegistered/hasIndiaNodalOfficer are best-effort from public
  // reporting — verify against the live FIU-IND list before real use.
  // jurisdiction/leChannel/leChannelUrl (added 2026-09-18): each offshore
  // exchange's own published law-enforcement intake page, found and checked
  // 2026-09-18 (sources in docs/PROGRESS.md's entry for that date); the
  // jurisdiction is the operating entity's place of incorporation per its
  // terms of service or public court filings. Re-check before real use.
  { name: "WazirX", fiuindRegistered: true, hasIndiaNodalOfficer: true, responseReliabilityScore: 4, jurisdiction: "India", leChannel: DOMESTIC, leChannelUrl: SAHYOG },
  { name: "CoinDCX", fiuindRegistered: true, hasIndiaNodalOfficer: true, responseReliabilityScore: 5, jurisdiction: "India", leChannel: DOMESTIC, leChannelUrl: SAHYOG },
  { name: "ZebPay", fiuindRegistered: true, hasIndiaNodalOfficer: true, responseReliabilityScore: 4, jurisdiction: "India", leChannel: DOMESTIC, leChannelUrl: SAHYOG },
  { name: "CoinSwitch", fiuindRegistered: true, hasIndiaNodalOfficer: true, responseReliabilityScore: 4, jurisdiction: "India", leChannel: DOMESTIC, leChannelUrl: SAHYOG },
  { name: "Giottus", fiuindRegistered: true, hasIndiaNodalOfficer: true, responseReliabilityScore: 3, jurisdiction: "India", leChannel: DOMESTIC, leChannelUrl: SAHYOG },
  { name: "Unocoin", fiuindRegistered: true, hasIndiaNodalOfficer: true, responseReliabilityScore: 3, jurisdiction: "India", leChannel: DOMESTIC, leChannelUrl: SAHYOG },
  { name: "BuyUcoin", fiuindRegistered: true, hasIndiaNodalOfficer: true, responseReliabilityScore: 2, jurisdiction: "India", leChannel: DOMESTIC, leChannelUrl: SAHYOG },
  { name: "Bitbns", fiuindRegistered: true, hasIndiaNodalOfficer: true, responseReliabilityScore: 3, jurisdiction: "India", leChannel: DOMESTIC, leChannelUrl: SAHYOG },
  { name: "KoinBX", fiuindRegistered: true, hasIndiaNodalOfficer: false, responseReliabilityScore: 2, jurisdiction: "India", leChannel: DOMESTIC, leChannelUrl: SAHYOG },
  {
    name: "Binance", fiuindRegistered: true, hasIndiaNodalOfficer: false, responseReliabilityScore: 2,
    jurisdiction: "Global (no single headquarters); FIU-IND registered for India",
    leChannel: "Binance Law Enforcement Request System (LERS), run on Kodex — agency sign-up required",
    leChannelUrl: "https://www.binance.com/en/support/law-enforcement",
  },
  {
    name: "Coinbase", fiuindRegistered: false, hasIndiaNodalOfficer: false, responseReliabilityScore: 3,
    jurisdiction: "United States",
    leChannel: "Coinbase law-enforcement portal, run on Kodex — agency sign-up required",
    leChannelUrl: "https://app.kodexglobal.com/gov/signup",
  },
  {
    name: "Bitfinex", fiuindRegistered: false, hasIndiaNodalOfficer: false, responseReliabilityScore: 1,
    jurisdiction: "British Virgin Islands",
    leChannel: "Bitfinex Law Enforcement Requests Policy (requests handled via Kodex)",
    leChannelUrl: "https://www.bitfinex.com/legal/general/law-enforcement-requests-policy/",
  },
  {
    name: "Kraken", fiuindRegistered: false, hasIndiaNodalOfficer: false, responseReliabilityScore: 2,
    jurisdiction: "United States",
    leChannel: "Kraken Compliance & Legal inquiry form",
    leChannelUrl: "https://support.kraken.com/articles/how-do-i-submit-a-legal-inquiry",
  },
  {
    name: "KuCoin", fiuindRegistered: false, hasIndiaNodalOfficer: false, responseReliabilityScore: 1,
    jurisdiction: "Seychelles",
    leChannel: "KuCoin Information Request System — English, signed/sealed request, 10–15 working days",
    leChannelUrl: "https://www.kucoin.com/legal/requests",
  },
  {
    name: "OKX", fiuindRegistered: true, hasIndiaNodalOfficer: false, responseReliabilityScore: 2,
    jurisdiction: "Seychelles; FIU-IND registered for India",
    leChannel: "OKX Law Enforcement Request Guide (requests via Kodex; enforcement@okx.com for emergencies)",
    leChannelUrl: "https://www.okx.com/en-us/help/okx-law-enforcement-request-guide",
  },
  {
    name: "MEXC", fiuindRegistered: false, hasIndiaNodalOfficer: false, responseReliabilityScore: 1,
    jurisdiction: "Seychelles",
    leChannel: "MEXC Law Enforcement Online Request System (LEORS) — access review 15–20 business days; stolen-fund freezes need an abnormal-funds ticket plus an LE request within 48 hours",
    leChannelUrl: "https://www.mexc.com/support/requests/legal",
  },
];

// Issuer freeze paths (ROADMAP item 3, added 2026-09-14). Facts drawn from
// each issuer's own public statements/policy, not scored — see the model's
// schema comment for why. Verified 2026-09-14 (see WebSearch citations in
// PROGRESS.md's entry for this date); re-check before real use, same as the
// VASP registry's own reliability figures.
const issuerRegistry: {
  symbol: string;
  issuerName: string;
  freezeProcess: string;
  requiresCourtOrder: boolean;
  sourceUrl: string;
}[] = [
  {
    symbol: "USDT",
    issuerName: "Tether",
    freezeProcess:
      "Tether states it works with 340+ law enforcement agencies in 65+ countries and has supported 2,300+ freeze cases, coordinating directly with investigators during active cases (not only via a court order). No publicly documented India-specific process or portal as of this seed — route a request through I4C/Sahyog per this app's usual channel and cite the case; do not assume a guaranteed or fast response outside the US cases Tether has publicised.",
    requiresCourtOrder: false,
    sourceUrl: "https://tether.io/news/tether-supports-freeze-of-more-than-344-million-in-usdt-in-coordination-with-ofac-and-u-s-law-enforcement/",
  },
  {
    symbol: "USDC",
    issuerName: "Circle",
    freezeProcess:
      "Circle states it freezes USDC only \"at the direction of law enforcement or the courts\" — i.e. a binding legal order, not an informal request. No publicly documented India-specific process as of this seed.",
    requiresCourtOrder: true,
    sourceUrl: "https://www.coindesk.com/business/2026/04/13/circle-ceo-says-he-won-t-freeze-usdc-without-a-court-order-even-as-hackers-walk-away-with-millions",
  },
];

async function main() {
  for (const entry of labeledAddresses) {
    await prisma.labeledAddress.upsert({
      where: { address_chain: { address: entry.address, chain: entry.chain } },
      update: entry,
      create: entry,
    });
  }

  for (const vasp of vaspRegistry) {
    await prisma.vaspRegistry.upsert({
      where: { name: vasp.name },
      update: vasp,
      create: vasp,
    });
  }

  for (const issuer of issuerRegistry) {
    await prisma.issuerRegistry.upsert({
      where: { symbol: issuer.symbol },
      update: issuer,
      create: issuer,
    });
  }

  let firstInvestigatorId: string | null = null;
  for (const u of demoUsers) {
    const { salt, hash } = hashPassword(u.password);
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: { passwordHash: hash, passwordSalt: salt, role: u.role },
      create: { username: u.username, passwordHash: hash, passwordSalt: salt, role: u.role },
    });
    if (u.role === "INVESTIGATOR" && !firstInvestigatorId) firstInvestigatorId = user.id;
  }

  // Backfill: every Case traced before auth existed has createdById = null.
  // Attribute them to the demo investigator rather than leaving them
  // ownerless — otherwise RBAC (added right after this commit) makes the
  // dashboard's "81 real cases" empty for anyone but a SUPERVISOR, which
  // quietly breaks both the demo and docs/PITCH.md's numbers.
  if (firstInvestigatorId) {
    const backfilled = await prisma.case.updateMany({
      where: { createdById: null },
      data: { createdById: firstInvestigatorId },
    });
    if (backfilled.count > 0) {
      console.log(`Backfilled ${backfilled.count} pre-auth cases to the demo investigator account.`);
    }
  }

  console.log(
    `Seeded ${labeledAddresses.length} labeled addresses, ${vaspRegistry.length} VASP registry entries, ${issuerRegistry.length} issuer registry entries, and ${demoUsers.length} demo accounts.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
