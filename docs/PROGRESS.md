# VASPtrace — progress

Status against [`PLAN.md`](./PLAN.md), item numbers match. Update this file
whenever a plan item's status changes — append to the changelog, don't rewrite
history.

## Status

| # | Item | Status |
|---|------|--------|
| 1 | Multi-chain tracer | **Done** — Ethereum, Bitcoin (Blockstream), Tron (Tronscan) all live. Shared BFS engine (`lib/tracers/bfs.ts`), thin per-chain adapters. **Scope: native + stablecoins** since 2026-09-13 — ETH + USDT/USDC (ERC-20), TRX + USDT (TRC-20), BTC native; other tokens not traced (`ROADMAP.md` item 1). **Polygon and Arbitrum** added 2026-09-13 through the same Etherscan v2 adapter (Arbitrum has no labels yet). Edges carry `kind: TRANSFER \| CONTRACT_CALL` since 2026-09-12 so a zero-value contract call can't read as a payment (`ROADMAP.md` item 0). |
| 2 | Labeled address DB | **Done** — real seed data (exchange hot wallets, Tornado Cash, OFAC SDN, one Tron exchange address). |
| 3 | Legal-actionability scoring | **Done** — `lib/scoring.ts`, wired into the trace response, rendered on `/` and the case detail page. |
| 4 | Confidence scoring (high/medium/low) | **Done** — `lib/clustering.ts`: medium = forwards ≥80% of value to a known exchange, low = fan-in from ≥3 senders that forwards onward. Excluded from VASP recommendation (only exact-match routes a disclosure request). Since 2026-09-14 also medium: Bitcoin common-input ownership ("same wallet" as a labeled address, CoinJoins skipped — `ROADMAP.md` item 2). |
| 5 | Graph visualization | **Done** — force-directed graph, color coding, click → detail sheet, edge tooltips, per-chain unit formatting (ETH/BTC/TRX). Day 4: custom node paint (suspect glow, flag rings, on-canvas labels), curved links with directional particles, and a per-trace legend. |
| 6 | n8n workflow visualization | **Done, rehearsed live** — `docker-compose.yml` + two workflows in `n8n/workflows/`, fire-and-forget notify (`lib/n8n.ts`) from the trace and Sahyog routes. n8n is optional and never blocks/fails either flow — verified live with an unreachable webhook URL. Both workflows also run for real against `n8nio/n8n:latest`: imported, activated, and confirmed on the canvas from a real trace and a real Sahyog click (Day 3 — fixed a dead `typeVersion: 1` IF node and a webhook `body`-unwrap bug found only by running it). |
| 7 | Case dashboard | **Done** — every trace persists as a `Case` (`/api/trace`), listed at `/cases`, each row links to a detail page at `/cases/[id]`. |
| 8 | PDF report | **Done** — `@react-pdf/renderer`, `app/api/cases/[id]/report/route.ts`, renders entirely from the persisted `Case.traceResult` (no re-trace). |
| 9 | Mocked Sahyog routing | **Done** — `app/api/cases/[id]/sahyog/route.ts` + `SahyogButton`, flips `Case.status` to `ROUTED`, shows the simulated payload inline with a "Simulated integration" badge. |
| 10 | Typology/pattern flags | **Done** — `lib/typology.ts`, flags rendered directly on graph edges/nodes plus a summary badge row. |
| — | Auth + RBAC | **Done (added scope, 2026-09-09)** — not one of the ten original items; day 1 scoped it out as "single-user demo is fine" and that was reversed. Login gate (`proxy.ts` + `lib/auth.ts`), per-investigator case scoping, object-level authorization on case detail / PDF / Sahyog. See the 2026-09-09 "Auth" changelog entry. |

Remaining out-of-scope item: bridge correlation placeholder (`ROADMAP.md`
item 4, scoped but not built — see the 2026-09-14 session 2 entry).
`confirmedByVaspResponse` was also on this list and is no longer: wired up
2026-09-14, see the changelog. Auth *was* on this list too and reversed
earlier: see above.

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

### 2026-09-12 — Post-submission: build break fixed, native-only gap found, roadmap opened

First session after the 2026-09-11 submission. No app code changed.

- **Fixed a build break caused by branch-switch drift**, in two stages. The
  dev server failed with `Module not found: Can't resolve
  '@prisma/adapter-libsql'` — `node_modules` held `@prisma/adapter-pg` (the
  `vercel-postgres` branch's adapter) while `package.json` on this branch
  asks for libsql; both `node_modules` and `lib/generated/prisma` are
  gitignored so neither follows a checkout. `npm install` fixed that and
  surfaced the second, more confusing one: `The Driver Adapter
  '@prisma/adapter-libsql', based on 'sqlite', is not compatible with the
  provider 'postgres' specified in the Prisma schema` — thrown by the stale
  *generated client*, baked for Postgres, while `prisma/schema.prisma` on
  disk correctly says `sqlite`. Reading the schema proves nothing here.
  `npx prisma generate` fixed it; `next build` then passed clean (12 routes).
  Logged as a gotcha in `HANDOFF.md` — **run both after every branch switch.**
- **Found an undocumented capability boundary: the tracer follows native
  transfers only.** `lib/etherscan.ts:30` uses `action=txlist` (native ETH,
  not `tokentx`) and `lib/tronscan.ts:9-12` already said so for TRX in an
  in-code comment — but the limitation appeared in **no** doc: not `PLAN.md`,
  not `PITCH.md`, not `ARCHITECTURE.md`. Checked specifically for a false
  claim and there wasn't one (the only "token" hits in those files are CSS
  design tokens), so this was an omission rather than an error. It matters
  because USDT-TRC20 is the dominant laundering rail in Indian
  investment-fraud cases: a suspect who moves funds in USDT renders as a
  single node with no outgoing edges, which reads as a bug and is not one.
  `PITCH.md`'s real-vs-simulated table now carries the scope qualifier.
- **Opened `docs/ROADMAP.md`** as the single post-submission engineering
  roadmap, ranked ground-truth capability above heuristic capability. Token
  tracing is item 1. `PITCH.md` §12 was trimmed to pitch-facing prose that
  points at it, `PLAN.md` got a closing pointer (not a rewrite — its header
  forbids that), and `HANDOFF.md`'s header was rewritten: it still told a
  future reader the submission was one day out and to "resist adding scope",
  which would have made it refuse phase-2 work outright.
