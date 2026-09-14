// Run: npx tsx lib/sanctions.test.ts
import assert from "node:assert";
import { parseSdnCsv } from "./sanctions";

// A row with a single crypto address, real-shaped SDN.CSV columns
// (ent_num,name,type,programs,...,remarks — remarks is the last column here).
const row = (name: string, remarks: string) =>
  `1234,"${name}",-0- ,"IRAN] [SDGT",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,"${remarks}"`;

// A Bitcoin address parses to the BITCOIN chain, address kept as-is (case-sensitive).
{
  const out = parseSdnCsv(row("TEST ENTITY", "Digital Currency Address - XBT 1AVdaBkxdzHF6yfDGJmpsCkHYYqXakPHPH"));
  assert.equal(out.length, 1);
  assert.equal(out[0].chain, "BITCOIN");
  assert.equal(out[0].address, "1AVdaBkxdzHF6yfDGJmpsCkHYYqXakPHPH");
  assert.equal(out[0].name, "TEST ENTITY");
}

// An ETH address is lowercased, since lib/tracers/ethereum.ts normalizes the
// same way — a mismatched case here would silently never match a live trace.
{
  const out = parseSdnCsv(row("TEST", "Digital Currency Address - ETH 0x7FF9cFad3877F21d41Da833E2F775dB0569eE3D9"));
  assert.equal(out[0].chain, "ETHEREUM");
  assert.equal(out[0].address, "0x7ff9cfad3877f21d41da833e2f775db0569ee3d9");
}

// A USDT listing produces one row per chain this tool traces (ETH + TRON),
// not a single ambiguous "USDT" chain.
{
  const out = parseSdnCsv(
    row(
      "TEST",
      "Digital Currency Address - USDT TNiq9AXBp9EjUqhDhrwrfvAA8U3GUQZH81; alt. Digital Currency Address - USDT 0x7FF9cFad3877F21d41Da833E2F775dB0569eE3D9"
    )
  );
  assert.equal(out.length, 2);
  assert.ok(out.some((a) => a.chain === "TRON" && a.address === "TNiq9AXBp9EjUqhDhrwrfvAA8U3GUQZH81"));
  assert.ok(out.some((a) => a.chain === "ETHEREUM"));
}

// A currency this tool doesn't trace (XMR) yields nothing.
{
  const out = parseSdnCsv(row("TEST", "Digital Currency Address - XMR 44dZUJ7w1T3fKAvFW8XyXUVoAGSbFvXef2wcbnsjNKGWYo"));
  assert.equal(out.length, 0);
}

// A malformed/too-short address for its claimed chain is dropped, not
// force-fed to a validator downstream that assumes well-formed input.
{
  const out = parseSdnCsv(row("TEST", "Digital Currency Address - XBT notavalidaddress"));
  assert.equal(out.length, 0);
}

// Multiple rows dedupe by chain+address (a real SDN quirk: the same address
// sometimes appears on more than one entity's line over time).
{
  const csv = [
    row("ENTITY A", "Digital Currency Address - XBT 1AVdaBkxdzHF6yfDGJmpsCkHYYqXakPHPH"),
    row("ENTITY B", "Digital Currency Address - XBT 1AVdaBkxdzHF6yfDGJmpsCkHYYqXakPHPH"),
  ].join("\n");
  assert.equal(parseSdnCsv(csv).length, 1);
}

// A quoted field containing a comma (a real SDN name shape) doesn't split
// the row early and corrupt the remarks column.
{
  const csv = `1,"BANK, NATIONAL",-0- ,"CUBA",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,"Digital Currency Address - XBT 1AVdaBkxdzHF6yfDGJmpsCkHYYqXakPHPH"`;
  const out = parseSdnCsv(csv);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "BANK, NATIONAL");
}

console.log("sanctions self-check passed");
