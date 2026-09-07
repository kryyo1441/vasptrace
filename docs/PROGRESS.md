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
| 5 | Graph visualization | **Done** — force-directed graph, color coding, click → detail sheet, edge tooltips, per-chain unit formatting (ETH/BTC/TRX). |
| 6 | n8n workflow visualization | **Done** — `docker-compose.yml` + two workflows in `n8n/workflows/`, fire-and-forget notify (`lib/n8n.ts`) from the trace and Sahyog routes. n8n is optional and never blocks/fails either flow — verified live with an unreachable webhook URL. |
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

## Next up

All ten plan items have a first pass — nothing blocks an end-to-end demo
(paste address → live trace → graph → n8n canvas → scoring/recommendation →
PDF report → mock-route to VASP), which was the plan's stated definition of
done for the week. Day 1 finished all of it; days 2-5 are hardening and
demo-rehearsal, not new scope. See PLAN.md's
["Day-by-day schedule"](./PLAN.md#day-by-day-schedule-added-end-of-day-1)
section for the actual breakdown. Two items called out there worth
repeating here since they're the biggest open risks:
- Item 1: no pagination on the Bitcoin/Tron fetchers (Blockstream caps at
  ~25 recent txs, Tronscan capped at 50) — fine for a demo trace, would
  matter for a real caseload.
- Item 6: someone needs to actually `docker compose up`, import both
  workflows, and confirm the canvas executes live during a real demo run —
  the code path is verified, the n8n side isn't.