- **Reframed the approved mixer-correlation experiment before writing it
  down.** It was proposed in-session as amount+timing correlation across a
  mixer; on closer reading that framing is weak against Tornado Cash
  specifically — fixed-denomination pools mean amount carries no signal, and
  large anonymity sets crush the timing prior. Published deanonymizations
  leaned on user error and behavioral fingerprints instead (address reuse,
  linked funding, self-relay, gas fingerprints, multi-deposit patterns). It
  stays on the roadmap as item 7 — last, since it's the only heuristic item —
  with a kill criterion fixed upfront (beat the 1/k anonymity-set baseline on
  known pairs or don't ship) and a hard constraint that a correlated link must
  never merge into the real edge set or feed the actionability score.

### 2026-09-12 (later) — Measured the tracer against a token mover; the headline demo is an interaction, not a transfer

Orientation session over `docs/`. **No app code changed, nothing committed.**
Ran `traceEthereum` directly from a throwaway `tsx` script (never
`POST /api/trace`, per `HANDOFF.md`) and deleted it afterwards.

- **The tracers follow transactions, not transfers.** Nothing filters
  `value == 0`, so a zero-value contract call becomes a graph edge that
  renders with a value label like a payment. A USDT mover
  (`0x93952d09…733b6a`, depth 2) traces to **2 nodes / 1 edge**, and the edge
  points at the **Tether contract** with `valueWei: "0"`, `txCount: 49` —
  the real recipient never appears.
- **So the "native transfers only" write-up from earlier today was half
  right.** The scope claim is accurate; the *symptom* recorded against it
  ("renders a single node and stops") holds only on Tron, which filters
  `contractType === 1`. On Ethereum the trace draws a **phantom node** — the
  token contract — and then expands it like a wallet. Tether returned an
  empty `txlist` (token contracts rarely *send*), but a router or proxy in
  that slot would spend node budget on unrelated counterparties.
- **The headline demo address turns out to be an interaction, not a flow.**
  `0x6eedf92f…728066` — `DEMO_ADDRESSES.md`'s "best headline demo" — has **92
  outgoing transactions, all `value 0` with calldata** (91× `0x2d8a122e`, 1×
  `0x48d3c273`, neither in 4byte), all into `0x27fd43ba…60c9b4`. Two things
  make this more interesting than a bug report: `eth_getCode` shows that
  target is the **Gnosis Safe proxy** bytecode (a multisig smart-contract
  wallet, *not* a token contract — so the "WazirX 2" label is legitimate),
  and all 92 calls fall between **2024-07-18 06:42 and 2024-07-22 06:53
  UTC — the WazirX hack window.** `tokentx` for the address: 0 outgoing
  token transfers. It moved neither ETH nor tokens outward. The graph
  currently shows this as `0.0000 ETH · 92 tx`; "92 calls into WazirX's
  multisig across the four days of the hack" is a better finding than the
  one on screen, and the edge model just can't express it.
- **Corrected two claims I had drafted wrong before they stuck:**
  `recommendVasp` (`lib/scoring.ts:40`) takes `(nodes, vaspRegistry)` and
  reads **no edge values at all**, so "exclude these edges from the score" is
  a no-op — what decides the recommendation is whether the WazirX *node*
  exists, and `bfs.ts` creates nodes inside the edge loop. And zero-value
  edges polluting typology is **already known and mitigated**:
  `lib/typology.ts:11-24` documents the live measurement where near-zero-value
  contract calls cleared the old 3-destination threshold, which is why
  `FAN_OUT_MIN_DESTINATIONS` is 5. `clustering.ts`'s ≥80% ratio is safe too
  (zero adds nothing to `totalOut`).
- **Left entirely unfixed, on purpose.** The three options (drop zero-value
  edges / type them `TRANSFER` vs `CONTRACT_CALL` and keep the node / also
  decode the calldata) differ in what the tool *claims*, and option 1 removes
  the headline recommendation. Written up as `ROADMAP.md` **item 0**,
  deliberately placed *outside* the 1-7 ranking since it's a semantics call,
  with the measured before-baseline for all three ETH demo addresses.
- **Verified `tokentx` for item 1 while there:** live on the v2 API, returning
  `tokenSymbol` / `tokenDecimal` / `contractAddress` alongside `value`. That
  settles item 1's open graph question — assets **cannot** be summed per
  counterparty, since USDT is 6 decimals against ETH's 18 and
  `lib/clustering.ts:39,45` would compare mismatched units.
- Also noted: `traceResult` is a JSON blob, so item 1 needs **no migration** —
  the two-branch schema constraint in `ROADMAP.md` does not gate it.
- Unrelated, observed not acted on: the `Case` table is at **83** rows, not
  the 82 `HANDOFF.md` documents. The extra row is a Bitcoin trace from
  2026-09-12 07:29Z on the investigator account, created before this session
  (this session persisted nothing). Left alone, and `HANDOFF.md` left alone —
  it's the user's own row and their own warning to amend.

### 2026-09-12 (later still) — Shipped ROADMAP item 0: edges now say whether value moved

Option 2 of the three written up earlier the same day. **The fix was chosen
for preserving every measured baseline**, and it does.

- **`TraceEdgeKind = "TRANSFER" | "CONTRACT_CALL"`** on `TraceEdge`, set in
  `lib/tracers/bfs.ts` from whether the edge's *aggregate* value is zero.
  Classifying from aggregate value rather than calldata is a marked
  `ponytail:` shortcut — it misnames exactly one shape (a real zero-value
  native send to an EOA) and the comment names the upgrade path (a
  `hasCalldata` flag on `RawTransfer`; Etherscan exposes `input`, Bitcoin has
  no equivalent).
- **`isContractCall` / `edgeAmountLabel` went into `lib/format.ts`**, not the
  graph component — the canvas and the PDF both consume them, and that file
  already exists to stop exactly this kind of drift (its `LEGAL_BASIS`
  comment says so). `formatValue` / `CHAIN_UNIT` moved along with them, out
  of `components/graph-view.tsx`, which also made them testable at all: the
  component pulls in `next/dynamic` and can't be imported by a bare `tsx`
  script.
- **Canvas:** contract-call edges are dashed, thinner, muted violet, and get
  **zero directional particles** — the particles animate value in motion,
  which is precisely the wrong story for an edge that moved none. New legend
  key "Contract call (no value)", rendered only when the trace has one.
- **PDF:** the summary line called every edge a transfer. The headline
  address's report now reads `3 hops · 2 addresses · 0 transfers · 1
  contract-call link (no value)`, and its evidence trail marks the row
  `contract calls — no value moved`. Checked with `pdftotext`, including the
  `1 link` vs `1 links` pluralization, since this is a legal-facing document.
- **Back-compat treated as a contract.** All 83 stored `Case.traceResult`
  blobs predate the field, so every read tests `=== "CONTRACT_CALL"` and
  never `!== "TRANSFER"`; old cases render as transfers exactly as they did
  when generated. Asserted in `lib/format.test.ts` with a `kind`-less edge.
- **Verified live, and every baseline held.** Node counts, edge counts,
  recommendations, root confidences and typology flags identical to the
  pre-change measurements on all four probe addresses. The headline demo
  still recommends WazirX — `recommendVasp` reads nodes, and the node stayed
  — but its edge now reads `92 contract calls · no value moved` instead of
  `0.0000 ETH · 92 tx`. The USDT mover reads `49 contract calls · no value
  moved`. Bonus finding: the **Binance** demo address had a phantom Tether
  edge of its own (2 zero-value calls), now typed as one.
- **Fixed a precision bug the move exposed.** `formatValue` did
  `Number(BigInt(wei)) / 10 ** decimals` then `.toFixed(4)`, which rendered a
  1-wei transfer as `0.0000 ETH` — the exact string this change set out to
  remove, but on a `TRANSFER` edge, where no dashed line or legend key exists
  to explain it. It also overflowed `Number`'s 2^53 ceiling above ~0.009 ETH,
  so the 4-dp figure was rounded off an already-lossy number. Now scaled in
  BigInt, with a `< 0.0001 ETH` branch for dust; exactly zero still prints
  `0.0000` so pre-2026-09-12 stored cases render as they always did. Asserted
  for dust, legacy zero, and a 123456.789 ETH / 21M BTC overflow case.
- **Then grepped every other edge consumer, and found the fix had missed the
  one that matters most: the legal output path.** Patching the canvas and the
  PDF left three places still treating a contract call as a transfer:
  - `app/page.tsx` and `app/cases/[id]/page.tsx` both printed
    `{graph.edges.length} transfers`. The headline demo's own page therefore
    said "1 transfers" when the honest answer is zero.
  - **`app/api/cases/[id]/sahyog/route.ts` built the disclosure request's
    `evidenceTrail` from every edge's `latestTxHash`, unmarked** — and
    `components/sahyog-button.tsx`'s email draft asks the VASP about "any
    address that **received funds** traced from it, per the evidence trail
    below". For the headline address every hash in that trail is a zero-value
    contract call, so the drafted request asserted a fund movement that never
    happened, in a document drafted under `LEGAL_BASIS`. That is the worst
    place in the app for this bug and the first pass walked straight past it.
  - The trail was also built twice, identically, in the route and the page —
    the page's own comment admitted it was "mirroring" the route.
- **Fixed at the shared root**, in `lib/format.ts`: `evidenceTrail(graph)`
  (transfers first so truncation at 10 can never drop a real transfer for a
  call; call hashes annotated `(contract call — no value moved)`),
  `hasValueTransfer(graph)`, and `edgeCountLabel(graph)` — now the single
  source for `/`, `/cases/[id]` **and** the PDF, which dropped its own local
  copies. The email draft takes a `valueMoved` prop and swaps its whole ask:
  with no transfers it says "The trace recorded no value transfers from this
  address. The evidence below is on-chain contract interactions with your
  platform, not incoming funds." Verified live through
  `POST /api/cases/[id]/sahyog` — the routed payload's trail is the annotated
  single hash, and the case page reads `0 transfers, 1 contract-call link (no
  value)`.
- Checks: new `lib/format.test.ts` (`npx tsx lib/format.test.ts`); all five
  existing self-checks still pass; `tsc --noEmit` and `eslint` clean;
  `next build` clean at 12 routes. Full-stack verified through
  `POST /api/trace` → case page DOM → PDF, and **the test case row that
  created was deleted** (`Case` count back to 83).
- **Browser verification was not possible** — the Claude-in-Chrome extension
  isn't connected in this session, so the dashed-violet edge and the legend
  key were confirmed in the server-rendered DOM and the PDF, not visually on
  the canvas. Worth one look on the next session that has a browser.
- Left alone on purpose: contract-call edges still count toward
  `outgoing.length` and can still inflate FAN_OUT at its threshold of 5. That
  is pre-existing and already mitigated (`lib/typology.ts:11-24`), and
  changing it would alter flag output on stored cases — a different decision
  from how an edge is labelled.

### 2026-09-13 — Shipped ROADMAP item 1: stablecoin tracing (USDT/USDC on ETH, USDT on Tron)

**Not committed** (user asked for no commits). Full design and measurements
are in `ROADMAP.md` item 1. The short version:

- `tokentx` (Etherscan) and `api/filter/trc20/transfers` (Tronscan) now feed
  the same BFS as native transfers. Tokens are **allowlisted by contract**:
  the Binance demo address has a spam `E͏TH` token "sent" from it, which proves
  that's necessary. Zero-value token transfers are dropped.
- The item-0 phantom is fixed where it starts: a zero-value `txlist` tx whose
  hash has an allowlisted token transfer is dropped, and the token transfer
  replaces it.
- `TraceEdge.asset?` (absent = native, same back-compat rule as `kind`).
  Aggregation, `FANOUT_CAP`, the clustering share and PEEL_CHAIN are all per
  asset; FAN_OUT counts destinations. All of these are no-ops on native-only
  graphs.
- Found while verifying: parallel ETH+USDT links to one node would have drawn
  exactly on top of each other on the canvas, so they now get distinct
  curvature. The PDF evidence row names the asset. The native clustering
  reason now says "native-currency value" instead of "value", because
  "forwards 100% of its outgoing value" isn't true once the same node also
  sends USDC elsewhere.
- Baselines: WazirX and Coinbase demo addresses unchanged; the Binance one
  swaps its phantom for 3,754.90 USDT → Binance 14 and gains a real USDC tree;
  all Tron demos keep Bitfinex. Timing is ~1.4–1.6s per expanded node on
  ETH/Tron (two calls per node).
- Checks: all 5 self-checks, `tsc`, `eslint` and `next build` pass. Traces
  ran through the library in a throwaway script (deleted), so no `Case` rows
  were created (still 83). **Not browser-verified**: the dev server was down,
  and logging in means typing a password, which the browser tool won't do.
- `docs/EXPLAINER.md` (untracked, not edited here) still says "native
  transfers only / no USDT" at ~lines 1631 and 1709. Those lines are now
  stale.

### 2026-09-13 (later) — Polygon and Arbitrum chains

Asked for "more wallets than Bitcoin, Tron and ETH". **Not committed.**

- **Scope decision, measured:** Etherscan v2 on the current free key serves
  Polygon (137) and Arbitrum (42161); **BSC, Base, Optimism and Avalanche
  answer "Free API access is not supported for this chain"**. The user picked
  Polygon + Arbitrum on this branch only. BSC (a major USDT rail) is a
  paid-plan decision.
- **One adapter, not three:** `lib/tracers/ethereum.ts` is now `traceEvm`
  keyed by `chainid`; `lib/etherscan.ts` takes a `chainId` and its stablecoin
  allowlist is per chain — each contract verified live against Etherscan's
  own `tokenSymbol`/`tokenDecimal`. Symbols follow each explorer (`USDT0` is
  Tether's rebrand on Polygon/Arbitrum; `USDC.e` is bridged USDC). Native
  units: POL on Polygon, ETH on Arbitrum. One pacing key for all chainids,
  since they share one API key.
- **Address detection:** EVM chains share `0x…`, so `detectChain` became
  `detectChains` (all matches) and the wrong-chain error names "Ethereum,
  Polygon or Arbitrum". `lib/address.test.ts` updated — the non-overlap
  property now holds between chain *families*.
- **Migration:** `20260913183402_add_polygon_arbitrum` — empty on SQLite
  (enums are TEXT), applied with `migrate deploy` after backing the DB up to
  `dev.db.pre-evm-chains`. All 88 cases intact.
- **Labels:** 13 Polygon exchange wallets (Binance ×6, OKX ×3, KuCoin ×2,
  Kraken, Coinbase), each read from PolygonScan's own public name tag, not
  inferred from the Ethereum label of the same address. Bybit and Gate tags
  also verified but skipped — neither is in `vaspRegistry`, so they could
  never be recommended. **No Arbitrum labels:** Arbiscan returns a Cloudflare
  403 to scripts, Etherscan's `getaddresstag` is a paid endpoint, and the
  browser extension wasn't connected — nothing met the seed's verification
  bar.
- **Found and fixed while verifying:** a Polygon trace still drew a phantom
  "34 contract calls" edge into the USDT0 contract. `txlist` and `tokentx`
  are separate 100-row windows and a busy receiver's `tokentx` page is half
  incoming, so it reaches back less far — 34 of 78 `transfer()` calls had no
  matching row. Zero-value txs *into* an allowlisted token contract are now
  never edges (`ponytail:` note on the invisible older transfers).
- **Verified live** (library calls, no Case rows): two Polygon USDT0 senders
  reach **Binance 48** with a medium root ("Forwards 100% of its outgoing
  USDT0…"); two Arbitrum movers produce 38–50-node USDT0/USDC graphs with no
  recommendation, as expected; ETH baselines (WazirX, Binance) unchanged.
  All 5 self-checks, `tsc`, `eslint`, `next build` pass.
- **Label-less chains say so.** Without labels, an Arbitrum trace's "No
  labeled VASP reached" card read as "clean" rather than "can't tell". `bfs.ts`
  now warns when a chain has zero seeded labels (verified: fires on Arbitrum,
  not Polygon), and `/cases/[id]`'s no-VASP card now lists the trace's
  warnings (`/` already showed them).
- Verified through the running app too: a real `POST /api/trace` on Polygon
  persisted a `POLYGON` case (Binance recommendation), its case page and PDF
  returned 200, and the test row was deleted (count back to 88).
- Not browser-verified (extension not connected; login is a password).

### 2026-09-14 — ROADMAP item 2: Bitcoin common-input ownership (attribution only)

**Not committed.** Full write-up in `ROADMAP.md` item 2.

- Measured before building (a throwaway Python BFS against Blockstream,
  mirroring the tracer's fanout/budget): co-input data is already in the
  `/address/:addr/txs` response, so this costs **no extra API calls**; direct
  co-spenders attributed 5 of 60 nodes on `3FrmCRcG…` to Binance and 0 on the
  three backups; growing the labels into their own clusters first added
  nothing, so it wasn't built.
- `lib/blockstream.ts`: returns `coSpenders` (address → evidence txid) with
  a CoinJoin shape guard. `ChainAdapter.fetchOutgoing` now returns
  `{ transfers, coSpenders? }`; ETH/Tron adapters just wrap their arrays.
- `lib/clustering.ts`: `applyCoSpendAttribution` → medium confidence,
  "<label> — same wallet", reason cites the labeled address and txid. Runs
  before the 80%-forward rule. Nodes annotated, not merged; root stays
  SUSPECT. **Not routable** (medium), so recommendations are unchanged.
- **Finding:** the dataset's best demo address `3FrmCRcG…` is itself in the
  same wallet as the seeded Binance cold wallet — the "suspect" is very
  likely an exchange-controlled address.
- Verified live via `traceBitcoin` (script deleted, Case count still 88):
  `3Frm…` 60 nodes / HIGH / FAN_OUT+PEEL_CHAIN / Binance @ hop 4 / 26.5s —
  baseline held; `155Yv…` no attributions; `1CRL…` depth 1 unchanged.
  `clustering.test.ts` extended (attribution precedence, root kind, CoinJoin
  shapes); all 5 self-checks, `tsc`, `eslint` pass.
- **Browser-verified** (user logged in; one real `3Frm…` trace through the
  form, case deleted afterwards, count back to 88): the graph hover label on
  the suspect root reads `Binance (cold wallet) — same wallet (SUSPECT)`, and
  the recommendation card is unchanged (Binance, 4 hops, score 1).
- **Real overflow bug caught there:** the co-spend reason carries a 64-char
  txid, and the node-detail sheet's reason line rendered 408px wide inside a
  351px column. Added `wrap-anywhere` in `components/graph-view.tsx`
  (verified live after the fix below: computed `overflow-wrap: anywhere`,
  351px in a 351px column).
- **The `bookish-v1` service worker was back** — third time on this project.
  The page kept a byte-identical stylesheet without the new utility through
  a `.next` clear and a dev-server restart, which looked like a stale
  Turbopack cache and wasn't: `navigator.serviceWorker.controller` was
  `localhost:3000/sw.js` with cache `bookish-v1`. Compiling
  `app/globals.css` through `@tailwindcss/postcss` directly had already shown
  the class was emitted. Unregistered the worker and deleted the cache; the
  new CSS applied on the next load. Lesson: check the service worker
  *before* restarting anything.
- **Pre-existing bug surfaced, not fixed:** when a trace hits `NODE_BUDGET`,
  `bfs.ts` still pushes the edge to a destination it didn't add as a node.
  `react-force-graph` then throws `node not found: <address>` (Next's "1
  Issue" badge). 2 of the 89 stored cases at the time had such dangling edges,
  both budget-truncated, one Ethereum from before this work. The graph still
  renders. Fix belongs in `bfs.ts` (don't push an edge whose node wasn't
  added) plus a render-side filter for the stored blobs; it changes edge
  counts on truncated traces, so it's left for a separate decision.
- The node-detail sheet itself couldn't be opened by the browser tool (canvas
  clicks kept landing mid re-fit); the wrap fix was measured on an element
  with the sheet's exact classes and width instead.

### 2026-09-14 (later) — Same-wallet leads, and the `3Frm…` demo story corrected

Asked to "do what's viable for an investigator" on the two open questions.
**Not committed.**

- **Same-wallet exchange matches are now leads, not recommendations.**
  `sameWalletLeads` (`lib/scoring.ts`) scores co-spend exchange nodes with
  the same actionability arithmetic, one per VASP (best score, then nearest
  hop), into `TraceGraph.sameWalletLeads`. `recommendVasp` is unchanged and
  still exact-match only, so a lead never reaches the Sahyog payload or the
  email draft. Rendered as its own card on `/` and `/cases/[id]`
  (`components/same-wallet-leads.tsx`) and as a PDF section headed "not a
  basis for this request", each citing the labeled address and the txid
  (`sameWalletEvidence` in `lib/format.ts`). `TraceNode.coSpend` carries the
  evidence; both new fields are optional, so stored cases render unchanged.
- **Deliberately not done: making a lead routable.** It changes what a
  Section 91 draft asserts, so it waits for an explicit yes. If approved: let
  `recommendVasp` accept `coSpend.labelType === "EXCHANGE"` nodes, and make
  the payload and draft state the basis and ask the VASP to *confirm* the
  address is theirs.
- **Measured** (library, no Case rows): `3Frm…` still recommends Binance @
  hop 4, score 1, and now also shows lead Binance @ hop 0, score 5 (5
  co-spend nodes across 4 evidence txs, one shared by two nodes). `1CRL…`
  unchanged (Binance @ hop 1, score 4, no leads).
- **Browser-verified** (one real trace, case deleted, count back to 88):
  lead card text and evidence on `/` and the case page, no overflow at
  desktop or at a 327px card width, and the PDF (inflated and decoded in the
  page) contains the section, the txid, the labeled address and "score 5 (0
  hops)".
- **Demo docs corrected:** `DEMO_ADDRESSES.md`, `DEMO_SCRIPT.md` and
  `HANDOFF.md` no longer pitch `3Frm…` as a laundering trail. It is almost
  certainly Binance's own wallet, and the peel-chain flag fires on exchange
  consolidation.
- Checks: `scoring.test.ts` (lead dedupe, score, evidence, mixer exclusion,
  never in `recommendVasp`) and `clustering.test.ts` (`coSpend` set); all 5
  self-checks, `tsc`, `eslint` pass.

### 2026-09-14 (latest) — Same-wallet matches route, as ownership-confirmation requests

User decision: "make leads routable with the confirm-ownership wording".
**Supersedes the separate leads card from the entry above. Not committed.**

- **`recommendVasp` accepts co-spend exchange nodes** (`coSpend.labelType ===
  "EXCHANGE"`), carrying `sameWallet: { labeledAddress, txHash }` on the
  recommendation. Recommendations are now **one per VASP**. Ranking is score
  first, then exact label over inference, then nearest hop. The forwards-80%
  and fan-in guesses still never route. `TraceGraph.sameWalletLeads` and
  `components/same-wallet-leads.tsx` are removed; no stored case ever had the
  field.
- **The inference is named everywhere it surfaces:**
  - `vaspLine` appends "same-wallet inference — confirm ownership", and
    `components/vasp-rec-line.tsx` prints the evidence under it on `/` and
    `/cases/[id]`.
  - The PDF has an "Attribution basis" row plus the evidence.
  - The Sahyog payload sends `requestType:
    OWNERSHIP_CONFIRMATION_AND_DISCLOSURE_REQUEST` and `attribution: { basis:
    SAME_WALLET_INFERENCE, method, attributedAddress, knownVaspAddress,
    evidenceTx, requestedAction: CONFIRM_OWNERSHIP_BEFORE_DISCLOSURE }`.
    Exact cases send `basis: EXACT_LABEL_MATCH`.
  - The button reads "Route ownership-confirmation request to X".
  - The email draft states it's an inference and cites the tx and the known
    address. It asks the VASP to confirm ownership first, requests KYC only
    if it's confirmed, and asks to be told if not.
- **Verified live** (one trace of `3Frm…`, routed, case deleted, count back
  to 88):
  - The card reads `Binance — 0 hops … score 5 · same-wallet inference —
    confirm ownership` with the evidence line, and no duplicate Binance.
  - The stored top has `sameWallet`, and no alternatives.
  - The button label and payload `requestType`/`attribution` values match
    (compared in the page).
  - The draft text was captured by intercepting `clipboard.writeText`.
  - The PDF contains the basis row, the tx and the known address.
  - Fixed from reading the captured draft: at hop 0 the attributed address
    *is* the suspect, and the draft named it twice.
- **`buildEmailDraft` moved from `components/sahyog-button.tsx` into
  `lib/format.ts`** so the legal wording is finally testable. Nothing could
  reach it before, which is how the 2026-09-12 "received funds" bug survived a
  first pass. The hop-0 fix was then verified by assertion rather than by
  another live trace. That also caught the fix's own flaw: a ~130-character
  line in a draft that otherwise wraps at 70.
- **An older rule was still stated as current** in `lib/clustering.ts`'s
  comment, `PITCH.md` (scoring section) and `EXPLAINER.md` (label DB, "who
  gets scored", principle 3): "only an exact match routes". All three now
  describe the two bases and the ownership-confirmation condition.
- Checks: `scoring.test.ts` (routes, per-VASP dedupe including two exact
  labels of one VASP, exact beats inference on a tie, mixer co-spend
  excluded, exact-only unchanged) and `format.test.ts` (`vaspLine` basis
  suffix, `sameWalletEvidence`, and the draft: hop 0 names the address once,
  hop 2 names both, every line ≤80 chars, no "received funds" in an inference
  draft, exact drafts unchanged). All 5 self-checks, `tsc` and `eslint` pass.
  An exact-match case page (not routed) still reads "Route disclosure request
  to Binance" with no inference text.

### 2026-09-14 (session 2) — Bugs fixed, ROADMAP items 3/5/6 shipped, smaller features, merge

Asked to finish the rest of `ROADMAP.md`, the smaller items, and the known
bugs in one session, browser-verify, update docs, and not commit. Full list
below; two things deliberately **not** attempted are called out at the end.

**Branch state first.** `main` was 52 commits behind this branch with 0
ahead, so `day3-n8n-rehearsal → main` was a clean fast-forward (no merge
commit, nothing to resolve) — done via `git branch -f`, not a commit, so it
respects "don't commit anything." `vercel-postgres` was left alone; merging
it would swap SQLite for Postgres and break the whole session. `HANDOFF.md`
and this file's own recent entries said things were "not committed" — that
was stale, `git status` was clean before any of today's work started, and
`main` is now caught up too.

**Bugs, fixed first because they gated everything else:**

- **Dangling edge at `NODE_BUDGET`** (`lib/tracers/bfs.ts`) — an edge to a
  destination the budget didn't let become a node used to get pushed anyway,
  and `react-force-graph` threw `node not found` on it (flagged, not fixed,
  2026-09-14 earlier the same day). Fixed at the root: the node-creation
  block moved before the edge push, and the edge is skipped when the node
  genuinely isn't there. `components/graph-view.tsx` also filters any edge
  whose endpoint is missing from `graph.nodes`, so the small number of
  already-stored truncated cases with a dangling edge still render.
- **Legal citation was stale.** `lib/format.ts`'s `LEGAL_BASIS` cited
  "Section 91, CrPC" — repealed 2024-07-01. Now cites BNSS Section 94 (the
  actual successor provision, confirmed by web search, not assumed) *and*
  names the old CrPC section for anyone cross-referencing older material:
  `"Section 94, Bharatiya Nagarik Suraksha Sanhita, 2023 (formerly Section
  91, CrPC)"`. Still flagged for legal sign-off before real use, per
  `EXPLAINER.md` Part 10 — this is a correction to a known-stale citation,
  not a claim of legal authority.
