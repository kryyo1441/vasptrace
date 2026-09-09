import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSessionToken, verifyPassword, SESSION_COOKIE } from "@/lib/auth";

const SESSION_MAX_AGE_S = 12 * 60 * 60; // keep in sync with lib/auth.ts's SESSION_TTL_MS

export async function POST(req: Request) {
  const { username, password } = await req.json();
  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  // Same "invalid credentials" message whether the username doesn't exist
  // or the password is wrong — a distinct message for "no such user" lets
  // an attacker enumerate valid usernames.
  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const token = createSessionToken(user.id, user.role);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });

  return NextResponse.json({ ok: true, role: user.role });
}
