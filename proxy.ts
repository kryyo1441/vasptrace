// Auth gate (SIH plan: reversed into scope 2026-09-09 — see docs/PLAN.md's
// "Final stretch"). NOTE: this is `proxy.ts`, not `middleware.ts` —
// middleware.js was deprecated and renamed in Next.js 16
// (node_modules/next/dist/docs/.../file-conventions/proxy.md); the old name
// silently does nothing.
//
// Signature-only check here (no DB hit) — see lib/auth.ts's comment for
// why. Every page/route handler this protects also re-checks via
// getCurrentUser(), per Next's own proxy docs: a matcher misconfiguration
// or a route added outside its coverage should not be the only thing
// standing between a request and case data.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Everything except: the login page and its own API, the n8n ack
    // endpoints (called server-to-server by n8n itself with no browser
    // session — see docs/PLAN.md's "Final stretch" for why these are
    // excluded rather than given a shared-secret header), and Next's own
    // static/asset paths.
    "/((?!login|api/auth|api/n8n|_next/static|_next/image|favicon.ico).*)",
  ],
};