- **No minimum recommendation score.** A VASP scoring ≤0 (e.g. Bitfinex 3
  hops out: 0+0+1−3 = −2) was recommended with no distinction from a
  healthy score. `lib/format.ts`'s new `lowActionabilityNote` renders a
  visible warning next to the score on `/`, `/cases/[id]` and the PDF
  instead — the arithmetic stays on screen either way (per `PLAN.md`'s
  differentiation note), it just says plainly when the arithmetic itself
  says "don't expect much."
- **FAN_OUT counted contract-call edges.** Known and flagged since Day 3 as
  a real but low-priority gap (`lib/typology.ts`'s own comment on
  `FAN_OUT_MIN_DESTINATIONS`). Fixed: `destinations` now excludes
  `isContractCall` edges before counting — a node that moved value to 4
  places and made 3 zero-value calls elsewhere is 4 destinations, not 7.
  Deliberately does **not** touch stored `typologyFlags` on existing cases;
  only new traces use the corrected rule, same "don't retroactively change
  what a past trace produced" stance the `FAN_OUT_MIN_DESTINATIONS` history
  already set.
- **Bitcoin change detection was too narrow.** `lib/blockstream.ts` treated
  only a vout *back to the exact input address* as change; a vout to a
  *different* co-spending input (equally provably the same wallet, via the
  same common-input-ownership logic `lib/clustering.ts` already uses) still
  drew as a hop, which could misfire `PEEL_CHAIN` on ordinary
  multi-address-wallet change. Now: a non-CoinJoin tx's change is any vout
  paying back to *any* of its own input addresses, not just the sender.
