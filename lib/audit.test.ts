// Run: npx tsx lib/audit.test.ts
import assert from "node:assert";
import { auditHash, verifyAuditChain } from "./audit";

function row(prevHash: string, action: string) {
  return { prevHash, userId: "u1", action, caseId: null, detail: "{}", createdAt: new Date(0) };
}

// A hash depends on every field, including prevHash — the chain link.
{
  const r1 = { ...row("GENESIS", "LOGIN"), id: 1 };
  const h1 = auditHash(r1);
  const chain = [{ ...r1, hash: h1 }];
  assert.equal(verifyAuditChain(chain), null, "a correctly-hashed single-row chain verifies");
}

// Tampering with an event's own field breaks its own hash.
{
  const r1 = { ...row("GENESIS", "LOGIN"), id: 1 };
  const h1 = auditHash(r1);
  const tampered = [{ ...r1, action: "LOGIN_FAILED", hash: h1, id: 1 }]; // hash now stale
  assert.equal(verifyAuditChain(tampered), 1);
}

// Tampering with row 1 breaks row 2's link even though row 2 itself is untouched.
{
  const r1 = { ...row("GENESIS", "LOGIN"), id: 1 };
  const h1 = auditHash(r1);
  const r2 = { ...row(h1, "TRACE"), id: 2 };
  const h2 = auditHash(r2);
  const good = [{ ...r1, hash: h1 }, { ...r2, hash: h2 }];
  assert.equal(verifyAuditChain(good), null);

  const r1Edited = { ...r1, action: "LOGIN_FAILED" }; // hash field kept as h1 — now wrong for its own content
  const broken = [{ ...r1Edited, hash: h1 }, { ...r2, hash: h2 }];
  assert.equal(verifyAuditChain(broken), 1, "the edited row itself fails first, not the row after it");
}

// Order-independence: verifyAuditChain sorts by id, so passing rows out of
// insertion order still verifies correctly.
{
  const r1 = { ...row("GENESIS", "LOGIN"), id: 1 };
  const h1 = auditHash(r1);
  const r2 = { ...row(h1, "TRACE"), id: 2 };
  const h2 = auditHash(r2);
  const out_of_order = [{ ...r2, hash: h2 }, { ...r1, hash: h1 }];
  assert.equal(verifyAuditChain(out_of_order), null);
}

console.log("audit self-check passed");
