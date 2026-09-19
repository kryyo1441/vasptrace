// Chain-of-custody log — see the AuditEvent model's comment for what the
// hash chain does and doesn't guarantee.
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "LOGIN"
  | "LOGIN_FAILED"
  | "TRACE"
  | "VIEW_CASE"
  | "DOWNLOAD_REPORT"
  | "ROUTE_SAHYOG"
  | "ROUTE_FREEZE"
  | "DELETE_CASE"
  | "VASP_RESPONSE"
  | "DRAFT_NARRATIVE"
  | "WATCH_ADD"
  | "WATCH_CHECK"
  | "SANCTIONS_SYNC"
  | "TERROR_SYNC";

const GENESIS = "GENESIS";

interface Hashable {
  prevHash: string;
  userId: string | null;
  action: string;
  caseId: string | null;
  detail: string;
  createdAt: Date;
}

// Field order is fixed here, not left to object-key order of whatever row
// shape Prisma hands back, so a verify recomputes byte-identical input.
export function auditHash(e: Hashable) {
  return createHash("sha256")
    .update(JSON.stringify([e.prevHash, e.userId, e.action, e.caseId, e.detail, e.createdAt.toISOString()]))
    .digest("hex");
}

export async function audit(userId: string | null, action: AuditAction, caseId: string | null, detail: object = {}) {
  // Read-last + insert inside one transaction: SQLite serializes writers, so
  // two concurrent events can't both chain onto the same previous row.
  return prisma.$transaction(async (tx) => {
    const last = await tx.auditEvent.findFirst({ orderBy: { id: "desc" } });
    const row = {
      prevHash: last?.hash ?? GENESIS,
      userId,
      action,
      caseId,
      detail: JSON.stringify(detail),
      // Millisecond precision: SQLite DateTime round-trips ms, not µs.
      createdAt: new Date(Math.floor(Date.now())),
    };
    return tx.auditEvent.create({ data: { ...row, hash: auditHash(row) } });
  });
}

// Returns the id of the first row whose link or hash doesn't hold, or null
// when the whole chain is intact. O(rows) — fine for a case-page check at
// demo volume; verify from a checkpoint if the log grows large.
export function verifyAuditChain(events: (Hashable & { id: number; hash: string })[]): number | null {
  let prev = GENESIS;
  for (const e of [...events].sort((a, b) => a.id - b.id)) {
    if (e.prevHash !== prev || auditHash(e) !== e.hash) return e.id;
    prev = e.hash;
  }
  return null;
}
