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
