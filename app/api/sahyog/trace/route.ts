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
import { isTraceInputError, parseTraceInput, runTrace, type TraceInput } from "@/lib/trace";

function tokenMatches(req: Request): boolean {
  const expected = process.env.SAHYOG_API_TOKEN;
  if (!expected) return false; // unset = feature disabled, not "any token works"
  const got = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const NOTE =
  "Automated intake trace. recommendation is only populated from a high-confidence exchange match — it is a lead for an investigator to confirm, not an instruction to freeze or disclose automatically.";

async function traceOne(input: TraceInput) {
  const result = await runTrace(input, null, "sahyog");
  return { ...result.graph, caseId: result.caseId, warnings: result.warnings, note: NOTE };
}

// Bulk intake (added 2026-09-18) — PS 26182's "scalable architecture capable
// of handling large-volume blockchain transaction analysis," answered as a
// batch of the same per-address trace, not a new pipeline. Capped, and run
// sequentially: each chain's own client already serializes its calls through
// a single global pacing queue (lib/rateLimit.ts's withPacing), so a batch is
// exactly N single traces sharing that queue, never N times the concurrency.
// ponytail: no job queue — a big batch just makes this one request run
// longer (each item is ~1–25s; see docs/CASE_SCENARIOS.md), fine at demo
// volume. A background worker is the real answer past this cap.
const BULK_LIMIT = 20;

export async function POST(req: Request) {
  if (!tokenMatches(req)) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  if (Array.isArray(body.addresses)) {
    const items = body.addresses as unknown[];
    if (items.length === 0) return NextResponse.json({ error: "addresses must be a non-empty array" }, { status: 400 });
    if (items.length > BULK_LIMIT) {
      return NextResponse.json({ error: `Batch too large — at most ${BULK_LIMIT} addresses per call. Bitcoin especially: Blockstream's 700 req/hour limit is shared across every trace this app runs, live or batched.` }, { status: 400 });
    }
    const results = await Promise.all(
      items.map(async (item) => {
        const input = parseTraceInput(item);
        if (isTraceInputError(input)) return { error: input.error, input: item };
        try {
          return await traceOne(input);
        } catch (err) {
          return { error: (err as Error).message, address: input.address, chain: input.chain };
        }
      })
    );
    const failed = results.filter((r) => "error" in r).length;
    return NextResponse.json({ note: NOTE, total: results.length, succeeded: results.length - failed, failed, results });
  }

  const input = parseTraceInput(body);
  if (isTraceInputError(input)) {
    return NextResponse.json({ error: input.error }, { status: input.status });
  }

  try {
    return NextResponse.json(await traceOne(input));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
