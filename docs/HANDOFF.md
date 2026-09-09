# Handoff — pick up here

Paste this to an agent (or read it yourself) to resume work. Written
2026-09-09, end of the auth session.

---

Continue VASPtrace (SIH problem 26182), branch `day3-n8n-rehearsal`. Read
`docs/PLAN.md`'s "Final stretch" section (near the bottom) — that's the
authoritative priority order for what's left — and `docs/PROGRESS.md`'s most
recent changelog entries (Auth, Day 4 follow-up) for what already shipped.

**STATE**: working tree clean, everything committed. Auth + RBAC
(final-stretch item 1) is **DONE** — login gate, sessions, per-investigator
case scoping, object-level authorization on case detail / PDF / Sahyog, all
verified live. Demo accounts: `investigator` / `vasptrace-investigator-2026`,
`supervisor` / `vasptrace-supervisor-2026` (also in `README.md`). All 81
pre-auth cases were backfilled to the investigator account.

**Startup**: `npm run dev`, then log in at `localhost:3000/login`. Docker is
still down (nf_tables/kernel-module mismatch — needs a reboot). Check
`docker ps` and `uname -r` before assuming it's fixed; **ask before
rebooting**, it's the user's machine.

## Priority order

1. **n8n re-verification**, once Docker is up: confirm the live canvas still
   executes after both the Day 4 repaint *and* the new auth gate —
   specifically that `/api/n8n/trace-ack` and `/api/n8n/sahyog-ack` still
   fire with zero session. They're deliberately excluded from `proxy.ts`'s
   auth gate rather than given a shared-secret header; verify that decision
   still holds in a real run.
2. **Small untested edges** flagged during the Day 4 bug bash, still open:
   double-clicking "Re-route to X" fast (race on `Case.status`), a valid
   address submitted with the *wrong* chain selector, whitespace/casing on a
   pasted address.
3. **Full timed judge-facing dry-run**, 2-3 times with different addresses:
   paste address → live trace → graph → n8n canvas → score/recommendation →
   PDF → Sahyog route. Time it.
4. **Pitch rehearsal** — `docs/PITCH.md` is the deck source, and a
   `VASPtrace_Pitch_Deck.pptx` already exists in the repo root (check whether
   it needs updating for the auth work, which isn't reflected in it yet).
   Rehearse the item-3 differentiation story and the n8n-as-visibility-layer
   framing.
5. **Demo-day checklist** (not code): n8n owner-account recreation if the
   `n8n_data` volume gets wiped, plus a fallback recording of the n8n canvas
   executing in case live n8n flakes in front of judges.

## Gotchas from this project

All logged in `PROGRESS.md`, but worth having front-of-mind:

- **Stale Turbopack modules.** The dev server can serve a stale module (a
  Prisma client that didn't pick up `prisma generate`, or a route handler
  that didn't pick up a new export from a file it imports) even though the
  file on disk is correct. If a change that should obviously work doesn't:
  `pkill -f "next dev"` + `rm -rf .next` + restart *before* re-reading the
  diff. This has happened twice.
- **Service-worker hijack.** A leftover service worker from a different
  project ("bookish") can take over `localhost:3000` and serve a stale
  bundle. Check DevTools → Application → Service Workers if the UI ever
  looks a version behind the source.
- **This is Next.js 16** — file conventions differ from training data
  (`middleware.ts` → `proxy.ts` already bit us; the old name silently does
  nothing). Read `node_modules/next/dist/docs/` before assuming an API works
  the way you remember, per `AGENTS.md`.
- **Don't kill the dev server as "cleanup"** when finishing a task — leave it
  running, the user checks the app between turns.

Verify UI changes in the browser, and measure rather than eyeball (contrast
ratios, `scrollWidth` at 375px) — several "bugs" this project turned out to
be screenshot-tool artifacts that a real measurement disproved.
