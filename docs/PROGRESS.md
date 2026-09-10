# VASPtrace — progress

Status against [`PLAN.md`](./PLAN.md), item numbers match. Update this file
whenever a plan item's status changes — append to the changelog, don't rewrite
history.

## Status

| # | Item | Status |
|---|------|--------|
| 1 | Multi-chain tracer | **Done** — Ethereum, Bitcoin (Blockstream), Tron (Tronscan) all live. Shared BFS engine (`lib/tracers/bfs.ts`), thin per-chain adapters. |
| 2 | Labeled address DB | **Done** — real seed data (exchange hot wallets, Tornado Cash, OFAC SDN, one Tron exchange address). |
| 3 | Legal-actionability scoring | **Done** — `lib/scoring.ts`, wired into the trace response, rendered on `/` and the case detail page. |
| 4 | Confidence scoring (high/medium/low) | **Done** — `lib/clustering.ts`: medium = forwards ≥80% of value to a known exchange, low = fan-in from ≥3 senders that forwards onward. Excluded from VASP recommendation (only exact-match routes a disclosure request). |
| 5 | Graph visualization | **Done** — force-directed graph, color coding, click → detail sheet, edge tooltips, per-chain unit formatting (ETH/BTC/TRX). Day 4: custom node paint (suspect glow, flag rings, on-canvas labels), curved links with directional particles, and a per-trace legend. |
| 6 | n8n workflow visualization | **Done, rehearsed live** — `docker-compose.yml` + two workflows in `n8n/workflows/`, fire-and-forget notify (`lib/n8n.ts`) from the trace and Sahyog routes. n8n is optional and never blocks/fails either flow — verified live with an unreachable webhook URL. Both workflows also run for real against `n8nio/n8n:latest`: imported, activated, and confirmed on the canvas from a real trace and a real Sahyog click (Day 3 — fixed a dead `typeVersion: 1` IF node and a webhook `body`-unwrap bug found only by running it). |
| 7 | Case dashboard | **Done** — every trace persists as a `Case` (`/api/trace`), listed at `/cases`, each row links to a detail page at `/cases/[id]`. |
| 8 | PDF report | **Done** — `@react-pdf/renderer`, `app/api/cases/[id]/report/route.ts`, renders entirely from the persisted `Case.traceResult` (no re-trace). |
| 9 | Mocked Sahyog routing | **Done** — `app/api/cases/[id]/sahyog/route.ts` + `SahyogButton`, flips `Case.status` to `ROUTED`, shows the simulated payload inline with a "Simulated integration" badge. |
| 10 | Typology/pattern flags | **Done** — `lib/typology.ts`, flags rendered directly on graph edges/nodes plus a summary badge row. |
| — | Auth + RBAC | **Done (added scope, 2026-09-09)** — not one of the ten original items; day 1 scoped it out as "single-user demo is fine" and that was reversed. Login gate (`proxy.ts` + `lib/auth.ts`), per-investigator case scoping, object-level authorization on case detail / PDF / Sahyog. See the 2026-09-09 "Auth" changelog entry. |

Remaining out-of-scope items (bridge correlation placeholder,
`confirmedByVaspResponse`) are still correctly out of scope — no action
needed there yet. Auth *was* on that list and is no longer: see above.

## Changelog

### 2026-09-07 — Day 1
- Scaffolded Next.js + shadcn + Prisma.
- Built the live Ethereum tracer (`lib/tracers/ethereum.ts` + `lib/etherscan.ts`),
  BFS hop-by-hop with fixed fanout/node-budget caps (see `ponytail:` comments
  there for the tradeoff).
- Force-directed graph view with color coding and click-to-inspect.
- Built legal-actionability scoring (`lib/scoring.ts`): score = FIU-IND
  registration + India nodal officer + reliability − hop distance. Recommended
  VASP + runner-ups rendered on the trace results page with the score
  breakdown visible (not just a risk badge) so it's auditable, not a black box.
  Self-check: `npx tsx lib/scoring.test.ts`.
- Built typology flags (`lib/typology.ts`): rule-based fan-out (≥3
  destinations), peel chain (2 destinations, one leg ≥4x the other), rapid
  mixer hop (mixer node reached within 2 hops). Rendered directly on the
  graph — flagged edges get a distinct color/thicker line, flagged nodes are
  larger — plus a summary badge row above the graph, per the differentiation
  note in `PLAN.md` (annotate where the pattern happens, not just a badge
  list). Self-check: `npx tsx lib/typology.test.ts`.
- Built the case dashboard (`app/cases/page.tsx`): every successful trace
  now persists a `Case` row from `/api/trace` (status `TRACED`, risk level,
  recommended VASP, typology flags, full trace JSON), listed in a plain
  HTML table (skipped `@tanstack/react-table`/shadcn DataTable — not an
  installed dependency and a bare `<table>` covers a sort-free list, per
  ladder rung 4). Added `deriveRiskLevel` (`lib/scoring.ts`): rule-based on
  the same node kinds/typology flags the tracer already computes —
  DARKNET/RANSOMWARE reached → CRITICAL, MIXER reached or ≥2 typology flags
  → HIGH, any flag → MEDIUM, else LOW. Nav links added both ways (`/` ↔
  `/cases`). Self-check: `npx tsx lib/scoring.test.ts`. Verified live: ran a
  real trace against the API, confirmed the row appeared on `/cases` with
  the correct risk badge.

### 2026-09-07 — Day 1, continued

All ten `PLAN.md` items now have a status other than "not started."

- **Item 1 (Bitcoin/Tron tracers)**: extracted the Ethereum tracer's BFS
  loop into a shared engine (`lib/tracers/bfs.ts`) so each chain is a thin
  adapter (`lib/tracers/{ethereum,bitcoin,tron}.ts`) over
  fetch-outgoing-transfers + normalize-address. Bitcoin via Blockstream's
  Esplora API (keyless), Tron via Tronscan (keyless at demo volume,
  `TRONSCAN_API_KEY` optional). Added a real Tron seed label
  (`TXFBqBbqJommqZf7BV8NNYzePh97UmJodJ` → Bitfinex, verified via Tronscan's
  own `addressTag` field, ~$471M USDT balance). Fixed a real bug caught by
  review: `prisma.case.create` was hardcoding `chain: "ETHEREUM"` for every
  trace regardless of which chain actually ran — now uses `graph.chain`.
  Graph value formatting (`components/graph-view.tsx`) is now per-chain
  (wei/satoshi/sun → ETH/BTC/TRX) instead of assuming 18 decimals. Verified
  live: real traces on all three chains, dashboard shows the correct chain
  per case.
- **Item 4 (confidence tiers)**: `lib/clustering.ts` — medium confidence
  ("clustering heuristic match" per the plan's own wording) when a node
  forwards ≥80% of its outgoing value to a known high-confidence exchange;
  low ("pattern-based guess") when ≥3 distinct addresses fan into a node
  that forwards onward, with no specific attribution. `recommendVasp`
  (`lib/scoring.ts`) now explicitly requires `confidence === "high"` — a
  medium/low guess can surface for investigator attention but can never
  become the basis for an actual disclosure-request recommendation.
  Self-check: `npx tsx lib/clustering.test.ts`. Verified live: a real Tron
  trace's root node got flagged medium-confidence "Bitfinex (inferred
  deposit address)" because it forwards 100% of its value to the seeded
  Bitfinex hot wallet.
