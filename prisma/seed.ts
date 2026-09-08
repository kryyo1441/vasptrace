// Real, public seed data — no synthetic addresses.
// Sources noted per entry. Extend this array to add more.
import "dotenv/config";
import { Chain, LabelType } from "../lib/generated/prisma/client";
import { prisma } from "../lib/prisma";

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
  // --- OFAC SDN ransomware-linked address (first-ever crypto SDN listing) ---
  {
    address: "149w62rY42aZBox8fGcmqNsXUzSStKeq8C",
    chain: Chain.BITCOIN,
    labelType: LabelType.RANSOMWARE,
    entityName: "SamSam ransomware cash-out (Khorashadizadeh/Ghorbaniyan, Iran)",
    source: "OFAC SDN List, designated 2018-11-28",
  },
];

const vaspRegistry: {
  name: string;
  fiuindRegistered: boolean;
  hasIndiaNodalOfficer: boolean;
  responseReliabilityScore: number;
}[] = [
  // Status reflects public FIU-IND registration info as of the seed date.
  // fiuindRegistered/hasIndiaNodalOfficer are best-effort from public
  // reporting — verify against the live FIU-IND list before real use.
  { name: "WazirX", fiuindRegistered: true, hasIndiaNodalOfficer: true, responseReliabilityScore: 4 },
  { name: "CoinDCX", fiuindRegistered: true, hasIndiaNodalOfficer: true, responseReliabilityScore: 5 },
  { name: "ZebPay", fiuindRegistered: true, hasIndiaNodalOfficer: true, responseReliabilityScore: 4 },
  { name: "CoinSwitch", fiuindRegistered: true, hasIndiaNodalOfficer: true, responseReliabilityScore: 4 },
  { name: "Giottus", fiuindRegistered: true, hasIndiaNodalOfficer: true, responseReliabilityScore: 3 },
  { name: "Unocoin", fiuindRegistered: true, hasIndiaNodalOfficer: true, responseReliabilityScore: 3 },
  { name: "BuyUcoin", fiuindRegistered: true, hasIndiaNodalOfficer: true, responseReliabilityScore: 2 },
  { name: "Bitbns", fiuindRegistered: true, hasIndiaNodalOfficer: true, responseReliabilityScore: 3 },
  { name: "KoinBX", fiuindRegistered: true, hasIndiaNodalOfficer: false, responseReliabilityScore: 2 },
  { name: "Binance", fiuindRegistered: true, hasIndiaNodalOfficer: false, responseReliabilityScore: 2 },
  { name: "Coinbase", fiuindRegistered: false, hasIndiaNodalOfficer: false, responseReliabilityScore: 3 },
  { name: "Bitfinex", fiuindRegistered: false, hasIndiaNodalOfficer: false, responseReliabilityScore: 1 },
  { name: "Kraken", fiuindRegistered: false, hasIndiaNodalOfficer: false, responseReliabilityScore: 2 },
  { name: "KuCoin", fiuindRegistered: false, hasIndiaNodalOfficer: false, responseReliabilityScore: 1 },
  { name: "OKX", fiuindRegistered: true, hasIndiaNodalOfficer: false, responseReliabilityScore: 2 },
  { name: "MEXC", fiuindRegistered: false, hasIndiaNodalOfficer: false, responseReliabilityScore: 1 },
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

  console.log(
    `Seeded ${labeledAddresses.length} labeled addresses and ${vaspRegistry.length} VASP registry entries.`
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