- **Bitcoin/Tron fetchers had no pagination** — the long-documented
  "~25/~50 most recent txs only" limitation (`DEMO_ADDRESSES.md`'s sweeper
  warning, `ROADMAP.md`'s "smaller items"). Both now page up to 3 pages
  (`MAX_PAGES`), but only *while a page produced zero outgoing transfers* —
  an address that already sent recently costs exactly what it did before,
  so the curated demo addresses' timing is unaffected; only a busy address
  whose own sends are buried deeper pays the extra paced calls.
- **Same-wallet attribution was direct-only.** `lib/clustering.ts`'s
  `applyCoSpendAttribution` only linked a node straight to a *labeled*
  co-spender. Added a second pass: transitive links (A co-spent with B, B
  is itself attributed) propagate to a fixpoint, marked `coSpendVia` and
  suffixed "(transitive)" — deliberately **never** given `coSpend`, so
  `recommendVasp` can't route on it (there's no single tx between the
  address and a *known* VASP address to cite in a request).

**A bug the session's own work introduced and caught live, not in review:**
the OFAC sync (below) blindly upserted every SDN row, and OFAC's own SDN
list includes the seeded SamSam ransomware address — so the live sync
downgraded its hand-verified `RANSOMWARE` label to the generic `SANCTIONED`
one the moment it ran. Caught by checking the DB after the first live sync,
not by inspection. Fixed: the sync now skips any address whose existing
label isn't already `SANCTIONED` (create if absent, refresh if already
`SANCTIONED`, otherwise leave the curated label alone), and reports the
skip count. Verified live, twice: first sync (pre-fix) showed the
downgrade; `prisma/seed.ts` re-run restored `RANSOMWARE`; second sync
(post-fix) reported `0 new, 455 updated, 1 skipped, 456 total` and the DB
confirmed the SamSam row still reads `RANSOMWARE`.

**Smaller items:**

- **Arbitrum exchange labels** — the one item the browser extension
  connecting mid-session actually unblocked. Arbiscan's Cloudflare
  challenge blocks `curl` but not a real browser with a short wait; three
  labels added (`Binance 20`, `Binance`, `OKX 3`), each read from the page
  directly, same provenance bar as every other seed entry. Bybit's hot
  wallet was also confirmed but skipped — not in `vaspRegistry`, same call
  Polygon's seed already made.
