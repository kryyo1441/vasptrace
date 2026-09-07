# VASPtrace — progress

Status against [`PLAN.md`](./PLAN.md), item numbers match. Update this file
whenever a plan item's status changes — append to the changelog, don't rewrite
history.

## Status

| # | Item | Status |
|---|------|--------|
| 1 | Multi-chain tracer | Ethereum: **live**. Bitcoin/Tron: not started (API route 501s on those chains). |
| 2 | Labeled address DB | **Done** — real seed data (exchange hot wallets, Tornado Cash, OFAC SDN). |
| 3 | Legal-actionability scoring | **Done** — `lib/scoring.ts`, wired into the trace response, rendered on `/`. |
| 4 | Confidence scoring (high/medium/low) | Partial — only "high" (exact label match) exists. Medium/low need clustering heuristics, not built. |
| 5 | Graph visualization | **Done** — force-directed graph, color coding, click → detail sheet, edge tooltips. |
| 6 | n8n workflow visualization | Not started. |
| 7 | Case dashboard | Not started — `Case` Prisma model exists, unused. |
| 8 | PDF report | Not started — `@react-pdf/renderer` not installed. |
| 9 | Mocked Sahyog routing | Not started. |
| 10 | Typology/pattern flags | **Done** — `lib/typology.ts`, flags rendered directly on graph edges/nodes plus a summary badge row. `Case.typologyFlags` (persistence) still unused, that's item 7's job. |

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

## Next up

Per the plan's own priority order: item 7 (case dashboard) before n8n/PDF —
it's cheaper and still load-bearing for the demo narrative (nothing persists
a trace as a `Case` yet, so there's no case list to demo).
