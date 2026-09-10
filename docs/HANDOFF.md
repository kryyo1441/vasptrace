# Handoff — pick up here

Paste this to an agent (or read it yourself) to resume work. Written
2026-09-09; **substantially rewritten 2026-09-10** after the n8n and
deployment session.

---

Continue VASPtrace (SIH problem 26182), branch `day3-n8n-rehearsal`. Read
`docs/PLAN.md`'s "Final stretch" section (near the bottom) — that's the
authoritative priority order for what's left — and `docs/PROGRESS.md`'s most
recent changelog entries for what already shipped.

**SUBMISSION IS 2026-09-11 — one day out.** Realistically one or two working
windows. What is left is *rehearsal*, not building: the timed dry-run and
the pitch. Everything else in the plan is done. Resist adding scope.

**STATE**: working tree clean, everything committed. Final-stretch items
**1, 2 and 3 are all done** — auth + RBAC, n8n re-verification, and the
small untested edges. Demo accounts: `investigator` /
`vasptrace-investigator-2026`, `supervisor` / `vasptrace-supervisor-2026`
(also in `README.md`). All 82 cases belong to the investigator account; the
supervisor has 0, so both logins show 82 on the dashboard.

**Two branches, and the difference matters:**

- **`day3-n8n-rehearsal` — the demo branch. SQLite. Use this one.** The
  offline fallback in `docs/DEMO_SCRIPT.md` (if the venue network dies,
  walk a stored case at `/cases` — full graph, recommendation and PDF with
  zero API calls) only works because `dev.db` is a local file.
- **`vercel-postgres` — the deploy branch. Prisma Postgres.** Code complete
  and locally verified, but **nothing has ever been deployed and the
  migration has never been applied to a real database** — it needs a
  connection string the user has to create. See `docs/DEPLOY.md`, which
  states exactly what is and isn't verified. **Do not merge it into the
  demo branch before demo day.**

**Don't "clean up" the case count.** The DB is at **82** cases: the 81
backfilled ones plus one the *user* traced themselves
(`bc1qydntupzckl7m09a5mvaqsh5wvhexkt0rrsfjth`, the first address in the
Bitcoin dataset below — 54 nodes, HIGH risk, both typology flags). It looks
like leftover test pollution and is not. Verify who created a case before
deleting anything; test cases created during a session should be deleted at
the end of that session, but this one is the user's own work.

**Startup**: `npm run dev`, then log in at `localhost:3000/login`.

**Docker is fixed** (was down for most of the build with an
nf_tables/kernel-module mismatch). The reboot happened: the running kernel
is now `6.18.50-2-lts` and `/lib/modules` has a matching tree. If the daemon
is merely stopped, `sudo modprobe nf_tables && sudo systemctl start docker`
brings it back — that needs the user's password, this session can't supply
it. Only if `uname -r` disagrees with `ls /lib/modules/` again is a reboot
needed, and **ask first**, it's the user's machine.

## Priority order

0. **Raise `NODE_BUDGET` (60 → ~150) — TESTED 2026-09-10, REJECTED. Don't
   redo it.** The constant stays at 60 and no code changed. The premise
   below was that all three depth-5 candidates that reached no VASP were
   stopped by the node-budget cap rather than shown to be exchange-free.
   Measured: at budget 150, **0 of 4 converted**, two of the three
   *exhausted* their whole search space at 89 and 64 nodes with no
   truncation at all and still hit zero labels, and the good demo address
   (`3Frm…`) gained nothing but **+32s** (25.5s → 57.7s) for the same
   Binance hit, same HIGH risk, same flags. Across the 82 existing `Case`
   rows only **2 traces (2.4%) ever hit the cap**, both Ethereum, and one of
   those two still produced a recommendation — so ETH/TRON aren't
   budget-bound either. `FANOUT_CAP` is dead for the same reason. Full
   numbers in `PROGRESS.md`'s 2026-09-10 entry. **The only lever left on
   VASP hit-rate is BTC label coverage** (2 of 15 seeded exchange addresses
   are Bitcoin, both Binance) — that's the "second lever" noted further
   down, and it needs the user's call.

   Also settled while measuring: the "4-5s trace timing the demo script
   assumes" was unsourced — no demo-script file exists and no timing figure
   appeared anywhere in `docs/`. Measured, and it's **good news for the
   demo**: the scripted judge-facing path is **~1s**, not 4-5s
   (`0x6eedf…`/WazirX at depth 1 = 1.4s; curated BTC at depth 1 = 0.9s) —
   the curated addresses are one hop from a labeled exchange, so the trace
   stops on the label immediately. Only the *deep dataset* addresses are
   slow: `3Frm…` at depth 5 is **~25s** because it explores 60 unlabeled
   nodes at ~0.25-0.45s each (`withPacing` serializes one API call per
   chain). So item 3's dry-run is only pacing-constrained if it demos
   `3Frm…` — the trade is fast-but-clean-1-hop vs. 25s of dead air for the
   messy multi-hop laundering visual.

