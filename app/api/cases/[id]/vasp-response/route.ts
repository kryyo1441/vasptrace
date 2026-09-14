// The confirmedByVaspResponse feedback loop (day-1 placeholder, wired up
// 2026-09-14). Investigator-entered fact about what a routed VASP actually
// answered — never inferred, never fed back into VaspRegistry's seeded score.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessCase, getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";

const VALID = ["CONFIRMED", "DENIED", "NO_RESPONSE"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const kase = await prisma.case.findUnique({ where: { id } });
  if (!kase || !canAccessCase(user, kase)) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  if (kase.status !== "ROUTED") {
    return NextResponse.json({ error: "This case has no routed disclosure request to respond to" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const response = (body as { response?: string } | null)?.response;
  if (!response || !VALID.includes(response)) {
    return NextResponse.json({ error: `response must be one of ${VALID.join(", ")}` }, { status: 400 });
  }

  const updated = await prisma.case.update({
    where: { id },
    data: { vaspResponse: response, vaspRespondedAt: new Date(), confirmedByVaspResponse: response === "CONFIRMED" },
  });
  await audit(user.id, "VASP_RESPONSE", kase.id, { response });

  return NextResponse.json({ vaspResponse: updated.vaspResponse });
}