- **Items 8/9 (PDF report, mocked Sahyog routing)**: built a shared surface
  first — `app/cases/[id]/page.tsx`, since neither had anywhere to hang off
  of. PDF via `@react-pdf/renderer` (confirmed React 19-compatible;
  `renderToBuffer` fails under raw `tsx` due to an ESM package-exports quirk
  in `@react-pdf/hyphenate`, but works fine under Next's actual bundler —
  verified with a real downloaded PDF, checked by rendering it). Report
  renders entirely from the persisted `Case.traceResult`, no re-trace.
  Sahyog button POSTs to `app/api/cases/[id]/sahyog/route.ts`, which builds
  the simulated disclosure payload, flips `Case.status` to `ROUTED`, and
  returns the payload for inline display next to a "Simulated integration"
  badge — no Sonner/toast dependency added. Verified live end-to-end: ran a
  trace, opened the case, downloaded and read the PDF, clicked the Sahyog
  button, confirmed `ROUTED` status propagated to the dashboard, the detail
  page, and a re-downloaded PDF.
- **Item 6 (n8n)**: kept strictly optional and non-blocking, per `PLAN.md`'s
  explicit warning that n8n must not become a single point of failure.
  `lib/n8n.ts` fire-and-forget notify (2s timeout, try/catch, returns a soft
  warning string instead of throwing) called from the trace route and the
  Sahyog route, both after the real work is already done and persisted.
  `docker-compose.yml` + `n8n/workflows/{tracing-pipeline,sahyog-mock-routing}.json`
  mirror the plan's described node chains. Two local ack endpoints
  (`app/api/n8n/{trace,sahyog}-ack/route.ts`) close the loop without any
  external network dependency. `docs/ARCHITECTURE.md` written (deliverable
  5), explaining the visibility-layer design choice. **Verification gap**:
  no docker daemon in this environment, so the actual n8n canvas/workflow
  import was never run — only the JSON files' shape was checked, not a real
  n8n import. What *was* verified live: both webhook calls degrade
  correctly (trace and Sahyog routing both complete in ~1s and return a
  soft warning) when pointed at an unreachable URL, which is the property
  the plan actually cares about.
- `README.md` rewritten from the create-next-app default (setup, seed, n8n,
  self-checks). Added `.env.example` (`.env*` was blanket-gitignored, added
  a `!.env.example` exception).

### 2026-09-08 — Day 2: hardening & demo-safety

- **Live-demo risk (pre-verified demo addresses)**: wrote
  `docs/DEMO_ADDRESSES.md` — 3 addresses per chain (9 total), each one hop
  from a labeled exchange, all confirmed live via `POST /api/trace`. Picked
  so the qualifying transfer sits at the front of that address's own
  recent-tx window (Etherscan/Blockstream/Tronscan only return the most
  recent N), so they stay stable even if the address transacts more before
  judging day — verified this explicitly (checked each candidate's own
  outgoing history, not just the exchange's incoming side, before picking
  it). The WazirX ETH pick doubles as the best headline demo: highest
  recommendation score (8) of any seed VASP, and dormant since 2024 so it
  won't drift. Also documents which address *not* to use (an extremely
  high-frequency BTC sweeper whose exchange payment is already outside its
  own 25-tx Blockstream window).
- **Seed data breadth**: `prisma/seed.ts` — added 9 more labeled addresses.
  3 VASPs already in `vaspRegistry` (Kraken, KuCoin, OKX) had zero labeled
  addresses on any chain, meaning a live trace could never actually
  recommend them; same gap for Bitbns and MEXC. Sourced from Etherscan's
  server-rendered "Public Name Tag" (same provenance as the original
  entries — scraped and read directly, not from memory) and from
  Tronscan's public hot-wallet directory (`api/hot/exchanges`, cross-checked
  against each address's own `api/account` `addressTag` field). Verified
  live end-to-end for 3 of the 9 (Kraken/ETH, WazirX/TRON, Bitbns/TRON) —
  found real senders, confirmed the trace reaches the new label at high
  confidence and `recommendVasp` returns the matching VASP. Re-ran
  `npx tsx prisma/seed.ts`: 18 labeled addresses total (was 9).
- **Confidence-clustering validation** (`lib/clustering.ts`): ran several
  more real traces (beyond the original small sample) at depth 3-4 on busy
  addresses. Medium tier (80% forward ratio) fired correctly on every
  sender→exchange case tested. Low tier (≥3 fan-in senders) fired
  selectively (3 of 50 nodes in one busy trace) rather than over-triggering
  — and on inspection, two of those three turned out to be a real Etherscan-
  tagged "Coinrail Hacker" address and a real tagged "Fake_Phishing1431"
  address, neither in our seed data. That's the heuristic correctly
  surfacing a genuine consolidation/laundering shape from behavior alone,
  with no label to go on — good validation, no threshold change made.
  Separately noted for a future pass: `lib/typology.ts`'s `FAN_OUT` flag
  (≥3 destinations) fired on nearly every node in the same busy trace —
  real wallets routinely have 3+ historical counterparties, so as currently
  tuned it reads as "this address exists" more than "this address is
  smurfing." Not touched today since it wasn't in today's scope
  (`lib/clustering.ts` specifically was), but worth a threshold look on a
  future pass.
- **API pacing under concurrent traces** (Priority 4) — found and fixed a
  real bug, not just confirmed a non-issue. `lib/tracers/bfs.ts`'s fixed
  delay only paced hops *within one trace*; two concurrent traces each
  started immediately with no shared pacing. Reproduced live: 6 concurrent
  Ethereum traces produced real Etherscan `NOTOK` errors, and — importantly
  — so did 6 truly simultaneous raw `curl` calls with the same API key and
  no app involved at all, which showed the real constraint is concurrent
  in-flight requests, not requests/sec. A first fix (stagger request *start*
  times by 250ms) still failed live for the same reason — a single
  request's round trip can exceed 250ms, so several were still in flight at
  once. Replaced it with `lib/rateLimit.ts`'s `withPacing`, which queues the
  *entire* call (start to response) per API so at most one request per
  chain's API is ever in flight, process-wide, regardless of how many
  traces are running. Moved the call site from the BFS loop into each API
  client (`lib/etherscan.ts`, `lib/blockstream.ts`, `lib/tronscan.ts` — the
  actual shared resource), which let the per-trace-only sleep and the
  `pacingMs`/`API_PACING_MS` plumbing in `bfs.ts` and all three
  `lib/tracers/*.ts` adapters come out entirely. Re-ran the same 6-concurrent
  test after the fix: 0 API errors (was 6 of 6 failing at least one node).
  All three existing self-checks (`clustering`, `typology`, `scoring.test.ts`)
  still pass.

### 2026-09-09 — Day 3: UI/UX polish + PDF letterhead

- **Mobile overflow bug (real bug, not just untested)**: `/cases` and
  `/cases/[id]` had page-level horizontal scroll at mobile widths — traced it
  with a headless-Chromium `scrollWidth` probe (`puppeteer-core` driving the
  system `chromium` binary, no new project dependency) rather than eyeballing
  screenshots. Root cause: `app/layout.tsx`'s `<body>` was `flex flex-col`
  with no sibling relying on it (no footer, no `flex-1` child anywhere) —
  every page's root wrapper div was therefore a flex item of `<body>` and
  defaulted to `min-width: auto`, letting wide content (the 6-column cases
  table, the force-graph canvas) grow the whole page past the viewport
  instead of scrolling internally inside their own `overflow-x-auto`/canvas
  containers. Deleted the unused `flex flex-col` from `<body>` — single-point
  fix, no per-page patching needed. Two smaller, separate wrapping bugs
  fixed alongside it: the case-detail address heading (`break-all` flex
  container) needed `min-w-0` to actually let the unbroken 42-char address
  shrink instead of just failing to wrap; the Sahyog "Simulated integration"
  badge had `whitespace-nowrap` baked into the shared `Badge` component,
  which is correct for every other (short) badge in the app but overflowed
  for this one's long copy — overridden with `whitespace-normal` on that one
  instance rather than changing the shared component. Verified live: probed
  `/`, `/cases`, `/cases/[id]` at a 375px viewport before and after —
  `scrollWidth` now equals `375` (viewport) on all three, zero offending
  elements, confirmed visually via headless screenshots too.