1. **n8n re-verification — DONE 2026-09-10.** Both ack routes fire with
   **zero session** through `proxy.ts` (`200` each), the Day 3 IF-node fix
   survived, and the `n8n_data` volume persisted so both workflows were
   still imported, Published and the login still valid.

   **The one finding that changes the demo**, and it is not a small one:
   `PITCH.md` §2.4/§9 claims judges "watch the automation execute in real
   time on a live canvas". With an **active** workflow on the production
   `/webhook/` URLs that is false — it runs headless, and all you can show
   is the Executions list after the fact. It *is* true in **test mode**:
   point `.env` at `/webhook-test/` and click **Execute workflow** to arm
   the canvas, and the editor renders the run — green checks on every node,
   green edges labelled "1 item", the **true** branch flowing into "Push
   result to VASPtrace dashboard", the false branch left grey. Verified
   twice, once end-to-end from a real `POST /api/trace`.

   The cost, measured: **n8n's test webhook is one-shot per arming**, and
   the two workflows arm independently — so the trace and the Sahyog click
   each need their own click, before each trigger. A second call without
   re-arming returns 404 and the app shows its "n8n unreachable" warning
   banner (harmless, but visible). `docs/DEMO_SCRIPT.md` puts both arming
   steps where they belong. `.env` is currently on the **production** URLs,
   which is the safe default; the swap is one `sed`, in the runbook.
2. **Small untested edges — DONE 2026-09-10.** All three tested live. The
   double-click "race" was a non-issue (the status write is idempotent, not
   read-modify-write — verified with two simultaneous POSTs). The other two
   were real and are fixed: a valid address against the wrong chain selector
   now says which chain it actually is, and whitespace/`0X`-casing on a
   pasted address is trimmed/accepted at the API boundary. Validators moved
   to `lib/address.ts` with a self-check (`npx tsx lib/address.test.ts`).
   See `PROGRESS.md`'s 2026-09-10 entry.

   *If there's spare time only* (not worth a demo window): the wrong-chain
   error tells the user to switch the selector, but the server already knows
   the right chain via `detectChain` — the client could just switch it for
   them. Deliberately not built.
3. **Full timed judge-facing dry-run — THE TOP PRIORITY NOW.** 2-3 times
   with different addresses: paste address → live trace → graph → n8n canvas
   → score/recommendation → PDF → Sahyog route. Time it.

   **`docs/DEMO_SCRIPT.md` is what to run** — written 2026-09-10, it is the
   step-by-step runbook with measured timings, both n8n arming steps, a
   failure table and the reset procedure. It did not exist before; earlier
   notes referring to "the demo script" were referring to nothing. Run it
   end to end once privately, then delete the case rows it creates (the
   reset section says how, and warns which case *not* to delete).