- **"Exchange reached, not in the actionability registry."**
  `lib/scoring.ts`'s `unregisteredExchanges` surfaces an exact or
  same-wallet exchange match whose name has no `VaspRegistry` row (e.g. a
  Bybit hit) instead of it silently vanishing from both the recommendation
  and the "no VASP" empty state. Rendered on `/`, `/cases/[id]` and the PDF.
- **Chain auto-switch.** The server already knew the right chain via
  `detectChains`; `app/page.tsx` now switches the selector itself and shows
  a one-line notice when a pasted address is invalid for the selected chain
  but valid for exactly one other — an EVM `0x…` address (ambiguous across
  three chains) still falls through to the server's own "which one did you
  mean" error, deliberately not guessed.
- **Tron/Bitcoin pagination** — listed under bugs above; same commits.

**ROADMAP item 3 — issuer freeze paths, shipped.** New `IssuerRegistry`
model (facts only, deliberately unscored — see its schema comment and the
"unverified optimism worse than omitting" line in `ROADMAP.md` item 3),
seeded with Tether and Circle from their own public statements (verified via
WebFetch/WebSearch this session, sources cited in the seed). `issuerLeads`
(`lib/scoring.ts`) surfaces every stablecoin symbol actually seen on a
trace's edges, regardless of where the trace ended — the issuer can freeze
independent of which exchange (if any) the funds reached. Rendered as its
own block on `/`, `/cases/[id]` and the PDF. Verified live: a real depth-3
trace of `0x1b8214682dee1c3d240e7241ef4e278854a2cdf3` showed both the USDT
(Tether) and USDC (Circle) leads with the correct court-order distinction.

**ROADMAP item 5 — live OFAC sanctions sync, shipped.** `lib/sanctions.ts`
parses OFAC's public `SDN.CSV` export (RFC-4180-ish, no header) for
`Digital Currency Address - <code>` remarks, keeping only currencies this
tool traces (`XBT`→Bitcoin, `ETH`→Ethereum, `TRX`→Tron, `USDT`/`USDC`→both
EVM and Tron) and validating each address against `lib/address.ts`'s own
validators before accepting it. New `SANCTIONED` label/node kind (its own
dark-red shade, distinct from `DARKNET`/`RANSOMWARE`; feeds `CRITICAL` risk
the same way they do). `POST /api/admin/sync-sanctions`, SUPERVISOR-only,
triggered from a button on `/cases`. Verified live twice (see the bug entry
above): 456 crypto addresses across 3 chains, ~17s per sync (455 individual
upserts, acceptable for a manual supervisor action, not a hot path).
Self-check: `npx tsx lib/sanctions.test.ts`.

**ROADMAP item 6 — address watchlist, shipped, deliberately no worker.**
New `Watch`/`WatchAlert` models. `lib/watch.ts`'s `checkWatch` re-fetches one
address's outgoing transfers (reusing the existing per-chain API clients,
not the BFS tracer) and diffs against `lastSeenTimestamp`, creating an alert
per new transfer with the destination's label if any. Three entry points, no
in-app scheduler — `ROADMAP.md` is explicit that a worker is a real
architecture cost this pass doesn't take on: a session-gated "Check now" per
watch (`POST /api/watches/[id]/check`), a bearer-token bulk endpoint for an
external cron/n8n (`POST /api/watches/check-all`, `WATCH_CRON_TOKEN`,
excluded from `proxy.ts`'s session gate the same way the n8n ack routes are),
and a minimal `/watches` page. Verified live: watching the WazirX headline
address found zero alerts (correct — it moves nothing, per `ROADMAP.md` item
0's finding); watching `0x1b8214…` found 10 real alerts, 9 correctly labeled
`Binance 14`. Both demo watches were deleted afterward along with their
alerts (`WatchAlert` doesn't cascade under the raw `sqlite3` CLI without
`PRAGMA foreign_keys=ON` — cleaned up manually, worth remembering next time).

**Smaller items beyond the roadmap's own list:**

- **Chain of custody / audit log.** New append-only, hash-chained
  `AuditEvent` model (`lib/audit.ts`) — each row's hash covers its own
  content plus the previous row's hash, so an edited or deleted row breaks
  every hash after it (tamper-*evident*, not tamper-*proof*: `dev.db` write
  access still lets someone rewrite the whole chain, which the code comment
  says plainly). Wired into login/login-failed, trace, view-case,
  download-report, route-sahyog, vasp-response, draft-narrative,
  watch-add/check and sanctions-sync. `app/cases/[id]/page.tsx` shows a
  per-case timeline plus a whole-log chain-verify (`verifyAuditChain`) so a
  broken link anywhere is visible, not just for this case's own rows.
  Self-check: `npx tsx lib/audit.test.ts`. Verified live: the case page for
  a real trace showed `#1 Ran trace`, `#2 Viewed case`, "hash chain intact."
- **The `confirmedByVaspResponse` feedback loop** (unused since day 1) is
  wired up: `POST /api/cases/[id]/vasp-response` records what a VASP
  actually said (`CONFIRMED`/`DENIED`/`NO_RESPONSE`) on a routed case,
  shown as three buttons on the case page. Deliberately does **not** write
  back into `VaspRegistry.responseReliabilityScore` — that's a seeded,
  hand-verified figure and one case's outcome shouldn't silently drift it.
  `/cases` instead shows an observed response rate per VASP next to the
  seeded score. Verified live: routed a real case, clicked "Confirmed —
  disclosed," watched the dashboard's Binance line move from `0/3` to
  `1/4` responded.
- **LLM-drafted case narrative** — the one roadmap "smaller item" that
  needed the Claude API skill's docs before writing anything (model id,
  request shape). `POST /api/cases/[id]/narrative` sends only the
  already-computed structured facts (risk level, flags, nodes,
  recommendation — never raw trace JSON with room to improvise) to
  `claude-opus-5` with a system prompt that says explicitly: state only
  what the JSON says, never invent or override the risk/score/VASP. Stored
  on `Case.narrativeDraft` so it isn't silently re-generated (real API
  cost) on every page view. `ANTHROPIC_API_KEY` unset in this environment —
  verified live that the route degrades to a clear 503 ("optional, never
  blocks the rest of the app") rather than a raw SDK error, the same
  graceful-degradation contract n8n's `notifyN8n` already uses.

**Verification, live not simulated.** All five original self-checks plus
the two new ones (`audit`, `sanctions`) pass; `tsc --noEmit` and `eslint .`
clean; `next build` clean at **19 routes** (was 12 pre-phase-2). Two schema
migrations applied (`20260914145502_add_phase2_features`,
`20260914145908_add_vasp_response_and_narrative`), `dev.db` backed up
before each (`dev.db.pre-phase2-migration` in the scratchpad, plus the
existing `dev.db.pre-auth`/`dev.db.pre-evm-chains` in the repo root — none
touched). `Case` count held at **89** throughout — the two test cases and
two test watches this session created were deleted afterward, checked by
`createdAt` against the session's own start time before deleting, per this
file's and `HANDOFF.md`'s standing rule. Browser-verified end to end,
logged in as both demo accounts: home page trace (USDT/USDC issuer leads,
FAN_OUT+PEEL_CHAIN with the contract-call fix live), chain auto-switch on a
Bitcoin address pasted with Ethereum selected, case detail page (chain of
custody, narrative graceful-error, VASP-response feedback), PDF download
(200, no console error), Sahyog routing (payload shows the new BNSS
citation), `/cases` dashboard (response-rate rows, supervisor-only sync
button), `/watches` (add, check, real alerts), sanctions sync (twice, to
prove the SamSam-label bug and its fix). No stale service worker this
session (`navigator.serviceWorker.controller` checked first, per the
standing gotcha). Mobile check was partial: the browser tool's window
couldn't go below ~560px on this display (tried 375px and 320px, both
clamped), so `scrollWidth === clientWidth` was confirmed at ~546px but not
at the usual 375px benchmark — worth a real 375px pass next session that
has puppeteer or a narrower display.

**Deliberately not attempted, both explained rather than silently
dropped:**

- **ROADMAP item 4 (bridge traversal).** Explored two real APIs
  (`scan.layerzero-api.com` responds with real cross-chain message data by
  tx hash; `wormholescan.io` and `across.to` also have working lookup
  endpoints) — the ground-truth "follow one bridge message" premise in
  `ROADMAP.md` holds, it's a real, tractable integration. Not built today:
  it needs a bridge-detection step in the tracer, a per-bridge API adapter,
  and a decision on how a resolved cross-chain hop renders without
  claiming the tracer now crosses chains automatically (it wouldn't — this
  would be a one-hop lookup, not a second tracer). Left as a scoped-but-
  not-built item rather than a rushed integration on top of everything
  else today.
