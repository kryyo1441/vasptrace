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