4. **Pitch rehearsal** — `docs/PITCH.md` is the deck source, and a
   `VASPtrace_Pitch_Deck.pptx` already exists in the repo root (check whether
   it needs updating for the auth work, which isn't reflected in it yet).
   Rehearse the item-3 differentiation story and the n8n-as-visibility-layer
   framing.
5. **Demo-day checklist** (not code): n8n owner-account recreation if the
   `n8n_data` volume gets wiped, plus a fallback recording of the n8n canvas
   executing in case live n8n flakes in front of judges. The recording is
   worth more than it looks — it is also the only way the n8n story travels
   with a *deployed* link, since n8n cannot follow the app to Vercel.

6. **Vercel deploy — optional, and last.** Branch `vercel-postgres`, code
   complete, never deployed. `docs/DEPLOY.md` has the six remaining steps
   and is explicit about what is unverified. Roughly 90 minutes including
   the 82-row data import. **Only if the dry-run and the pitch are already
   done** — it is new scope that appears nowhere in `PLAN.md`, and three
   things do not survive the move: n8n (stays local), `withPacing`'s
   cross-request pacing (serverless runs each request in its own instance,
   so Day 2's Etherscan `NOTOK` mode can return under real concurrency), and
   deep traces (pin the deployed demo to depth ≤3; `3Frm…` at depth 5
   measured ~25s against a 60s function ceiling).

## The Bitcoin dataset (`btc_wallets_data.csv`, added 2026-09-09)

The user added a CSV of ~8.5k suspicious Bitcoin wallets at the repo root
(`address,hash160,n_tx,n_unredeemed,total_received,total_sent,final_balance`).
It is **not** wired into the app and doesn't need to be — it's a source of
demo addresses. Already profiled and sample-tested against the real tracer;
don't redo this from scratch:

- **8,526 rows / 8,506 unique** (20 exact duplicate rows — harmless, just
  don't report the raw row count as a wallet count).
- **4,660 (55%) have `total_sent = 0`.** The tracer follows *outgoing*
  transfers, so these render a single suspect node and nothing else. Filter
  them out before picking demo addresses.
- **Very high tx counts are unusable**, even when the address is genuinely
  interesting. Blockstream returns only ~25 recent txs, so anything older is
  invisible. Concrete case: `1FfmbHfnpaZjKFvyi1okTjJJusN455paPH` is a real
  counterparty of the seeded SamSam ransomware address, but has 969 txs — the
  tracer sees zero outgoing in its window and returns an empty graph. A real
  link that cannot be demoed. Prefer 3-200 txs; 3-25 is safest (the wallet's
  whole history fits inside the API window).
- **Use max depth 5, not 3.** At depth 3, eight of eight sampled candidates
  produced good graphs and typology flags but reached no labeled address. At
  depth 5, one of four reached Binance.

**Best demo address found in the dataset:**
`3FrmCRcGKiTATfreBDM9F17yAUDoDsnWeA` — Bitcoin, **max depth 5**. Produces 60
nodes, HIGH risk, FAN_OUT + PEEL_CHAIN, reaches **Binance (cold wallet) at
hop 4** with a real recommendation, so the full path (recommendation → PDF →
Sahyog routing) is demonstrable. Backups that give good graphs and flags but
end at the "no VASP reached" state: `155Yv6Hmzs5RT8j6uZAzfWzecvV9FDyu6k`,
`1CYYS3R6CKD43nCxFbqvEvjr3VUScKswBw`, `3P9WebHkiDxCi8LDXiRQp8atNEagcQeRA3`.
Note these are *live* addresses — re-verify them before demo day, the same
drift caution `docs/DEMO_ADDRESSES.md` already makes for the curated set.

**Why BTC recommendations are rare** (worth understanding before assuming
something is broken): only **2 of the 15 seeded exchange addresses are
Bitcoin**, both Binance (`prisma/seed.ts`). A BTC trace can only produce a
recommendation if it routes into one of those. ETH/TRON have far more
labels, which is why they hit far more often. The second lever after the
node budget is seeding more BTC exchange addresses — harder than it was for
ETH, since there's no Etherscan-style public name-tag source for Bitcoin, so
each address needs individual verification (same bar as the existing seed:
never add a label without verifying it).

**How to test dataset addresses without polluting the demo DB**: call
`traceBitcoin` from `lib/tracers/bitcoin.ts` directly in a throwaway `tsx`
script rather than hitting `POST /api/trace` — the API route persists a
`Case` row, the library function doesn't. The script has to live inside the
project (the `@/` path aliases don't resolve from outside it); delete it
afterwards.

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
  running, the user checks the app between turns. (Stopped on request at the
  end of the 2026-09-10 session; restart with `npm run dev`.)
- **`recommendedVaspId` holds a VASP *name*, not an id.**
  `app/api/trace/route.ts` writes `recommendation.top.vaspName` into it. The
  column is misnamed and `app/cases/page.tsx`'s `vaspName.get(...)` lookup
  therefore always misses — the `?? c.recommendedVaspId` fallback is what
  renders the name, so the output is correct by accident. Left alone
  deliberately (renaming costs a migration for zero behaviour change), but
  don't "fix" the fallback without understanding it, and don't assume the
  column is a foreign key. `Case.createdById` *is* a real FK.
- **n8n test webhooks are one-shot.** Click "Execute workflow" before *every*
  trigger, and the two workflows arm separately. See item 1 above.

Verify UI changes in the browser, and measure rather than eyeball (contrast
ratios, `scrollWidth` at 375px) — several "bugs" this project turned out to
be screenshot-tool artifacts that a real measurement disproved.