- **ROADMAP item 7 (mixer demixing).** Explicitly out of scope for this
  session on purpose, not for lack of time alone: `ROADMAP.md` frames it as
  a standalone experiment with a kill criterion (beat the anonymity-set
  prior or don't ship) and a hard constraint that a correlated link must
  never merge into the real edge set or feed the score. Building that
  properly is its own session's work, not a bullet in a day that already
  touched the tracer, the scoring, and the legal-output path — the
  project's own stated risk ("a heuristic that routes a real disclosure
  request is a worse failure than no feature") is exactly what rushing it
  would risk.
- **BSC and the other Etherscan-free-tier-refused chains, MCP server,
  encryption at rest, SSO, multi-investigator collaboration** — all still
  blocked on the same external inputs `ROADMAP.md` already named (a paid
  Etherscan plan, a non-cookie credential path, and genuinely new
  infrastructure respectively). Nothing changed about their status today.

**Known follow-up, not a regression:** the VASP-response buttons and the
narrative card on `/cases/[id]` only appear after the *next* page load
following a Sahyog routing click — the page is a React Server Component, so
`SahyogButton`'s client-side `routed` state flipping doesn't retroactively
reveal server-rendered content gated on `kase.status`. Same pattern the
page already had for everything else it server-renders; noted rather than
silently worked around, since a proper fix (lifting routed state up, or a
router refresh call) touches `SahyogButton` and is a small enough change to
leave for a session with more room to verify it doesn't disturb the
existing flow.

### 2026-09-14 (session 3) — Money-tracking: received-in-trace, live balances, cross-case VASP inflow

Asked "can we track how much money has gone to each wallet." Three distinct
questions, asked and built together (user picked all three when offered the
choice), each costed and scoped differently:

- **Received within a trace — free, every node.** `lib/format.ts`'s new
  `sumValuesByAsset`/`assetTotalsLabel` sum a node's incoming edges by asset
  (no extra API calls — the tracer already fetched them);
  `lib/tracers/bfs.ts` attaches the result as `TraceNode.receivedInTrace`.
  Shown in the graph's node detail sheet and the PDF's hop narrative. Zero
  totals are filtered out before they're even stored — a node reached only
  via zero-value `CONTRACT_CALL` edges isn't "received" anything, and
  showing "0.0000 ETH" would read as an observation instead of the absence
  of one, the same mistake `ROADMAP.md` item 0 already fixed for edges
  themselves.
- **Each wallet's real balance/lifetime total — one extra paced call, scoped
  to the root and LABEL_MATCH nodes only, not every intermediary.** New
  `getNativeBalance` (Etherscan), `getAddressStats` (Blockstream),
  `getAccountBalance` (Tronscan), wired through a new optional
  `ChainAdapter.fetchStats`. **Deliberately asymmetric, and stated as such**:
  Bitcoin gets a real `totalReceivedBaseUnits` (Blockstream's
  `chain_stats.funded_txo_sum` indexes an address's entire confirmed
  history, a genuine lifetime figure); Ethereum/Polygon/Arbitrum/Tron only
  get `balanceBaseUnits` (current holdings) — none of their free-tier APIs
  expose a real total-ever-received without paginating full history, and
  claiming one would overstate what was actually observed, the same
  discipline the CONTRACT_CALL/TRANSFER split already established. Both
  fields are best-effort: a failed stats call leaves them unset rather than
  failing the trace. Scoping to root+LABEL_MATCH (not every node) was a
  deliberate cost decision, following `ROADMAP.md`'s own standing warning
  that per-node API additions need measuring, not assuming — a typical
  judged demo trace has 1-3 such nodes, not dozens.
- **Money into each VASP, across every stored case — a new dashboard card,
  not a per-trace figure.** `lib/scoring.ts`'s `aggregateReceivedByVasp`
  parses every case's stored `traceResult` (a second O(all-cases) pass
  alongside the existing typology-flag tally, same `ponytail:` cost note),
  sums confirmed-transfer edges into each exact-label `EXCHANGE` node,
  grouped by (VASP name, asset symbol) — **never blended into one dollar
  figure**, since there's no live price feed here and inventing a
  USD-equivalent would be exactly the kind of unverified figure
  `IssuerRegistry` already refuses to produce. Same-wallet (co-spend)
  matches are excluded — an inference isn't confirmed money to a VASP.
  Rendered on `/cases` as its own card, next to the existing "Most-
  recommended VASPs" chart.

**Two real bugs the live dashboard check caught, not code review — both the
same shape, both fixed the same way "a zero isn't an observation" was
already fixed for edges and receivedInTrace:**

- `aggregateReceivedByVasp` was originally summing `CONTRACT_CALL` edges
  too, so a VASP reached only by zero-value calls (Kraken, in the live
  data) printed "0.0000 ETH" — a payment of nothing, read as a payment.
  Fixed by skipping `isContractCall` edges before summing.
- Even after that fix, Kraken's row still showed "0.0000 ETH" — traced to a
  **pre-2026-09-12 stored case** whose edge has no `kind` field at all
  (back-compat reads it as `TRANSFER`, correctly, per the standing
  contract) but whose stored `valueWei` is a literal `"0"` — a relic of the
  same pre-fix phantom-edge behavior `ROADMAP.md` item 0 already documents.
  Rather than special-case every historical reason a total could land on
  exactly zero, `aggregateReceivedByVasp` now filters any `(vasp, symbol)`
  total of exactly zero at the end, regardless of source. Verified by
  direct DB query before and after: Kraken's row disappeared entirely (its
  only total was zero), Bitbns's real `1.0000 TRX` and WazirX's real
  `1220870.2687 TRX` stayed, and WazirX's own spurious `0.0000 ETH`
  component (same root cause) disappeared alongside it.

**Verified live, not simulated.** All 7 self-checks pass (new assertions in
`lib/format.test.ts` for `sumValuesByAsset`/`assetTotalsLabel`/
`formatAssetValue`/`formatBySymbol`, and in `lib/scoring.test.ts` for
`aggregateReceivedByVasp` including the co-spend-exclusion and zero-total
cases), `tsc --noEmit` and `eslint .` clean, `next build` clean. Three real
traces run through the actual app: the WazirX headline address (confirmed
`receivedInTrace` correctly *absent* — it only ever received zero-value
calls — and a real root balance of 0.304 ETH); a Bitcoin trace on
`1CRLGcaXajtWVF5EopZgQUqE12dKn8Rtuh` (confirmed a real non-zero
`receivedInTrace` on an intermediary, a real root `totalReceivedBaseUnits`
of 15,010 sats — a small dormant address, matches its `DEMO_ADDRESSES.md`
description — and a real **15,654,676 BTC** lifetime total on the Binance
exchange node — *corrected 2026-09-16: this line originally said 15,654.68,
a 1000× misread; Blockstream confirms the larger figure, which is recycled
hot-wallet inflow across 1.19M txs, and the PDF prints it correctly*); and the
`/cases` dashboard's new card, checked before and after the zero-total fix
via a direct query against the live DB (`aggregateReceivedByVasp` run
against all stored cases through a throwaway script, deleted after). PDF
verification was partial: `GET /api/cases/[id]/report` returned 200 with no
server error for a case carrying all three new fields, but the actual
downloaded file's text wasn't inspected — the browser tool's download
didn't save this session (a repeat of the known `renderToBuffer`-under-raw-
`tsx` limitation meant a throwaway script couldn't render it either,
documented in this file's 2026-09-07 entry). Worth a `pdftotext` pass next
session that can actually save the download. The three test cases created
during this verification (`cmu1hqpb9…`, `cmu1hri5h…`, `cmu1hsxcl…`) were
deleted afterward, checked by `createdAt` first — the count was 98 at the
end, not 89: the user ran 9 real traces of their own between sessions,
correctly left untouched.

