# VASPtrace — 5-day plan

Verbatim brief from day 1 (2026-09-07). This is the source of truth for scope
and priority order — see [`PROGRESS.md`](./PROGRESS.md) for current status
against each item. Don't edit this file to reflect what got built; log that
in `PROGRESS.md` instead.

---

Project: VASPtrace — a blockchain intelligence platform for Indian law enforcement
to trace suspect crypto wallets to the nearest legally-actionable VASP/exchange.
Built for Smart India Hackathon, problem statement 26182 (MHA / I4C).

I have 5 days. Prioritize a working core demo over completeness. Clearly comment/
document which parts are "live/real" vs "simulated for demo purposes."

## Tech stack
- Frontend: Next.js (App Router) + TypeScript + shadcn/ui + Tailwind CSS
- Backend: Next.js API routes / Route Handlers (keep it in one repo, no separate
  backend service unless a specific piece genuinely needs Python — e.g. if you use
  a Python lib for PDF generation, expose it as a small separate service, otherwise
  stay all-TypeScript for simplicity)
- Database: SQLite via Prisma ORM (easy to seed, easy to inspect, migratable later)
- Graph visualization: react-force-graph-2d (or reactflow if it renders cleaner
  inside shadcn's design system — pick whichever integrates best with Tailwind theming)
- Workflow orchestration/visualization: n8n (self-hosted via docker, or n8n cloud
  free tier) — used to visually demonstrate the automated tracing pipeline as a
  live workflow (see section 6 below)
- PDF report generation: @react-pdf/renderer (keeps it in the JS/TS ecosystem,
  avoids a Python dependency)

## Core features (priority order)

### 1. Multi-chain transaction tracer (highest priority, must work live)
- Input: wallet address + chain selector (support Bitcoin, Ethereum, Tron to start)
- Free public APIs: Blockstream/Blockchair (Bitcoin), Etherscan API (Ethereum),
  Tronscan API (Tron)
- Traverse outgoing transactions hop by hop (configurable max depth, default 5),
  building a directed graph of address -> address transfers
- Stop traversal at a node when: (a) matches known VASP/exchange label,
  (b) matches known mixer/high-risk label, or (c) max depth reached
- Handle API rate limits/failures gracefully with clear UI error states
- Implement as a Next.js API route: POST /api/trace { address, chain, maxDepth }

### 2. Labeled address database (seed data, real)
- Prisma schema: LabeledAddress { address, chain, labelType (exchange/mixer/
  darknet/ransomware/unknown), entityName, source }
- Seed script (prisma/seed.ts) populated from public data: known exchange hot
  wallets (Binance, WazirX, Coinbase — publicly documented), OFAC SDN crypto
  addresses, known mixer addresses (Tornado Cash, historical ChipMixer)
- Make the seed script easy to extend

### 3. Legal-actionability scoring (key differentiator — implement fully)
- Prisma model: VaspRegistry { name, fiuindRegistered (bool), hasIndiaNodalOfficer
  (bool), responseReliabilityScore (1-5) }
- Seed with ~15-20 real FIU-IND registered VASPs (WazirX, CoinDCX, ZebPay,
  CoinSwitch, Binance, etc. — mark registration status per public info)
- When multiple VASP nodes appear in a trace, rank by combined score: hop
  distance + label confidence + legal actionability — nearest hop isn't always
  top recommendation if it's a low-actionability VASP
- Surface this explicitly in UI: "Recommended: CoinDCX (2 hops, FIU-IND
  registered, high reliability) over Binance (1 hop, offshore, lower reliability)"

### 4. Confidence scoring for attribution
- Weighted formula: exact label match = high, clustering heuristic match =
  medium, pattern-based guess = low. Document logic clearly in code.

### 5. Graph visualization (shadcn-styled)
- Interactive force-directed graph of the traced path inside a shadcn Card/panel
- Color coding: suspect wallet (red), intermediary hop (muted gray), exchange/
  VASP (green), mixer/high-risk (orange), darknet/ransomware (dark red)
- Click node -> shadcn Sheet/Dialog with address details, labels, confidence
- Edge tooltips showing tx amount + timestamp

### 6. n8n workflow visualization layer (the demo differentiator)
- Set up an n8n workflow that mirrors the backend tracing pipeline as visual
  nodes: [Webhook trigger: receive address] -> [HTTP Request: query chain API]
  -> [Function: check against labeled DB] -> [IF: is VASP/mixer? loop back or
  stop] -> [HTTP Request: push result to VASPtrace dashboard]