- **Loading state**: the trace form previously gave no feedback beyond the
  button label ("Tracing…") while a trace ran — worth fixing now that
  today's `withPacing` change (see the pacing-fix entry above) can make a
  multi-hop trace take noticeably longer than before. Added a simple
  spinner card (`lucide-react`'s `Loader2` + `animate-spin`, both already
  available — no new dependency) between the form and the results area.
  Verified live by driving a real form submission with `puppeteer-core`
  (typed an address, clicked Run trace, screenshotted mid-request) —
  spinner renders correctly, then the real result replaces it.
- **Accessibility basics**: the address/chain/depth inputs on the home page
  had no accessible name (placeholder-only) — added `aria-label` to all
  three. Added `aria-hidden="true"` to the decorative header icons touched
  in this pass. Didn't do a full icon sweep across the codebase (diminishing
  returns for a hackathon demo); the form controls were the actual gap since
  they're the only interactive, unlabeled elements.
- **Reuse fix while in the area**: `RISK_COLOR` was hand-duplicated in both
  `app/cases/page.tsx` and `app/cases/[id]/page.tsx`; needed a third copy
  for the PDF letterhead work below, which is the "rule of three" signal to
  stop duplicating — moved it to `lib/format.ts` (already home to
  `vaspLine`, the other cross-page VASP-recommendation formatter) and
  imported it in all three places instead of writing a third inline copy.
- **PDF report letterhead** (`lib/pdf/report.tsx`): added a small black
  square mark ("V") next to the report title, mirroring the app's own
  `bg-primary` icon badge; the risk level is now a colored bordered badge
  using the same `RISK_COLOR` values as the on-screen risk badges instead of
  plain text; section titles got a thin hairline bottom border, echoing the
  UI's "thin hairline borders" glassmorphism direction from `PLAN.md`'s Day
  2 note. Kept it to a letterhead/accent treatment, not a redesign — the
  report was already functionally correct and legible. Verified live:
  downloaded and rendered the actual PDF (`pdftoppm`) for a real traced
  case, confirmed the mark, hairlines, and green LOW-risk badge all render
  correctly.
- **n8n live rehearsal (Priority 1, blocked)**: the actual `docker compose
  up` / workflow import / live-canvas verification — the one Day 2 item that
  shipped without live verification — is blocked in this session because
  the Docker daemon isn't running and starting it needs `sudo`, which
  requires a password this session doesn't have. Asked the user to start it
  (`sudo systemctl start docker`) and worked ahead on UI/PDF polish in the
  meantime; n8n rehearsal is still open as of this entry. Update: the user
  is on remote control and `sudo` needs an interactive password that channel
  can't supply — deferred until they're back at the physical machine.
  Update 2: back at the machine, `sudo systemctl start docker` still failed.
  Root-caused via `journalctl -u docker.service`: dockerd fails with
  `iptables: Failed to initialize nft: Protocol not supported` — the
  `nf_tables` kernel module can't load. `ls /lib/modules/` shows only
  `6.18.50-1-lts` and `7.2.3-arch1-3` on disk, but `uname -r` reports the
  *running* kernel as `6.18.49-3-lts` — a kernel upgrade removed that
  version's module tree without a reboot yet, so no kernel module can load
  for the currently-running kernel, Docker included. **Fix is a reboot**
  (boots into a kernel whose modules actually exist on disk); not something
  to trigger without the user's explicit go-ahead mid-session. n8n
  rehearsal remains the one open Day 3 item, blocked purely on that reboot
  — once it's done, Docker should start cleanly and the rehearsal
  (`docker compose up -d`, import both `n8n/workflows/*.json`, activate,
  wire `.env`'s `N8N_TRACE_WEBHOOK_URL`/`N8N_SAHYOG_WEBHOOK_URL` to the
  *activated* webhook URLs — `http://localhost:5678/webhook/vasptrace-trace`
  and `/vasptrace-sahyog`, not `/webhook-test/...` which only listens while
  the n8n editor is open — then restart `next dev` since `.env` is read at
  boot, then run a real trace and a real Sahyog-routing click and confirm
  both fire in n8n's execution list) is otherwise unblocked and everything
  else needed for it (`docker-compose.yml`, both workflow JSON files,
  `.env.example`) is already in place and unchanged.
- **`lib/typology.ts`'s `FAN_OUT` over-triggering (flagged in Day 2, fixed
  today)**: root-caused it rather than just retuning the number. `bfs.ts`
  caps stored outgoing edges per node at `FANOUT_CAP = 5` (a fixed perf/API-
  budget cap — see the `ponytail:` note there), but `FAN_OUT_MIN_DESTINATIONS`
  was `3` — so the flag was mostly detecting "this node hit the tracer's own
  truncation ceiling," which any moderately active real wallet does, not a
  real fan-out/smurfing signal. Confirmed live with a depth-3 trace off a
  busy real EOA (`0xd8dA6BF...`, 16 nodes): 5 of 16 flagged, and two of those
  five had wildly mismatched destination values (near-zero-value contract
  calls sitting next to a real transfer) — not remotely smurfing-shaped,
  just noise that happened to reach 3 destinations. Fixed by raising
  `FAN_OUT_MIN_DESTINATIONS` to `5` — the flag now only fires when a node
  sits at the tracer's own observable ceiling, the one case where "at least
  this many destinations, possibly more" is a claim the data actually
  supports. Same live trace after the fix: 3 of 16 flagged (down from 5),
  and both noise nodes correctly excluded. Kept it a separate constant
  rather than importing `bfs.ts`'s `FANOUT_CAP` directly (an internal review
  pass caught this: the two constants answer different questions — "how
  much fan-out is suspicious" vs. "how much can the tracer afford to
  fetch" — and coupling them would silently break if `FANOUT_CAP` is ever
  tuned down past 3, making the `PEEL_CHAIN` branch unreachable). Updated
  `lib/typology.test.ts` accordingly. All three self-checks (`typology`,
  `clustering`, `scoring`) and `tsc --noEmit` still pass.