**Deliberately not done:** no USD/blended-currency total anywhere (no live
price feed, and estimating one risks the exact "invented figure" this
project's honesty discipline exists to prevent); no balance/received data
for plain intermediary nodes (cost-scoped to root+LABEL_MATCH, see above);
no token (stablecoin) balance fetching for item 2 — only native currency,
since Etherscan's balance endpoint is native-only and adding per-token
balance calls would reopen the same per-node-cost question `ROADMAP.md`
already flags for items 1 and 2.

### 2026-09-16 — Session 3's three open items closed

- **Sahyog routing needed a reload — fixed, along with two siblings that
  had the same bug.** `/cases/[id]` is a Server Component: the status badge,
  `VaspResponseForm` and the chain-of-custody timeline all come from the
  server render, so a client component's local state flip can't update
  them. All three mutating client components on that page now call
  `router.refresh()` on success: `sahyog-button.tsx`,
  `vasp-response-form.tsx` (its `VASP_RESPONSE` custody row was also stale)
  and `case-narrative.tsx` (same for `DRAFT_NARRATIVE`). `refresh()` keeps
  client state (Next 16 `useRouter` docs), so the routed payload and any n8n
  warning stay on screen. HANDOFF claimed the narrative card itself was
  status-gated; it isn't. `sanctions-sync-button.tsx` and
  `watches-panel.tsx` were checked and left alone: `/cases` renders no label
  data, and the watches panel fetches its own list client-side.
  - **Browser-verified** with a no-reload marker on `window`: routing flipped
    the badge TRACED → ROUTED and showed the response form and the
    `ROUTE_SAHYOG` row. On a second test case, clicking "Confirmed" added the
    `VASP_RESPONSE` row. The marker survived both. The narrative success path
    is **not** browser-verified: `ANTHROPIC_API_KEY` is unset in dev, so the
    route returns 503 before the refresh line.
  - **Deliberate side effect — each refresh writes a `VIEW_CASE` audit row.**
    `page.tsx` audits every render unconditionally, so an action now logs
    e.g. `ROUTE_SAHYOG` followed ~70ms later by `VIEW_CASE` (measured on the
    test case's rows). Kept: it's exactly the row the old manual-reload
    workaround wrote, and the page really did re-send the case to that user.
    If the log should record only human-initiated views, dedupe `VIEW_CASE`
    per user+case over a short window in `page.tsx` — that's an
    audit-semantics decision, not made here. Also seen, pre-existing: the
    login redirect (`router.push` + `router.refresh` in `app/login/page.tsx`)
    writes two `VIEW_CASE` rows ~120ms apart for one arrival.
  - `tsc --noEmit` and `eslint .` clean project-wide, and `next build` clean
    (runs alongside `next dev` on Next 16, which builds into `.next/dev`).
- **`fetchStats` timing — measured A/B.** A throwaway `tsx` script called
  `traceChain` with the real adapters, with and without `fetchStats`
  (library calls only, no `Case` rows; deleted after). Interleaved B/A/B/A:

  | Trace | no stats | with stats |
  |---|---|---|
  | ETH `0x1b82…` depth 3 (34 nodes) | 12.1s / 11.7s | 12.7s / 12.5s |
  | Tron `TZ44…` depth 3 (2 nodes) | 1.3s / 1.3s | 4.0s / 2.7s |
  | BTC `3Frm…` depth 5 (60 nodes) | 22.8s / 17.6s | 19.2s / 17.6s |
  | 3 concurrent ETH, depth 3 — wall | 14.1s / 14.2s | 17.7s / 17.9s |

  Every run had exactly 2 stats targets and got both balances. Graphs were
  identical across arms, and there were no `NOTOK`s. The concurrent cost
  lands on the short traces: `0x82c7…`/`0x6eed…` go ~2.4-4.2s → ~6.7-8.0s,
  because their stats calls wait behind the long trace's calls on the one
  per-process Etherscan queue. Kept as is — acceptable at demo pacing. If
  concurrent one-hop latency ever matters, the upgrade is fetching stats
  after the trace response, not dropping the feature.
- **PDF money fields — verified.** A real `GET /api/cases/[id]/report`
  download (BTC `1CRLGc…`, depth 1) through `pdftotext`: root shows current
  balance + all-time total received, the intermediary shows received in
  trace, and the Binance node shows `received in trace: < 0.0001 BTC`,
  balance 0.0914 BTC and total received 15,654,676.1374 BTC (cross-checked
  against Blockstream directly; session 3's entry misquoted it and is
  corrected above).

- **`DEMO_SCRIPT.md` re-measured and rewritten.** One-hop traces now take
  1.9-3.1s, not ~1s: live balance calls, plus `tokentx` on ETH. The
  headline trace takes 2.9s through the real route, with n8n down (the
  Docker daemon wasn't running). `3Frm…` depth 5 takes 20.8s. Results are
  unchanged: WazirX 8, Binance, Bitfinex, same-wallet Binance. The
  rewrite adds steps for chain of custody, in-place routing, VASP responses
  and the money cards; a table of optional beats; `pgrep`+`kill` in place
  of `pkill`; a "never delete `AuditEvent` rows" reset rule; and a
  98-case baseline. Found while re-verifying the PDF text: the summary
  line printed `1 hops` — `lib/pdf/report.tsx` now pluralizes it the way the
  score row below it already did.

The three test cases this session created (`cmu30pq7x…`, `cmu30zm4f…`,
`cmu3140oy…`) were deleted after checking `createdAt`/`createdById`; the
count is back to 98.
Their audit rows were deliberately **kept** — `AuditEvent.caseId` isn't a foreign key, and
deleting audit rows would break the hash chain for every later event.

## Next up

**Updated 2026-09-16:** session 3's open items (Sahyog reload, `fetchStats`
timing, PDF verification) are closed — see the entry above. Next real
candidates are unchanged: `ROADMAP.md` item 4 (bridge traversal) or a
smaller open item.

**Updated 2026-09-14 (session 3):** Money-tracking (received-in-trace, live
balances/totals, cross-case VASP inflow) is done — see the entry directly
above. Next real candidates unchanged from session 2: `ROADMAP.md` item 4
(bridge traversal, scoped) or one of the smaller open items (BSC, MCP
server, encryption at rest).

**Updated 2026-09-14 (session 2):** `ROADMAP.md` items 3, 5 and 6 are done.
Item 4 (bridge traversal) is scoped and two real bridge-lookup APIs are
confirmed working, but not built. Item 7 (mixer demixing) stays explicitly
parked — see the entry above for why. Next real candidates: item 4, or one
of the "smaller items" still open (BSC, an MCP server, encryption at rest).

**Updated 2026-09-14 (earlier):** item 2 is done. Same-wallet exchange matches route
as ownership-confirmation requests. Item 3 (issuer freeze paths) is next.

**Updated 2026-09-13:** `ROADMAP.md` items 0 and 1 have both shipped. Item 2
(BTC common-input clustering) or item 3 (issuer freeze paths, which item 1
just unblocked) comes next.

**Updated 2026-09-12 — the submission has happened.** All ten original plan
items shipped, plus auth and RBAC, and the app is demo-ready end to end.
Phase-2 priority order now lives in **[`ROADMAP.md`](./ROADMAP.md)**, ranked
ground-truth capability first: token/stablecoin tracing (the tracer is
native-only today, item 1), Bitcoin entity clustering, issuer freeze paths,
bridge traversal, live label sync, monitoring, and the mixer-demixing
experiment last as the one heuristic item.

**`ROADMAP.md` item 0 (edge TRANSFER vs CONTRACT_CALL) shipped 2026-09-12** —
see the two entries below. **Item 1 (token/stablecoin tracing) is next**, and
two of its open questions are already settled: `tokentx` is verified live on
the v2 API, and it needs **no migration**, because `Case.traceResult` is a
JSON blob — so the two-branch schema constraint does not gate it. Its graph
question is settled too: assets cannot be summed per counterparty (USDT is 6
decimals against ETH's 18).

**Before starting it, note that nothing from 2026-09-12 is committed** — see
`HANDOFF.md`'s STATE paragraph. Eleven source files, six docs, and two
untracked additions (`docs/ROADMAP.md`, `lib/format.test.ts`) are all
verified but uncommitted.

Two constraints gate most of it, both written up in `ROADMAP.md`: the two
branches have diverged enough to break a build on switch, so schema work
costs two migrations until that's reconciled; and extra per-node API calls
fight `withPacing`, which already makes a deep trace ~25s.

The remaining pre-submission tasks below (timed dry-run, pitch rehearsal,
demo-day checklist) are **moot** — kept as history. `docs/DEMO_SCRIPT.md` is
still accurate if the app ever needs demoing again.

Everything from here down is the pre-submission record.

Separately, and **not** part of the plan: a Vercel deploy exists on the
`vercel-postgres` branch (Prisma Postgres, code complete, never deployed —
`docs/DEPLOY.md`). It is optional, last in priority, and must not be merged
into the demo branch before demo day: the demo's offline fallback depends on
SQLite being a local file. Summary of what was already open before auth
landed, most urgent first:

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

### 2026-09-16 (later) — Case narrative moved from Claude to Gemini

- **Why: cost, not capability.** The Anthropic API is pay-as-you-go with no
  free tier; a key on a zero-balance account returns
  `400 credit balance is too low`, which is what the feature actually hit on
  first live use. Google AI Studio issues a free, rate-limited key, so the
  optional narrative now runs on Gemini instead of not running at all.
  The earlier entries (2026-09-14 session 2, and the 2026-09-16 entry above)
  describe the Claude implementation as it stood then — left as history.
- **What changed.** `@anthropic-ai/sdk` → `@google/genai` (the only file that
  imported it was `app/api/cases/[id]/narrative/route.ts`);
  `ANTHROPIC_API_KEY` → `GEMINI_API_KEY`; UI copy in `case-narrative.tsx`
  now says "drafted by Gemini". The hard constraint is untouched: same system
  instruction, same facts-only payload, prose only, never the score, risk
  level or recommendation.
- **Model id came from the API, not from docs.** `gemini-2.5-flash` returned
  `404 … no longer available to new users`, naming `gemini-3.6-flash` as the
  replacement. Took the live provider error over the cached SDK README.
- **Thinking tokens count against `maxOutputTokens` — this truncated the
  first working draft.** A 1024-token budget sized for "3-5 sentences" was
  spent thinking, and the route persisted a narrative that stopped
  mid-sentence (`… exhibits "`). Fixed at the root with
  `thinkingConfig: { thinkingLevel: MINIMAL }` (a caption over
  already-computed JSON needs no deep reasoning) plus a 4096 budget — and,
  because this text is persisted and quoted in the PDF, a
  `finishReason === MAX_TOKENS` guard that throws instead of saving a
  half sentence into a case file. Guard verified by forcing a truncation
  with `maxOutputTokens: 40`, not just by reading the code.
- **`flex: 1` collapsed the new PDF paragraph.** The narrative is now its own
  "Case summary (AI-drafted)" section in the report, above the VASP
  recommendation, with an amber note naming the model, the draft time, and
  the fact that the risk/score/recommendation are rule-based. First render
  reused `styles.value`, whose `flex: 1` is correct in a `row` but collapses
  a full-width paragraph's height — the narrative, its caveat and the next
  section drew on top of each other. Only caught by rendering the PDF to PNG
  and looking at it; the extracted text alone read as fine.
- **Verified:** live narrative on case `cmu0uvhc1…`, complete and ending in a
  full stop; PDF rendered and visually checked both with a narrative and on a
  case with `narrativeDraft: null` (section correctly absent); `tsc --noEmit`
  and `eslint` clean; all seven `lib/*.test.ts` self-checks pass.
- **Watch point — free tier means quotas.** A rehearsed-twenty-times demo can
  hit a per-minute/per-day cap, which surfaces as a red 502 on the case page.
  Harmless (the rest of the case page is unaffected), and `DEMO_SCRIPT.md`'s
  troubleshooting table now has a row for it.

### 2026-09-16 (later still) — Dashboard case list: search + filters, bounded height

- **Plan item 7 (case dashboard) enhanced.** The case table rendered all 89
  rows inline, so the page just got taller with every trace. It now sits in a
  `max-h-[26rem]` scroll pane with a sticky header, and has a search box
  (matches address *or* recommended VASP) plus risk / chain / status filters.
- **Filtering is client-side over the rows the page already fetched** — no
  extra query and no round-trip per keystroke. Marked `ponytail:` in
  `components/cases-table.tsx`: push it into the Prisma query if the caseload
  ever reaches thousands.
- **`bg-card` can't be used for a sticky header in this design system.**
  First version used it and rows scrolled *visibly through* the header —
  `--card` is deliberately translucent (`/ 70%` light, `/ 6%` dark) because
  the cards are a glass surface with `backdrop-blur-xl`. `--popover` and
  `--muted` are translucent too; `--background` is the only opaque surface
  token, so the header cells use `bg-background`. Sticky + background sit on
  the `th` cells rather than `thead`, which paints reliably.
- **`<SelectValue />` renders the raw value, not the item label.** All three
  filter triggers read "ALL" until each was given a render function
  (`{(v) => v === ALL ? "All chains" : v}`). Worth knowing: the same is true
  of the chain select on `/` and in the watches panel, which show the raw
  enum (`ETHEREUM`) rather than "Ethereum" — left alone, not this change.
- **Browser-verified in both themes**: searched "Bitfinex" → 14 of 89, which
  matches the inflow card's "Bitfinex · 14 cases"; risk=HIGH → 8 of 89, which
  matches the "High / critical risk 8" tile with 0 CRITICAL in the
  distribution chart; HIGH + "Bitfinex" → the "No cases match these filters."
  empty state; sticky header checked against scrolling rows in dark and light.

### 2026-09-16 (yet later) — BNB Chain, Sahyog trace-intake API, DeFi bridge identification

Three problem-statement-26182 gaps closed in one session, prompted by an
explicit line-by-line comparison against the PS text.

**1. BNB Chain (`Chain.BSC`) — verified live, not just wired.**

- Etherscan's free tier refuses chainid 56 outright (`"Free API access is
  not supported for this chain"` — re-confirmed live, and re-checked three
  alternatives: legacy `api.bscscan.com` redirects to v2, Routescan answers
  "chain not supported" for 56, no public Blockscout instance for BSC
  exists), so this chain needed a second provider: **Ankr's Advanced API**
  (`lib/ankr.ts`, `lib/tracers/bsc.ts`). JSON-RPC, not REST — a real second
  client, not a chainid added to `lib/etherscan.ts`.
- **Two response-shape details weren't in Ankr's docs** (which field, if any,
  distinguishes a native-coin balance in the `assets` array). Rather than
  guess one string and silently return `"0"` on a miss — a wrong balance
  with no error, exactly what this project's whole ethos argues against —
  `pickNativeAsset` tries three plausible shapes in order (`tokenType ===
  "NATIVE"`, no `contractAddress`, symbol match) and only gives up after all
  three miss. Covered by a new self-check, `lib/ankr.test.ts`.
- **Live-verified once a key was available**: traced the seeded `Binance Hot
  Wallet 20` BSC address end to end. Returned balance
  `6735702781977868879800439` wei — **6,735,702.78 BNB, matching BscScan's
  own live richlist figure for that exact address to the same precision.**
  Confirms the hex-value decoding, the transaction-fetch shape, and
  `pickNativeAsset` all landed correctly on the first live call.
- **7 labeled BSC addresses seeded**, individually verified on BscScan (which
  is Cloudflare-gated to scripts like Arbiscan was — unblocked the same way,
  a real browser session): Binance 7, Binance 70, Binance Hot Wallet 20,
  Binance 28, Kraken 1, Coinbase 1, OKX 33. Four of these are the exact same
  `0x…` address already seeded on Ethereum/Polygon — real cross-chain
  hot-wallet reuse (one keypair, many EVM chains), confirmed individually on
  BscScan rather than assumed from the other chain's label.
- New chart color needed: the dashboard's 5 chain colors were a single blue
  lightness-ramp with none spare, so a 6th chain got `--chart-6` as a hue
  shift (violet) rather than a darker blue that would have crowded
  `--chart-4`/`--chart-5`.
- `lib/address.test.ts`'s `EVM` list needed `BSC` added — a real test
  correctly caught the addition, not a bug this work introduced.

**2. `POST /api/sahyog/trace` — the inbound half of "integrate Sahyog with
blockchain intelligence APIs."**

PS 26182 asks the system to "automatically analyze suspect cryptocurrency
wallet addresses reported during investigations on the Sahyog Platform."
There's no public Sahyog API to integrate against yet (same honesty as the
existing outbound `app/api/cases/[id]/sahyog` route), so this is the inbound
half, shaped to be wired to one when it exists.

- Bearer-token gated (`SAHYOG_API_TOKEN`), same pattern as
  `app/api/watches/check-all`: excluded from `proxy.ts`'s session-cookie
  matcher, does its own `timingSafeEqual` check, 401 on missing/wrong token
  verified live.
- The trace-and-persist logic that used to live inline in
  `app/api/trace/route.ts` moved to `lib/trace.ts` (`parseTraceInput`,
  `runTrace`) so the session-gated UI route and this token-gated machine
  route share one implementation — a validation or scoring change can't
  drift between the two callers.
- `createdById: null` on the resulting `Case` — the accurate representation
  of "no human investigator authored this, one has to pick it up." Verified:
  a `SUPERVISOR` session sees it (200), the `INVESTIGATOR` demo account does
  not (404) — same RBAC as every other case. Audit row carries
  `"source":"sahyog"` in its detail, so the chain-of-custody log can tell an
  automated intake apart from a human-run trace.
- **Known interaction, not a bug**: `prisma/seed.ts`'s existing "backfill
  cases with no owner to the demo investigator" step (originally written for
  the 81 pre-auth cases) runs on every `db:seed` and will reassign any
  automated-intake case the same way. Running `db:seed` between rehearsal
  and a live demo of this feature would silently remove the "no human
  owner" property being demonstrated — noted in `DEMO_SCRIPT.md`.