- Trigger this n8n workflow from the Next.js app when a trace is run (webhook
  call), and embed/screen-share the live n8n canvas during the demo so judges
  SEE the automation executing hop-by-hop in real time — this is a strong visual
  moment distinct from just showing the final graph
- Keep actual heavy tracing logic in Next.js API routes for reliability; n8n's
  job here is orchestration visibility/demo value, not being the sole engine —
  note this clearly in architecture docs so it's clear n8n isn't a fragile
  single point of failure
- Also build one more n8n workflow for the "mocked Sahyog routing" (section 9)
  since that's inherently a "route this request to an external system" action,
  which is exactly what n8n is good at demoing

### 7. Case dashboard (shadcn Table + Cards)
- List of cases: input wallet, chain, status, recommended VASP, risk level, date
- Case creation flow: paste address -> select chain (shadcn Select) -> run trace
  -> results view
- Use shadcn DataTable component for the case list

### 8. Auto-generated investigation report (PDF)
- @react-pdf/renderer, per case: case metadata, hop-by-hop trace narrative,
  identified VASP with confidence % and legal-actionability reasoning, risk
  classification, typology flags, evidence trail (tx hashes)
- Style like an official investigative document (header/footer, case ID, timestamp)

### 9. Mocked Sahyog routing (clearly labeled as simulated)
- shadcn Button "Route disclosure request to [Recommended VASP]"
- Triggers the n8n mock workflow (section 6), shows simulated JSON payload that
  WOULD be sent to a real Sahyog API, success toast (shadcn Sonner/Toast)
- Clear on-screen badge/note: "Simulated integration — Sahyog API access not
  publicly available"

### 10. Basic typology/pattern flags (rule-based, label clearly as heuristics not AI)
- "Peel chain" pattern, "fan-out"/smurfing pattern, "rapid mixer hop" pattern
- Display as shadcn Badge tags on case/report

## Out of scope for 5 days (mock/roadmap only)
- Real cross-chain bridge correlation — show placeholder "Cross-chain hop
  detected — manual correlation required" when trace hits a known bridge
  contract address
- Real self-learning feedback loop — just add unused `confirmedByVaspResponse`
  field to Case model for now
- Auth/multi-tenancy — single-user demo is fine
- Real Sahyog API integration

## Deliverables
1. Working local dev setup (README, exact run instructions including n8n docker
   setup)
2. Seed scripts with real public data as described
3. Clean structure so I can demo end-to-end: paste address -> live trace ->
   graph view -> n8n workflow visible executing -> scoring/recommendation ->
   generate PDF report -> mock-route to VASP via n8n
4. Inline comments distinguishing real vs simulated logic
5. ARCHITECTURE.md I can lift into a pitch deck, explicitly explaining the
   n8n-as-orchestration-visibility-layer design choice

Start with: project scaffold (Next.js + shadcn init + Prisma setup), then the
Ethereum tracer end-to-end with basic graph view (best free API support via
Etherscan), fully working, before expanding to Bitcoin/Tron and layering in
scoring, n8n, reports, and dashboard.

## Differentiation note (added after day 1, still day 1)

Assessed against generic blockchain-intelligence tools (Chainalysis Reactor,
Elliptic, TRM, Crystal, Arkham): item 3 above — legal-actionability scoring
tied to Indian regulatory reality (FIU-IND registration, nodal officers,
I4C/Sahyog routing) — is the genuine differentiator, not something to invent
on top of the plan. Decision: protect it from being squeezed out by
dashboard/PDF polish later in the week, and make the score's arithmetic
visible on screen (not just a "HIGH risk" badge) so it reads as explainable
rather than a black box. Same applies to item 10 (typology flags) — put them
on the graph itself where the pattern actually happens, not only as a
case-level badge list.

## Day-by-day schedule (added end of day 1)

The original brief didn't split the 10 core items across the 5 days — it
just gave a priority order and said "prioritize a working core demo over
completeness." All 10 items ended up shipping on day 1 (see
[`PROGRESS.md`](./PROGRESS.md) for the detailed changelog), which changes
what days 2-5 are for: not building the remaining scope, since there isn't
any, but making what exists demo-proof. This section is a schedule, not new
scope — priority order above still governs if anything has to be cut.