- **Post-hoc review pass** (asked for a second opinion after the above):
  caught three more real gaps before calling Day 3 done.
  - **Empty state for "no VASP recommendation"** — `app/page.tsx` and
    `app/cases/[id]/page.tsx` rendered nothing at all when a trace reached
    no labeled exchange (`graph.recommendation === null`), which is exactly
    the Day-4-flagged adversarial scenario ("a trace that never reaches any
    exchange") and reads as a broken page, not a handled case. Added a
    plain-text card on both pages. Verified live on both: a random
    never-used address traces to a single SUSPECT node with no recommendation
    and now shows "No labeled VASP reached within N hops — no disclosure
    request can be recommended for this trace."
  - **Risk-badge/Sahyog-badge text contrast** — measured the actual
    `RISK_COLOR` hex values (now centralized in `lib/format.ts`) and the
    Sahyog badge's `amber-600` against WCAG AA (4.5:1 for this size text):
    all four risk colors and the amber badge failed in at least one theme
    (e.g. `MEDIUM #ca8a04` was 2.94:1 on white). `PLAN.md` says keep the
    functional *meaning* of these colors, not the literal shade, so fixed by
    darkening (light mode) / lightening (dark mode) within the same hue,
    confirmed all pass 4.5:1+ both ways. Implemented as CSS custom
    properties (`--risk-low` etc. in `app/globals.css`, light/dark pair —
    matches the app's existing token pattern) rather than a single hex, since
    the old single value couldn't pass 4.5:1 against both a white and a
    near-black background at once (the math doesn't allow it for a saturated
    color). `lib/pdf/report.tsx` can't consume CSS vars (static white-page
    rendering, no theme) so it keeps its own literal light-mode hex map,
    commented to stay in sync with `globals.css`. Note: found that no
    `.dark` class is ever applied anywhere in the app (no `next-themes` or
    equivalent) — dark mode is currently unreachable, so only the light-mode
    values are live today; the dark pair is there for whenever a toggle gets
    wired up, matching the pre-existing (already-dead) `.dark {}` block in
    `globals.css`. Didn't add a theme toggle — out of scope for today.
  - Confirmed two suspected issues were **not** real: the graph canvas
    appearing blank in an earlier screenshot was a screenshot-tool timing
    artifact (the CLI `chromium --headless --screenshot` captures before the
    force-graph physics settle) — re-checked with an explicit wait via
    `puppeteer-core`, renders correctly every time, both mobile and desktop.
    And the node-detail `Sheet` (opened by clicking a graph node) does not
    overflow at 375px despite containing the same long-address/`break-all`
    shape as the earlier case-detail header bug — probed it directly, zero
    overflow.
- **n8n live rehearsal — done, and it caught two real bugs in the committed
  workflow JSON.** Item 6 was the last Day 3 open risk: the app-side code path
  was verified but nobody had ever actually run the workflows in n8n. Docker
  came back after the reboot (the stale `/lib/modules` mismatch is gone —
  vermagic now matches the running 6.18.50-1-lts kernel), but the daemon still
  failed to start: `nf_tables` wasn't loaded, so `iptables` couldn't
  initialize nft and the bridge driver failed. `modprobe nf_tables` +
  `systemctl reset-failed docker` (the crash loop had tripped
  `start-limit-hit`) fixed it. Both workflows imported and activated against
  `n8nio/n8n:latest`, both webhooks fired for real, both confirmed on n8n's
  canvas. The two bugs, neither of which the app could have surfaced since
  `notifyN8n` is fire-and-forget and only ever saw a `200`:
  - **The IF node was dead.** `Is VASP/mixer reached?` was pinned to
    `typeVersion: 1` with the legacy `conditions.boolean` shape. Current n8n
    builds only ship IF v2–v2.3, and an unsupported v1 node does not error —
    it silently sends every item down the **false** branch. So
    `Push result to VASPtrace dashboard` could never have run, and the demo's
    whole point (watching a VASP hit light up the canvas) would have failed
    live while every execution still showed a green "Success". Migrated to
    `typeVersion: 2.2` with the modern filter shape
    (`operator: {type: boolean, operation: "true"}`) and left a note on the
    node so nobody re-pins it.
  - **Both Code nodes read the wrong object.** n8n's Webhook node nests the
    POSTed JSON under `body` alongside `headers`/`query`/`params`, so
    `$json.hitVaspOrMixer` was always `undefined` (false branch again, for a
    second independent reason), and both HTTP nodes were forwarding the whole
    request envelope — headers included — to the ack endpoints instead of the
    trace/disclosure payload. Both Code nodes now unwrap
    `$input.item.json.body ?? $input.item.json` (the fallback keeps manual
    "Execute workflow" runs with pinned data working).
  Verified after the fix, in this order: synthetic POST with
  `hitVaspOrMixer: true` → true branch → `POST /api/n8n/trace-ack 200`;
  synthetic POST with `false` → NoOp, no ack (so the branch is really
  branching, not just always-true now); then the real runs — a live Ethereum
  trace of `0x6eedf92fb92dd68a270c3205e96dccc527728066` (the WazirX headline
  demo address) produced case `cmtsvq95e0000...`, `hitVaspOrMixer: true`,
  `recommendedVasp: "WazirX"`, and n8n execution #6 shows the green path
  running through the **true** branch into the dashboard push with the NoOp
  left unexecuted; a real "Route disclosure request to WazirX" click produced
  execution #7 carrying the actual case id, suspect address, evidence-trail
  tx hash and `legalBasis`. Env wiring is `N8N_TRACE_WEBHOOK_URL` /
  `N8N_SAHYOG_WEBHOOK_URL` in `.env` pointing at
  `http://localhost:5678/webhook/vasptrace-{trace,sahyog}` — production paths,
  not `/webhook-test/`, which only fire while the editor is listening.
  Two operational notes for demo day: n8n now requires an owner account on
  first boot (the `n8n_data` volume persists it, so this is a one-time setup
  unless the volume is wiped), and an **active** workflow does not animate the
  editor canvas — executions are visible under Executions, not by watching the
  editor.
- **"The UI changes aren't showing up" — a stale service worker, not our
  code.** After the restart the app rendered in Times New Roman with no icons
  and pre-polish class names (`text-2xl font-semibold` on the `h1` where the
  source says `text-3xl font-bold tracking-tight`), which looked like a build
  or Tailwind failure. It wasn't: `curl` showed the *server* returning correct
  HTML the whole time. The cause was a leftover service worker registered on
  `http://localhost:3000/` with a cache named `bookish-v1` — left behind by a
  different project previously dev-served on that port. Service workers are
  scoped per **origin**, not per project, so anything running on
  `localhost:3000` inherits them; it was intercepting requests and hydrating
  over the correct server HTML with an old app's cached bundle. (This also
  explains the React hydration-mismatch error seen earlier the same session,
  which was initially and wrongly written off as ordinary browser cache.)
  Fixed by unregistering the worker and deleting the cache. **This is
  per-browser-profile state, so it can reappear on any machine or Chrome
  profile used at judging** — if the UI ever looks a version behind, check
  DevTools → Application → Service Workers before touching the code, or dodge
  the origin collision entirely with `npm run dev -- -p 3001`.

### 2026-09-09 — Day 4: visual overhaul (blue repaint)

Day 3's UI/UX polish (15 files — contrast tokens, mobile-overflow fix,
FAN_OUT retune, n8n rehearsal, PDF letterhead) was committed first as its
own commit so the repaint below lands on a clean base and stays a legible
diff.

- **Blue chrome, functional colour untouched.** `app/globals.css`'s
  `:root`/`.dark` tokens moved from the Day 2 monochrome scheme to a blue
  palette (`--primary` `#2563eb`-equivalent oklch, blue-tinted `--card`/
  `--background`/`--muted`/`--accent`, a blue-tinted ambient body gradient
  replacing the old grayscale one). `--risk-*` and the graph's
  `NODE_COLOR`/`FLAG_COLOR` maps are deliberately outside this token set —
  per PLAN.md's hard constraint, blue is chrome only.
  - **Real collision caught before shipping:** `NODE_COLOR.BRIDGE` was
    `#2563eb` — byte-identical to the new `--primary`. A BRIDGE node would
    have silently read as "app chrome" instead of a distinct node kind.
    Moved to teal (`#0d9488`).
