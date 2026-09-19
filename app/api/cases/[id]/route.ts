// Delete a case (added 2026-09-18, from the dashboard's trash button).
//
// Deletes the Case row only — never its AuditEvent rows. The audit log is
// hash-chained (lib/audit.ts): each row's prevHash is the literal previous
// row's hash, so removing rows from the middle breaks every hash after them.
// That exact mistake broke the chain at #250 on 2026-09-18. AuditEvent.caseId
// is a plain string, not a foreign key, so the history survives the case and
// the deletion itself is appended as one more event, with a snapshot of what
// was deleted — chain of custody for the removal, not a silent disappearance.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessCase, getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const kase = await prisma.case.findUnique({ where: { id } });
  // Same object-level rule as viewing: an investigator can delete their own
  // cases, a supervisor any. 404 either way, so a guessed id doesn't confirm
  // someone else's case exists.
  if (!kase || !canAccessCase(user, kase)) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  await prisma.case.delete({ where: { id } });
  await audit(user.id, "DELETE_CASE", kase.id, {
    address: kase.address,
    chain: kase.chain,
    status: kase.status,
    riskLevel: kase.riskLevel,
    recommendedVasp: kase.recommendedVaspId,
    tracedAt: kase.createdAt.toISOString(),
    createdById: kase.createdById,
  });

  return NextResponse.json({ deleted: id });
}
