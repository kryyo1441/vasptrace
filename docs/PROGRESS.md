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

Out-of-scope items (bridge correlation placeholder, `confirmedByVaspResponse`,
auth) are all still correctly out of scope — no action needed there yet.

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

## Next up

All ten plan items have a first pass — nothing blocks an end-to-end demo
(paste address → live trace → graph → n8n canvas → scoring/recommendation →
PDF report → mock-route to VASP), which was the plan's stated definition of
done for the week. Day 1 finished all of it; days 2-5 are hardening and
demo-rehearsal, not new scope. See PLAN.md's
["Day-by-day schedule"](./PLAN.md#day-by-day-schedule-added-end-of-day-1)
section for the actual breakdown. Items worth repeating here since they're
open risks:
- **Day 4's visual overhaul is done** — blue repaint, search-engine `/`,
  stats dashboard `/cases`, graph prettiness (glow, curved/animated links,
  legend). See the 2026-09-09 Day 4 changelog entry for what changed and
  what was verified. Still open from the original Day 4 scope: the timed
  judge-facing dry-run and n8n canvas execution (blocked on a Docker-
  affecting kernel/module mismatch — needs a reboot, the user's call).
- Item 1: no pagination on the Bitcoin/Tron fetchers (Blockstream caps at
  ~25 recent txs, Tronscan capped at 50) — fine for a demo trace, would
  matter for a real caseload.
- Item 6: **closed.** The live n8n rehearsal ran on Day 3 — both workflows
  imported, activated and confirmed executing on the canvas from a real trace
  and a real Sahyog click, after fixing two bugs in the committed workflow
  JSON that only a live run could have exposed (see the 2026-09-09 changelog
  entry). Residual risk is now setup-shaped, not correctness-shaped: n8n asks
  for an owner account on first boot, so if the `n8n_data` volume is ever
  recreated on demo day someone has to re-create that account before the
  webhooks work.