- **`/` rebuilt as a search-engine landing page** — centered mark, single
  large address input with an inline search icon, chain/depth demoted to
  small secondary controls, Enter-to-submit. Empty state reads as a search
  landing page; a trace result renders below it as a results page, with no
  separate header duplicating the hero.
- **`/cases` rebuilt as a stats dashboard** — all from existing `Case` rows,
  no schema change: 4 stat tiles (cases traced, disclosure requests routed,
  high/critical risk, chains covered), risk-level distribution and
  cases-per-chain bar rows, most-recommended-VASPs and most-common-typology-
  flag rankings, and a 14-day cases-per-day sparkline (inline SVG, no
  charting dependency). The existing table gained a real zero state and now
  resolves `recommendedVaspId` to a VASP name via one extra
  `vaspRegistry.findMany()` instead of rendering a raw cuid.
  `ponytail:` note left on the typology-flag tally: it parses `typologyFlags`
  JSON per row (O(all cases) on every load) — fine at demo volume (81 rows
  today), would need a denormalized count if that changes.
- **Graph prettiness** (`components/graph-view.tsx`): replaced the default
  circle rendering with a `nodeCanvasObject` — radial glow on the suspect
  root, a colored ring on typology-flagged nodes, on-canvas entity labels
  (skipped below `globalScale 1.1` to avoid clutter when zoomed out), plus
  `linkCurvature`, `linkDirectionalParticles` animating flow direction, and
  a legend (bottom-left, only lists node kinds actually present in that
  trace). `nodePointerAreaPaint` added alongside the custom paint so node
  clicks still hit the same radius the paint draws — verified live
  (Puppeteer click on the suspect node's screen position → detail Sheet
  opened, confirmed via `document.body.innerText`). `nodeVal` kept
  alongside the custom paint: it drives the force simulation's collision
  sizing, which the paint callback doesn't touch.
  - **Real bug caught and fixed during verification, not just imagined:**
    the radial layout puts every depth-1 sibling level with the suspect
    when there are exactly 2 of them (angle 0 and π), so the suspect's own
    below-node label collided with its immediate neighbor's label on small
    traces — the single most common shape for a demo trace. Fixed by
    drawing the suspect's label *above* the node instead of below; a
    placement heuristic for the common case, not full collision avoidance
    across an arbitrary graph.
- **PDF letterhead re-synced**: `lib/pdf/report.tsx`'s brand mark and
  header rule were literal `#1a1a1a` mirroring the old near-black
  `--primary` — moved to a `BRAND = "#2563eb"` constant so the downloaded
  report still visually matches the app. `RISK_COLOR_PRINT` is the
  *other* literal map in that file (kept in sync with `--risk-*`
  independently — see below).
- **Contrast re-verified for real, not re-reasoned about.** First pass
  assumed the new (lighter) `--background` alone was enough and left
  `--risk-*` unchanged from Day 3 — wrong: the repaint's blue ambient
  gradients live on `body`'s `background-image`, not `--background`, and
  darken the page ground more where a badge sits directly on it (e.g. the
  case-detail header, no `Card` wrapper) than under a `Card`'s translucent
  white surface. Pixel-sampled both real composited surfaces (headless
  Chromium screenshot + ImageMagick, not inference): card ≈ `#FAFEFF`,
  page-direct near the header ≈ `#E9F1FD`. At Day 3's values, `LOW`
  (4.41:1) and `MEDIUM` (4.33:1) both failed 4.5:1 against page-direct —
  a real regression the repaint introduced. Moved `--risk-low` to
  Tailwind green-800 (`#166534`, 6.27:1 page-direct / 7.02:1 card) and
  `--risk-medium` to amber-800 (`#854d0e`, 6.02:1 / 6.75:1) — real margin,
  not just clearing the line. `HIGH`/`CRITICAL` already had headroom and
  are unchanged. `RISK_COLOR_PRINT` in `lib/pdf/report.tsx` updated to
  match. Also checked (already passing, untouched): the Sahyog "Simulated
  integration" badge (`amber-700`, 4.95:1 on its card surface) and the
  trace-warnings banner (`amber-700` on its own tinted background, 4.63:1).
