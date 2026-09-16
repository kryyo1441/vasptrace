// Automated intake for the Sahyog Portal — problem statement 26182 asks the
// system to "automatically analyze suspect cryptocurrency wallet addresses
// reported during investigations on the Sahyog Platform" and "integrate
// Sahyog with blockchain intelligence APIs." There is no public Sahyog API to
// integrate against yet (same honesty as app/api/cases/[id]/sahyog's outbound
// routing), so this is the inbound half of that integration, shaped to be
// wired to one when it exists: a real trace, run and persisted exactly like
// the UI's own /api/trace, reachable by a machine caller instead of a signed
// session.
//
// Bearer-token gated (same pattern as app/api/watches/check-all, and
// excluded from proxy.ts's session gate the same way — see proxy.ts's
// comment) rather than session-gated, because Sahyog has no human logged into
// this app. `createdById: null` on the resulting Case is the accurate
// representation of that: no investigator authored this trace, one has to
// pick it up. It still appears on /cases for a SUPERVISOR (who sees every
// case) so it can be triaged and assigned, same as it would for a
// human-initiated trace with no owner.
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { isTraceInputError, parseTraceInput, runTrace } from "@/lib/trace";

function tokenMatches(req: Request): boolean {
  const expected = process.env.SAHYOG_API_TOKEN;
  if (!expected) return false; // unset = feature disabled, not "any token works"
  const got = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!tokenMatches(req)) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const input = parseTraceInput(body);
  if (isTraceInputError(input)) {
    return NextResponse.json({ error: input.error }, { status: input.status });
  }

  try {
    const result = await runTrace(input, null, "sahyog");
    return NextResponse.json({
      ...result.graph,
      caseId: result.caseId,
      warnings: result.warnings,
      // Only an exact label match ever drives a real disclosure
      // recommendation (lib/scoring.ts) — restated here because this
      // response may feed an automated routing decision on the Sahyog side,
      // where that constraint is easy to lose without the UI around it.
      note: "Automated intake trace. recommendation is only populated from a high-confidence exchange match — it is a lead for an investigator to confirm, not an instruction to freeze or disclose automatically.",
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
