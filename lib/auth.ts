// Hand-rolled session auth (SIH plan: reversed into scope 2026-09-09 — see
// docs/PLAN.md's "Final stretch" section for why not next-auth). Node's
// stdlib covers the whole need: scrypt for password hashing, an
// HMAC-signed cookie for the session. No new dependency.
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/generated/prisma/client";

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  // Fail loudly at boot, not by silently signing sessions with "undefined"
  // (which would make every session forgeable by anyone who read the
  // source). See .env.example.
  throw new Error("SESSION_SECRET is not set — see .env.example. Every session cookie needs it to sign.");
}

export const SESSION_COOKIE = "vasptrace_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h — a work shift, not a "stay logged in forever" cookie.
const SCRYPT_KEYLEN = 64;

// --- Password hashing --------------------------------------------------

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const candidate = scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hash, "hex");
  // Constant-time compare — a naive `===` on the hex hash leaks timing
  // information about how many leading bytes matched.
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

// --- Session tokens ------------------------------------------------------
// Payload is signature-only verifiable (no DB round trip) — proxy.ts checks
// it on every request and this version of Next.js runs Proxy on the Node.js
// runtime, so node:crypto is available there, but keeping the check
// DB-free keeps proxy fast and doesn't couple it to Prisma's connection
// lifecycle. Full user/role lookups happen in pages/route handlers instead
// (lib/auth.ts's getCurrentUser, Node runtime guaranteed there either way).

interface SessionPayload {
  uid: string;
  role: Role;
  exp: number; // unix ms
}

function sign(data: string): string {
  return createHmac("sha256", SESSION_SECRET!).update(data).digest("base64url");
}

export function createSessionToken(userId: string, role: Role): string {
  const payload: SessionPayload = { uid: userId, role, exp: Date.now() + SESSION_TTL_MS };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expectedSig = sign(data);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// --- Server-side helpers for pages/route handlers -----------------------
// proxy.ts already turns away requests with no/invalid session cookie — the
// helpers below additionally hit the DB, which the docs explicitly warn not
// to skip: "Always verify authentication and authorization inside each
// Server Function rather than relying on Proxy alone" (a matcher change or
// refactor can silently remove Proxy's coverage of a route).

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = verifySessionToken(token);
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.uid } });
  return user;
}