**Day 1 — done.** All 10 core items (multi-chain tracer incl. Bitcoin/Tron,
labeled DB, legal-actionability scoring, confidence tiers, graph
visualization, n8n visibility layer, case dashboard + detail pages, PDF
report, mocked Sahyog routing, typology flags). Status/detail in
`PROGRESS.md`.

**Day 2 — Hardening & demo-safety.**
- Live-demo risk: the whole tracer depends on Etherscan/Blockstream/Tronscan
  being reachable and not rate-limited *at judging time*. Pre-run and cache
  (or just write down) 2-3 known-good demo addresses per chain so a flaky
  API or venue wifi doesn't sink the live demo — have a fallback path that
  doesn't require live API calls if it comes to that.
- Expand seed data breadth (more labeled addresses, more VASPs) so a wider
  range of addresses land on a label during a live trace instead of running
  out to `MAX_DEPTH`/`NODE_BUDGET` with nothing to show.
- Validate the confidence-clustering thresholds (80% forward ratio, ≥3
  fan-in senders — `lib/clustering.ts`) against a handful more real traces;
  they were tuned on a small sample.
- Etherscan/Blockstream/Tronscan pacing is a fixed delay, not real
  rate-limit tracking (`ponytail:` comments in each tracer) — fine at demo
  volume, worth a sanity check under repeated back-to-back trace runs.
- **UI redesign — current look is default-shadcn-plain, needs to read as a
  premium investigative tool, not a scaffold.** Direction: monochrome
  black/white base (Apple-esque — high contrast, generous whitespace, bold
  large type for headings/numbers) with glassmorphism accents (frosted
  `backdrop-blur` cards/panels, translucent layered surfaces, thin
  hairline borders) rather than flat shadcn Card boxes everywhere. Swap
  every plain-text/emoji-ish UI marker for a real `lucide-react` icon
  (already a dependency — wallet, shield, alert-triangle, network, file-text,
  send, etc. for suspect/risk/graph/report/routing actions). Keep the
  *functional* colors — risk-level badges (green/amber/orange/red) and
  node-kind colors on the graph (`components/graph-view.tsx`'s
  `NODE_COLOR`/`RISK_COLOR` maps) — those carry real meaning (risk,
  entity type) and shouldn't get flattened into the monochrome scheme;
  everything else (chrome, cards, nav, buttons, backgrounds) moves to
  black/white/glass. Touches `app/globals.css` (theme tokens), every page
  (`app/page.tsx`, `app/cases/page.tsx`, `app/cases/[id]/page.tsx`), and
  the shadcn primitives in `components/ui/*`.

**Day 3 — n8n live rehearsal + UI/UX polish.**
- The one item shipped without live verification: actually
  `docker compose up`, import both `n8n/workflows/*.json` files, activate
  them, wire `.env`, and confirm the canvas visibly executes during a real
  trace and a real Sahyog-routing click. Everything else about item 6 was
  verified except this.
- UI polish pass: loading/empty states, mobile responsiveness, basic
  accessibility (contrast, labels) — none of this was checked, only the
  functional paths were.
- PDF report visual polish — functionally correct and legible already, room
  for letterhead/branding treatment.

**Day 4 — Visual overhaul + full dry-run + bug bash.**

> Scheduling note: the visual overhaul below was added at the end of Day 3 and
> is genuinely new scope, not polish — it repaints the whole app and rebuilds
> two pages. Day 4 was already a full dry-run plus bug bash. Do the overhaul
> **first** and the dry-run **after**, never the reverse: a repaint is exactly
> the kind of change that reintroduces the contrast and mobile-overflow bugs
> Day 3 just fixed, so the bug bash has to run against the final look. If both
> don't fit, the dry-run keeps its slot and the *beefy dashboard* (the biggest
> and least demo-critical piece) is the thing to cut into Day 5's buffer.

*Visual overhaul — direction: flashy, colourful, blue.* This supersedes Day 2's
monochrome direction, which landed but reads as too plain. Same rule carries
over though, and it is the one hard constraint: **functional colour stays
functional.** Risk badges (green/amber/orange/red) and graph node-kind colours
encode real meaning — they must not be absorbed into the blue scheme or the
graph stops being readable at a glance. Blue is for *chrome*: backgrounds,
cards, nav, buttons, headings, accents.