- Live-verified end to end with a real Ethereum trace through this route
  (WazirX recommendation, score 8) before BSC's key arrived, then again
  against a bridge-labeled address (below).

**3. DeFi bridge / cross-chain-swap identification — the plumbing already
existed, only the seed data was missing.**

PS 26182 asks for "identification of ... DeFi bridges ... and cross-chain
swap services." `LabelType.BRIDGE` was already in the Prisma schema and
`NodeKind`/`components/graph-view.tsx` already had a color (teal) and a
legend entry for it — nothing rendered it because nothing was ever seeded as
one.

- 5 addresses seeded, from Etherscan's own "Bridge" label directory
  (`etherscan.io/accounts/label/bridge` — also Cloudflare-gated, unblocked
  the same real-browser way): LayerZero Swappable Bridge, MetaMask Meta
  Bridge, Mayan Swap Bridge (explicitly a cross-chain *swap service*, the
  PS's other named category), Synapse Protocol FastBridge, and Arbitrum's
  official L1↔L2 Outbox.
- No code changes needed for scoring/risk: `lib/scoring.ts` already only
  recommends `kind === "EXCHANGE"` (a bridge contract correctly never
  becomes a VASP disclosure target) and risk-level derivation already never
  escalated on `BRIDGE` (using a bridge isn't inherently suspicious the way
  mixer use is) — both already correct by construction.
- **The honest boundary, stated on purpose**: a `BRIDGE` match stops the
  trace and identifies it, exactly like `MIXER`/`EXCHANGE` do
  (`lib/tracers/bfs.ts`'s stop check doesn't care which label type matched).
  It does **not** claim to follow the funds across to the destination chain
  — that's the harder half this project already scoped and deferred
  (`ROADMAP.md` item 4: LayerZero/Wormhole/Across message-lookup APIs,
  verified reachable in a prior session, not wired in). Seeding bridge
  labels without also building the cross-chain follow-through would have
  risked exactly the overclaim ROADMAP.md itself already flagged as the risk
  here, so that boundary is deliberate, not an oversight.
- Live-verified: traced a real sender to the seeded LayerZero bridge address
  on Ethereum, confirmed `kind: "BRIDGE"`, `stopReason: "LABEL_MATCH"`,
  `recommendation: null` in the JSON, and the teal "Bridge" node rendering
  correctly on the actual graph in a browser session (not just the API
  response).

**Verified across all three**: `tsc --noEmit` and `eslint` clean, `next
build` succeeds (still 20 routes total — BSC and the new endpoint didn't
break anything static-generation depends on), and all 8 self-checks pass
(`lib/ankr.test.ts` is new; `lib/address.test.ts`'s EVM-chain list updated to
include BSC).

**Still not attempted, on purpose**: Solana. It's the other chain PS 26182
names, but it's non-EVM (a new address format, a new validator regex) with
no Etherscan-family API — every real provider (Helius, Solscan, QuickNode)
gates behind its own signup, meaning a second full BNB-Chain-sized arc
(provider research, a key, a live-shape-mismatch risk) for one more chain.
Deliberately not started this session rather than rushed to an
unverified-on-demo-day state, which is exactly the risk BNB Chain just
walked through carefully.