- **Verification, measured not eyeballed:** 375px `scrollWidth` probe (via
  a `puppeteer-core` install found in a sibling project, since this repo
  has none) on `/`, `/cases`, `/cases/[id]` — all three equal `375`, zero
  overflow, including the new stat-tile grid (exactly the wide-content
  shape that caused Day 3's bug). A real depth-2 live trace driven through
  the actual form (not the API directly) end to end, confirming the
  loading spinner, the "no VASP reached" empty state, the typology-flag
  badge, and the n8n-unreachable warning banner all render correctly
  against the new palette. Zero browser console errors across all three
  pages. The degenerate 1-node graph (a never-transacted address) renders
  without a `zoomToFit` blowup and shows a legend with only "Suspect". Malformed
  addresses for all three chains (ETH/BTC/TRON) and `maxDepth: 10` all
  degrade to a clear error or complete cleanly (~11s), not a blank page or
  crash. All three self-checks (`typology`, `clustering`, `scoring`) and
  `tsc --noEmit`/`eslint` still pass. Test cases created during
  verification were deleted afterward — the DB is back to 81 real cases.
- **Not done, explicitly out of this pass:**
  - **n8n canvas execution during a live run** — Docker is down again on
    this machine (`nf_tables` kernel module missing for the currently
    running kernel, same root cause as Day 3's entry; modules exist on disk
    for `6.18.50-2-lts`, running kernel is `6.18.50-1-lts`). Needs another
    reboot, which is the user's call, not something to trigger mid-session.
    Everything else about item 6 is already verified (Day 3) and unaffected
    by the repaint.
  - **The timed, judge-facing full dry-run** (paste address → live trace →
    graph → n8n canvas → scoring → PDF → mock-route, with a clock on it) —
    a live rehearsal exercise, better run by a person than simulated here.
    The individual pieces it exercises were each verified above.

### 2026-09-09 — Day 4 follow-up: full-width layout, shadcn charts, light/dark mode

Requested after the blue repaint above shipped — not in PLAN.md, logged here
since it changes shipped behavior. Also fixed, unrelated: the dev server had
been stopped as end-of-session "cleanup" after the repaint work, which is
what actually caused the "UI isn't reflecting on localhost" report — restarted
it. Separately, the user's browser also had a stale service worker
(`bookish-v1`, left behind by a different project dev-served on the same
`localhost` origin — the exact gotcha PROGRESS.md's Day 3 entry already
documents) serving a cached pre-repaint bundle; unregistered it and cleared
the cache directly in the browser tab.

- **Full-width layout.** All three pages (`/`, `/cases`, `/cases/[id]`)
  dropped their `mx-auto max-w-5xl` wrapper for `w-full` with responsive
  padding — content now uses the available viewport instead of a centered
  narrow column. The dashboard's 4-chart grid gained an `xl:grid-cols-4`
  breakpoint so it lays out as one row on wide screens instead of 2×2. The
  home hero's search card widened from `max-w-2xl` to `max-w-4xl` — kept a
  cap rather than going edge-to-edge, since a single text input spanning an
  entire ultrawide monitor is a real usability regression (line length,
  mouse travel), not just an aesthetic call.
- **shadcn chart components** (`components/ui/chart.tsx`, fetched from
  shadcn's `new-york-v4` registry to match this project's Tailwind v4 setup;
  `recharts@3.10.1` added). Replaced every hand-rolled bar-row/inline-SVG
  chart on `/cases` with real `BarChart`/`AreaChart` — risk distribution,
  cases-per-chain, most-recommended VASPs, and most-common-typology-flags
  are now horizontal `BarChart`s (functional risk colors still passed
  through per-`Cell`, not absorbed into the chart's own palette), and the
  14-day trend is a gradient-filled `AreaChart`. Real tooltips and axis
  ticks came free.
  - **Real bug caught before shipping, not just designed around:** recharts
    touches React context at module scope, so importing it into
    `app/cases/page.tsx` (an async Server Component doing the Prisma fetch)
    broke the page outright — blank page, console showed `createContext
    only works in Client Components`. Moved the actual chart JSX into a new
    `components/dashboard-charts.tsx` (`"use client"`), which the server
    page now calls with plain data props. `app/cases/page.tsx` itself
    stayed a server component.
  - **Verification quirk worth recording:** a 375px headless
    `chromium --screenshot` capture showed the four chart cards fully
    blank (no bars, no titles) below the risk-distribution panel. Chased it
    with puppeteer instead of trusting the screenshot: `page.evaluate`
    confirmed every card had its correct title text *and* the exact right
    number of `.recharts-bar-rectangle` elements with real non-zero
    geometry, `scrollWidth === clientWidth` (no overflow), and the same
    page in the actual GPU-accelerated connected browser rendered all four
    charts correctly with a working hover tooltip. Same class of false
    positive as Day 3's force-graph-canvas screenshot timing issue — logged
    so a future session doesn't re-chase it as a real bug.
- **Light/dark mode** (`next-themes@0.4.6`, `attribute="class"`,
  `defaultTheme="system"`). `app/layout.tsx` wraps `children` in a
  `ThemeProvider`, `components/theme-toggle.tsx` adds a sun/moon button to
  all three page headers. The `.dark` token block in `globals.css` already
  existed (Day 3 built it defensively even though nothing could reach it
  then) — this is what finally makes it reachable. First real check of it:
  pixel-sampled the actual dark-mode composited surfaces the same way Day
  4's light-mode contrast fix did (canvas-based RGB extraction, not
  inference) — all four `--risk-*` dark values clear AA with real margin
  (6.4:1–11.7:1 across both the card and page-direct surfaces). The graph
  canvas's on-node labels (`components/graph-view.tsx`) use a hardcoded
  `#1e293b` fill regardless of theme — works in dark mode too because the
  white stroke-halo behind the text (added for the light-mode legibility
  pass) provides its own contrast independent of the canvas background;
  confirmed visually rather than assumed.
  - The toggle's first implementation used a `mounted` state + `useEffect`
    to dodge next-themes' hydration mismatch — `eslint`'s
    `react-hooks/set-state-in-effect` rule caught it. Rewrote to render both
    icons unconditionally and let the `.dark` class pick which one shows via
    `dark:scale-0`/`dark:scale-100` — sidesteps the client-only state
    entirely rather than suppressing the lint rule.

### 2026-09-09 — Auth (final-stretch item 1, both phases)

Landed in two commits on purpose (see `PLAN.md`'s "Final stretch" for the
full reasoning on why auth reversed into scope, and why hand-rolled over
`next-auth`) — phase 1 (login gate, sessions, demo accounts) first so there
was a working, verified checkpoint to fall back to before phase 2 (RBAC)
touched four more files.

- **Phase 1**: `lib/auth.ts` (scrypt password hashing + HMAC-signed session
  cookie, both Node stdlib, no new dependency), `proxy.ts` gating every
  route except `/login`, its own API, and the n8n ack endpoints (excluded
  deliberately — they're called server-to-server by n8n with no browser
  session, and editing the workflow JSONs to add a header guard would mean
  re-importing and re-verifying in n8n over files that took two days to get
  right, for endpoints that only log receipt). `User` model + nullable
  `Case.createdById` — nullable specifically because a required column
  with no default on an 81-row SQLite table is the shape that forces a
  destructive reset; backed up `dev.db` before migrating anyway, confirmed
  all 81 rows survived the table rebuild. `prisma/seed.ts` backfills every
  pre-auth case to a seeded demo investigator rather than leaving
  `createdById` null, specifically so the dashboard's "81 real cases" and
  `docs/PITCH.md`'s numbers stay demonstrable once RBAC lands.
  - **Real finding while reading docs before writing code** (per
    `AGENTS.md`'s instruction, not skipped this time):
    `node_modules/next/dist/docs/.../file-conventions/middleware.md` says
    `middleware.js` was deprecated and renamed to `proxy.js` in Next 16 —
    the old filename silently does nothing. The same docs also confirm
    Proxy defaults to the Node.js runtime in this version, which resolved
    a real Edge-runtime concern (raised in review before any code was
    written) about whether `node:crypto` would even be available for the
    session check.
- **Phase 2**: `lib/auth.ts`'s `canAccessCase(user, kase)` — one function
  used identically in `app/cases/[id]/page.tsx`, the PDF report route, and
  the Sahyog route, so the SUPERVISOR-bypass rule can't drift between the
  three places that fetch a Case by id. `app/cases/page.tsx`'s list query
  itself is filtered, not just the render. All four denials return 404,
  not 403 — same "don't confirm the thing exists" reasoning the login
  route already used for wrong-username vs. wrong-password.
- **Verified live, both phases, not by code review alone**: a real login
  driven through the actual form (redirect round-trips the original
  destination via a `next` param correctly); wrong password → 401, correct
  → signed cookie; authenticated trace/PDF/Sahyog all still work exactly as
  before; the n8n ack route still reachable with zero session. For RBAC
  specifically: logged in as both seeded accounts, had the supervisor trace
  a fresh case, then confirmed the investigator gets 404 from all three of
  the case-detail page, the PDF route, and the Sahyog route for that
  specific case (not just the list) — while the supervisor's own access to
  it kept working. Case counts confirmed via the actual rendered stat
  tile: investigator 81, supervisor 82.
- **Two stale-Turbopack-module errors mid-verification**, neither a real
  code bug: a Prisma client that hadn't picked up `prisma generate` (the
  long-running dev server had it module-cached from before the schema
  changed), then — after restarting for that — a route handler that hadn't
  picked up a newly-added `lib/auth.ts` export while the page component
  right next to it had, in the same dev session. Both resolved by a full
  restart with `.next` cleared. Worth naming as a pattern now: this is the
  second time in this project a stale-module symptom looked like a code
  bug and wasn't (the first was the risk-badge/service-worker confusion on
  Day 3) — if a change that should obviously work doesn't, check for a
  stale dev-server module cache before re-reading the diff.

### 2026-09-10 — Node budget: measured, and the raise rejected

`HANDOFF.md`'s priority item 0 was "raise `NODE_BUDGET` in
`lib/tracers/bfs.ts` (60 → ~150)", described there as the single
highest-value change available and decided-but-not-done. **Measured it, and
it does not hold. The constant stays at 60.** No code changed; this entry is
the record so nobody re-derives it.

The premise was that of four Bitcoin dataset candidates traced at depth 5,
the three that reached no VASP all ended on `Node budget (60) reached`, so
they were "stopped mid-search, not shown to be exchange-free". The inference
was reasonable. It's wrong on the facts. Traced all four at 150 by calling
`traceBitcoin` directly (throwaway `tsx` script, deleted — never
`POST /api/trace`, which would persist `Case` rows):

