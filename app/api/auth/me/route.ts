import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// /api/auth/* is excluded from proxy.ts's gate (login has to be reachable
// while logged out) — this route re-checks itself rather than assuming
// coverage, same as every other route handler in the app.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ username: user.username, role: user.role });
}