- **Graph auto-focus on trace — this is a real bug, not a missing feature.**
  `components/graph-view.tsx` already calls
  `fgRef.current?.zoomToFit(400, 60)` on `onEngineStop` (line ~137), but the
  `<ForceGraph2D>` gets `height={500}` and **no `width`**. `react-force-graph`
  defaults width to the *window* width, so the canvas is laid out far wider
  than its `w-full` container (~940px inside `max-w-5xl`) — `zoomToFit` then
  fits the graph to a canvas whose sides are clipped, which is exactly the
  "I have to zoom out and drag it into view" symptom. Fix: measure the
  container (`ResizeObserver`) and pass an explicit `width`, then re-fit when
  `graphData` changes, not only on `onEngineStop` (a second trace re-runs the
  sim, and a settle that never fires leaves the camera wherever it was).
  Verify at desktop *and* 375px, and with a 1-node graph (degenerate
  `zoomToFit` case).
- **Graph prettiness.** Custom `nodeCanvasObject` instead of default circles —
  glow/halo on the suspect root, entity labels drawn on-canvas rather than
  hover-only, thicker curved links (`linkCurvature`) and
  `linkDirectionalParticles` to animate flow direction along the money trail
  (this reads well on a projector and sells the "tracing" story). Add a small
  legend for node kinds/risk, since the colour coding is currently
  undiscoverable without hovering.