| address | budget | wall-clock | nodes | max hop | risk | flags | VASP |
|---|---|---|---|---|---|---|---|
| `3FrmCRcGKiTATfreBDM9F17yAUDoDsnWeA` | 60 | **25.5s** | 60 (truncated) | 4 | HIGH | FAN_OUT + PEEL_CHAIN | Binance @ hop 4 |
| `3FrmCRcGKiTATfreBDM9F17yAUDoDsnWeA` | 150 | **57.7s** | 150 (truncated) | 5 | HIGH | FAN_OUT + PEEL_CHAIN | Binance @ hop 4 |
| `155Yv6Hmzs5RT8j6uZAzfWzecvV9FDyu6k` | 150 | 22.9s | 89 (**completed**) | 5 | HIGH | FAN_OUT + PEEL_CHAIN | none |
| `1CYYS3R6CKD43nCxFbqvEvjr3VUScKswBw` | 150 | 44.3s | 150 (truncated) | 5 | HIGH | FAN_OUT + PEEL_CHAIN | none |
| `3P9WebHkiDxCi8LDXiRQp8atNEagcQeRA3` | 150 | 21.4s | 64 (**completed**) | 5 | HIGH | FAN_OUT + PEEL_CHAIN | none |

- **0 of 4 misses converted to a hit.** Two of the three exhausted their
  entire search space at 89 and 64 nodes with the budget at 150 — no
  truncation warning at all — and still reached zero labeled addresses. They
  aren't budget-limited; they are genuinely exchange-free within reach at
  depth 5. Raising the cap only let them prove it.
- **On the primary demo address the raise buys nothing but latency**: same
  Binance hit at hop 4, same HIGH risk, same two flags, +32s.
- Risk level and typology flags were **stable** across both budgets, so the
  numbers quoted in `DEMO_ADDRESSES.md` would have survived the change. That
  was the one real regression risk (`applyConfidenceClustering` and
  `applyTypologyFlags` run over the whole node list, so a bigger list could
  have moved them) and it didn't materialise.

**The budget is almost never the binding constraint in real use** — settled
from the 82 existing `Case` rows, no API calls, since `traceResult` stores
`warnings`:

| chain | cases | hit the node budget | produced a recommendation |
|---|---|---|---|
| ETHEREUM | 55 | 2 | 33 |
| BITCOIN | 12 | 0 | 9 |
| TRON | 15 | 0 | 13 |

2 of 82 traces (2.4%) ever hit the cap, both Ethereum — and one of those two
still produced a Binance recommendation. Across the whole case history the
raise could have helped at most **one** trace. This also closes the gap that
`NODE_BUDGET` is shared by all three chains and only Bitcoin was probed
directly: ETH and TRON aren't budget-bound either, on evidence rather than
inference.

`FANOUT_CAP = 5` is ruled out by the same data — two graphs exhausted at
depth 5 with only 64-89 nodes are naturally thin, so more breadth explores
more *unlabeled* space, not more exchanges. **Both breadth levers are dead.
BTC label coverage is the only lever left** (2 of 15 seeded exchange
addresses are Bitcoin, both Binance — `prisma/seed.ts`), and it's the user's
call: the primary demo address already reaches Binance and produces a full
recommendation, so more BTC labels buy robustness if a judge pastes *their
own* address, which is a different risk than the one item 0 claimed to solve.

**Separately, trace timing — measured, and it's good news.** `HANDOFF.md`
said to "re-check the 4-5s trace timing the demo script assumes". There is
no demo-script file and no timing figure anywhere in `docs/`, so the 4-5s
number was unsourced. Measured:

| path | depth | nodes | wall-clock |
|---|---|---|---|
| `0x6eedf…` (WazirX, **the headline demo address**) | 1 | 2 | **1.4s** |
| `0x6eedf…` same address | 3 | 2 | 0.6s |
| `1CRLGcaXajtWVF5EopZgQUqE12dKn8Rtuh` (curated BTC) | 1 | 3 | **0.9s** |
| `3FrmCRcGKiTATfreBDM9F17yAUDoDsnWeA` (dataset backup) | 5 | 60 | **25.5s** |

**The scripted judge-facing path is ~1s, faster than the 4-5s anyone
assumed** — the curated addresses are all one hop from a labeled exchange,
so the trace stops on the label almost immediately and depth barely matters
(depth 3 on the same address costs no more than depth 1). The ~25s figure
belongs *only* to the deep dataset addresses at depth 5, which explore 60+
unlabeled nodes. That is inherent rather than a regression: `withPacing`
(`lib/rateLimit.ts`) serializes one in-flight request per chain API, and the
four deep runs above put it at a consistent **~0.25-0.45s per node** (250ms
pacing + round-trip, one API call per expanded node).

So the timed dry-run only has a pacing problem if it demos `3Frm…`. Worth
knowing which trade that is: the curated addresses are fast but show a clean
1-hop graph, while `3Frm…` is the messy multi-hop laundering visual and
costs ~25s of dead air. Recorded in `DEMO_ADDRESSES.md`.

### 2026-09-10 — Small untested edges (final-stretch item 3)

The three edges flagged during the Day 4 bug bash and never closed. Tested
all three live against the running app before changing anything; **one was a
non-issue, two were real.**

**Double-clicking "Re-route to X" — not a bug, no fix needed.** The worry was
a race on `Case.status`. There isn't one: the route does a blind
`update({ data: { status: "ROUTED" } })`, not a read-modify-write, so
concurrent requests converge on the same value. Verified by firing two truly
simultaneous POSTs at one case — both returned 200, the row ended `ROUTED`,
and there was still exactly one row. `SahyogButton` also already guards with
`disabled={loading}`. The only real side effect is a duplicate fire-and-forget
n8n notification, which is harmless. (The case mutated during this test was
restored to `TRACED`.)

**A valid address against the wrong chain selector — real, now fixed.** It
was rejected with `address is not a valid BITCOIN address`, which is
technically true and unhelpful: the user pasted a perfectly good address and
just had the wrong selector. The three address formats don't overlap
(`0x…` / `1,3,bc1…` / `T…`), so exactly one validator can match and the API
can name it. Now: *"That looks like an Ethereum address, but Bitcoin is
selected — switch the chain selector to Ethereum."*

**Whitespace and casing on a pasted address — real, now fixed.** A trailing
space or a leading newline (what you get pasting out of a PDF or an email)
failed validation with the same confusing "not a valid address" error, and so
did an uppercase `0X` prefix, which some explorers emit. `app/page.tsx` was
already calling `address.trim()`, but the API is the trust boundary every
caller crosses, so the trim belongs there — the route is now correct on its
own terms rather than because its one current client happens to be careful.
The Ethereum validator accepts `0[xX]`; `lib/tracers/ethereum.ts` lowercases
downstream, so nothing past validation can tell the difference. Bitcoin and
Tron are deliberately *not* case-folded — they're base58/bech32 and
case-sensitive, so a lowercased Tron address is a different address.

`ADDRESS_VALIDATORS` moved out of the route into **`lib/address.ts`** with
`detectChain()`, and gained a self-check (`npx tsx lib/address.test.ts`)
covering all of the above plus the non-overlap property `detectChain` depends
on. It's a parser on untrusted input; it deserved one runnable check, and no
whitelist of permitted `route.ts` exports was *found* in
`node_modules/next/dist/docs/` — which isn't proof there is none, so putting
it in `lib/` sidesteps the question rather than betting on the answer.

Verified in the browser at the end, not just by curl: the new message renders
in the destructive style inside the search panel, and — measured, not
eyeballed — the paragraph's `scrollWidth` equals its `clientWidth` (213px)
in a 375px-constrained container, wrapping to 4 lines with no horizontal
overflow. No `Case` rows leaked from any of this: the DB is still at 82.

One related thing checked and deliberately left alone: `app/page.tsx`'s
button gate is `disabled={!address || loading}` on the *raw* string, so a
whitespace-only paste still enables the button, sends `address: ""` after the
trim, and gets back `address is required` — the right message for that input,
so no change.

### 2026-09-10 — n8n re-verification after auth, and the canvas-animation finding

Final-stretch item 2's app-side half. Docker came back without a reboot this
time: the running kernel is now `6.18.50-2-lts` and `/lib/modules` has a
matching tree, so the Day 4 mismatch is gone — the daemon was simply
`inactive`, and `modprobe nf_tables` + `systemctl start docker` brought it
up. The `n8n_data` volume survived, so both workflows were still imported,
still **Published**, and the browser session was still valid: no owner-account
recreation needed (that remains the demo-day risk if the volume is ever
wiped).

- **The ack routes still work with zero session through `proxy.ts`** — this
  was the specific open question after auth landed. Both verified live:
  `POST /webhook/vasptrace-sahyog` → `/api/n8n/sahyog-ack` `200`, and
  `POST /webhook/vasptrace-trace` with `hitVaspOrMixer: true` → the IF node's
  true branch → `/api/n8n/trace-ack` `200`. The Day 3 IF-node fix
  (`typeVersion: 2.2`) survived; production webhooks both register.
  `PLAN.md`'s Final-stretch item 2 told a future reader to "confirm the
  shared-secret guard doesn't break them" — there is no such guard, the
  routes were excluded from the gate outright. Corrected in place there.
- **The canvas-animation claim was wrong as written, and is now fixable.**
  Day 3 recorded that an *active* workflow doesn't animate the editor —
  executions only show up under Executions after the fact. That quietly
  invalidated `PITCH.md` §2.4/§9's "judges watch the automation execute in
  real time on a live canvas", which is the entire stated point of item 6.
  Tested the alternative: with `.env` pointed at the `/webhook-test/` URLs
  and **Execute workflow** clicked to arm the canvas, the editor *does*
  render the run — green checkmarks on every executed node, green edges
  labelled "1 item", the **true** branch flowing into "Push result to
  VASPtrace dashboard", and "No VASP/mixer reached" left grey and
  unexecuted. Verified twice: once with a synthetic payload, once
  end-to-end from a real `POST /api/trace` through the app. So the pitch
  claim holds *in test mode only*.
- **The cost, measured not assumed**: n8n's test webhook is **one-shot per
  arming**. Fired a second call without re-clicking Execute workflow → `404`
  (n8n's own 404 body says so: "the webhook only works for one call after
  you click this button"). Every trace needs re-arming, and the two
  workflows arm independently — so the Sahyog click needs its own arming
  step, separate from the trace. Forgetting either doesn't break anything
  (the notify is still fire-and-forget) but does surface the "n8n
  unreachable" warning banner mid-demo. `.env` was **restored to the
  production URLs** at the end of the session; the swap is one `sed`, in the
  runbook.
- **Trace timing re-confirmed against the live app**, not just the library:
  `0x6eedf…` at depth 1 through `POST /api/trace` took **1.33s** and
  returned 2 nodes, WazirX at high confidence, recommendation score **8**
  (FIU-IND ✓, nodal officer ✓, reliability 4, −1 hop). Matches
  `DEMO_ADDRESSES.md` and the 2026-09-10 timing entry above exactly.
- **`docs/DEMO_SCRIPT.md` written** — the judge-facing runbook that the
  earlier timing entry noted did not exist. Pre-flight (Docker, webhook
  registration check, the test-mode `.env` swap, service-worker check),
  nine numbered demo steps with measured timings and what to say at each,
  the two arming steps placed where they belong, a failure table, the
  reset procedure, and the address cheat sheet. Button labels were read out
  of the source (`Run trace`, `Download PDF report`, `Route disclosure
  request to {vasp}`) rather than recalled.
- **Case-count question settled.** `PITCH.md` §11 said "81 real cases" while
  the DB holds 82. Queried it: all **82** rows belong to the `investigator`
  account and the supervisor has **0**, so both demo logins show 82 on the
  dashboard stat tile (the supervisor's RBAC-verification case from the auth
  session was evidently cleaned up then, leaving the 81 backfilled rows plus
  the user's own `bc1qydnt…` Bitcoin trace). `PITCH.md` updated to 82. The
  one test case created during this session was deleted afterwards; the DB
  is back at 82.

Not done, still open: the **timed** judge-facing dry-run (a person has to
run it with a clock — `DEMO_SCRIPT.md` is what to run), the pitch rehearsal,
and the demo-day checklist.

## Next up

All ten original plan items have a first pass and the app is demo-ready
end to end. Real submission deadline is **2026-09-11 — one day out** (the
"~4 working windows" figure written on 2026-09-09 is stale by a day; treat
one or two windows as the real budget). See `PLAN.md`'s "Final stretch"
section (right after the old "Day 5 — Buffer + pitch" stub, which it
supersedes) for the authoritative priority order.

**Final-stretch items 1, 2 and 3 are all done.** Auth + RBAC (item 1), n8n
re-verification including the ack routes through the proxy gate (item 2,
done 2026-09-10 — see the entry below), and the small untested edges (item
3, done 2026-09-10). **What is actually left: the timed judge-facing
dry-run, the pitch rehearsal (item 4), and the demo-day checklist (item
5).** `docs/DEMO_SCRIPT.md` now exists as the runbook for the first of
those. Summary of what was already open before auth landed, most urgent
first:

1. **Auth + RBAC — done.** See the 2026-09-09 "Auth" changelog entry above
   for the full design and what was verified. Login gate, sessions, RBAC
   (investigators see their own cases, supervisors see all), object-level
   authorization on the case-detail/PDF/Sahyog routes, n8n ack routes
   confirmed still reachable unauthenticated. Demo credentials in
   `README.md`.
- **Day 4's visual overhaul is done** — blue repaint, search-engine `/`,
  stats dashboard `/cases`, graph prettiness (glow, curved/animated links,
  legend). See the 2026-09-09 Day 4 changelog entry for what changed and
  what was verified. Still open from the original Day 4 scope: the timed
  judge-facing dry-run and n8n canvas execution (blocked on a Docker-
  affecting kernel/module mismatch — needs a reboot, the user's call).
- Item 1: no pagination on the Bitcoin/Tron fetchers (Blockstream caps at
  ~25 recent txs, Tronscan capped at 50) — fine for a demo trace, would
  matter for a real caseload.
- Item 6: **closed, and re-verified after auth (2026-09-10).** The live n8n
  rehearsal ran on Day 3 — both workflows imported, activated and confirmed
  executing on the canvas from a real trace and a real Sahyog click, after
  fixing two bugs in the committed workflow JSON that only a live run could
  have exposed (see the 2026-09-09 changelog entry). The auth-gate watch
  point is now closed too: both ack routes verified reachable with zero
  session through `proxy.ts` (2026-09-10 entry). Residual risk is
  setup-shaped, not correctness-shaped: n8n asks for an owner account on
  first boot, so if the `n8n_data` volume is ever recreated on demo day
  someone has to re-create that account before the webhooks work. Plus one
  demo-technique constraint found on 2026-09-10 — the live-canvas visual
  requires the `/webhook-test/` URLs and a **one-shot** re-arming click
  before *every* trigger; see `DEMO_SCRIPT.md`.