- **Site-wide blue palette.** Rework the theme tokens in `app/globals.css`
  (that's the single source — every page consumes them). Watch out: Day 3
  introduced `--risk-*` light/dark token *pairs* specifically because one hex
  couldn't hit 4.5:1 against both grounds. A blue repaint changes every
  background those sit on, so **re-verify contrast after the repaint** rather
  than assuming Day 3's numbers still hold. `lib/pdf/report.tsx` keeps its own
  literal hex map (PDF can't read CSS vars) and must be updated in step or the
  report will drift from the app.
- **"New trace" as a search-engine page** (`app/page.tsx`). Centred hero,
  large single prominent input, chain selector and depth as quiet secondary
  controls rather than three equal-weight fields in a row; big product mark
  above it; results render below the search after a trace, so the empty state
  reads as a search landing page and the populated state as a results page.
- **Dashboard, big and beefy, with stats** (`app/cases/page.tsx`). Currently a
  plain table. All of the following come from the existing `Case` rows with
  **no schema change** — `Case` already stores `chain`, `status`, `riskLevel`,
  `recommendedVaspId`, `typologyFlags`, `createdAt` and the full
  `traceResult` JSON:
  - Headline stat tiles: total cases traced; disclosure requests routed
    (`status = ROUTED`) vs traced; count of HIGH-risk cases.
  - Risk-level distribution (HIGH/MEDIUM/LOW) — the one chart that most
    justifies the "investigative tool" framing.
  - Cases per chain (ETH/BTC/TRON).
  - Most-recommended VASPs, by frequency of `recommendedVaspId` — directly
    supports the item-3 differentiation story.
  - Most-common typology flags across all cases.
  - Traces over time from `createdAt` (sparkline) — cheap, and makes an
    otherwise static dashboard look alive during a demo.
  Two cautions: total-value-traced requires parsing `traceResult` JSON per
  row, which is fine at demo volume but is an O(all cases) parse on every
  dashboard load — leave a `ponytail:` note if it goes in. And every tile
  needs a real zero state, since a freshly-seeded demo DB may have almost no
  cases.

*Then the original Day 4 work, run against the new look:*
- Rehearse the exact judge-facing path end to end: paste address → live
  trace → graph → n8n canvas executing → scoring/recommendation → generate
  PDF → mock-route to VASP via n8n. Time it.
- Throw adversarial input at it: addresses with zero labeled hits, max
  depth 10, invalid/malformed addresses per chain, a trace that never
  reaches any exchange (no recommendation) — confirm every case degrades
  to a clear UI state, not a blank page or unhandled error.
- Fix whatever the bug bash turns up.

**Day 5 — Buffer + pitch.** *(superseded below — kept for history, not
current scope. The original plan assumed submission at the end of day 5;
the real deadline landed 2 days later, and auth got explicitly pulled back
into scope by the user on 2026-09-09, reversing the "Out of scope for 5
days" call below.)*
- Buffer for day 4's fallout.
- `docs/ARCHITECTURE.md` is written to be pitch-deck-liftable
  (deliverable 5) — do the actual lift and rehearse the narrative,
  especially the item-3 differentiation story (`Differentiation note`
  above) and the n8n-as-visibility-layer framing (not a fragile
  single point of failure — see `ARCHITECTURE.md`).

Out-of-scope items (bridge correlation, `confirmedByVaspResponse`, auth)
stay out of scope through day 5 unless everything above finishes early.
~~Auth~~ — **reversed 2026-09-09**, see below.

---

## Final stretch (added 2026-09-09) — 2 days, ~4 working windows left

Real submission deadline is 2 days out from here, not the end of "day 5"
above — the original day-by-day numbering undercounted. Priority order for
what's actually left, replacing the "Day 5 — Buffer + pitch" stub above:

**1. Auth + RBAC — DONE (2026-09-09).** See `PROGRESS.md`'s "Auth"
changelog entry for what actually shipped and was verified. Landed
essentially as planned below, with two corrections worth flagging since
this section is what someone would follow if they re-read it: the file is
`proxy.ts`, not `middleware.ts` — Next 16 deprecated and renamed the
convention (confirmed in `node_modules/next/dist/docs/` before writing any
code, not discovered by trial and error); and the n8n ack routes ended up
excluded from the auth gate entirely rather than given a shared-secret
header, since that would have meant editing and re-verifying the workflow
JSONs for no real security gain (they only log receipt). Original plan
text kept below as the record of the design reasoning, not edited to match
after the fact.

**Original plan (new scope, reversing the day-1 "Out of scope" call):**
Prompted by a real security question, not feature creep: wallet addresses
themselves are public on-chain data (hashing them or writing them to a
chain does nothing useful — see `PROGRESS.md`'s reasoning if it's ever
re-litigated), but *this app associating a specific address with an active
I4C investigation* is exactly the kind of fact that should not be
readable by anyone who can reach the URL. Today it is — there's no login
at all. Scoped tightly for the remaining time, not full IAM:
- **Hand-rolled session auth, not next-auth** — deliberate call. next-auth
  v5 is still beta, and pulls in provider/adapter/callback surface this
  app doesn't need for one credentials flow. Node's stdlib
  (`crypto.scrypt` + `timingSafeEqual` for password hashing, an
  HMAC-signed cookie for the session) covers the actual requirement in
  less code and less dependency risk two days before submission.
- `User` model (Prisma): `username`, `passwordHash`, `passwordSalt`,
  `role` (`INVESTIGATOR` | `SUPERVISOR`). Seed 2 demo accounts.
- `middleware.ts` gates every route except `/login` — redirect
  unauthenticated requests there.
- **Real trap to avoid**: `app/api/n8n/{trace,sahyog}-ack/route.ts` are
  called *by n8n itself*, server-to-server, with no browser session — a
  blanket session-cookie gate over all of `/api/*` would silently break
  the n8n rehearsal that already took two days to get right. Those two
  routes need a separate guard (a shared-secret header checked against an
  env var), not the session cookie.
- RBAC: `Case` gains `createdById`. `/cases` and the trace API filter to
  the current user's own cases unless role is `SUPERVISOR`, who sees
  everything. This is the one piece of the confidentiality story that
  actually limits blast radius, not just gates a login screen.
- Login page matches the existing blue chrome (reuse `Card`/`Input`, not
  a new design pass). Logout affordance next to the existing theme toggle.
- Explicitly **not** doing: OAuth/SSO, password reset, email verification,
  a full audit-log table (worth a roadmap line in the pitch, not worth
  building — see `docs/PITCH.md`).

**2. n8n + full timed dry-run (carried over from Day 4, unblocked once
Docker is up).** Re-verify the live n8n canvas survived both the repaint
and the new auth gate (n8n's webhook calls hit the ack routes directly,
not through a browser — confirm the shared-secret guard doesn't break
them), then run the full judge-facing path end to end with a clock on it,
2-3 times with different addresses.

**3. Small untested edges** (flagged during the Day 4 bug bash, not yet
closed): double-clicking "Re-route" fast (race on `Case.status`), a valid
address for the wrong chain selector, whitespace/casing on a pasted
address.

**4. Pitch rehearsal.** `docs/PITCH.md` is written as the deck source —
do the actual lift (slides) and rehearse the differentiation-story
narrative (item 3) and the n8n-as-visibility-layer framing.

**5. Demo-day checklist** (not code): what to do if n8n's owner account
needs recreating, a fallback recording of the n8n canvas executing in case
live n8n flakes in front of judges.

Everything else out-of-scope on day 1 (bridge correlation,
`confirmedByVaspResponse`, real Sahyog integration) stays out of scope —
auth was the one reversal, not a general re-opening of scope.
