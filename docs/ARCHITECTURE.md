# VASPtrace — Architecture

Built for Smart India Hackathon problem statement 26182 (MHA / I4C). See
[`PLAN.md`](./PLAN.md) for the full 5-day brief and priority order, and
[`PROGRESS.md`](./PROGRESS.md) for current status against it.

## Stack

- **Frontend/backend**: Next.js App Router, single repo — pages and API
  routes together, no separate backend service (`app/api/*/route.ts`).
- **Database**: SQLite via Prisma ORM (`prisma/schema.prisma`), easy to seed
  and inspect locally.
- **Graph visualization**: `react-force-graph-2d` inside a shadcn Card.
- **PDF reports**: `@react-pdf/renderer`, rendered server-side in a route
  handler.
- **Workflow visualization**: self-hosted n8n via Docker Compose — see
  below.

## What's live vs. simulated

Every non-trivial piece of logic in this codebase is commented inline as
either `LIVE` (real on-chain data, real computation) or clearly marked as a
heuristic/simulation. At a glance:

| Piece | Status |
|---|---|
| Ethereum/Bitcoin/Tron tracers | **Live** — real public block explorer APIs (Etherscan, Blockstream, Tronscan), no synthetic data |
| Labeled address DB, VASP registry | **Live** — real, individually-verified public data (`prisma/seed.ts`) |
| Legal-actionability scoring | **Live** — real arithmetic over the seeded registry, not a black box |
| Confidence clustering (medium/low tiers) | **Live** — real graph-structural heuristics, not AI/ML (`lib/clustering.ts`) |
| Typology flags | **Live** — real rule-based pattern detection over the traced graph (`lib/typology.ts`) |
| PDF report | **Live** — generated from the actual persisted trace, no placeholder data |
| n8n pipeline visualization | **Real workflow, illustrative re-check** — the canvas actually executes on real trace data, but the "check against labeled DB" step it shows is a visual mirror of a check Next.js already performed, not a second live lookup |
| Sahyog routing | **Simulated** — no real Sahyog API is publicly available; the JSON payload shown is what *would* be sent, and it's never transmitted anywhere outside the local system |
| Cross-chain bridge correlation | **Out of scope** — placeholder only, per `PLAN.md` |

## Why n8n is a visibility layer, not the tracing engine

`PLAN.md` item 6 asks for n8n specifically so judges can *see* the pipeline
execute hop-by-hop on a live canvas during a demo — a different, more
visceral kind of evidence than a finished graph on screen. But the actual
tracing (`lib/tracers/*`, `lib/scoring.ts`, `lib/typology.ts`,
`lib/clustering.ts`) has to be reliable and fast regardless of whether n8n
happens to be running, so the design keeps a hard boundary:

- **All real work stays in Next.js.** A trace completes and is persisted as
  a `Case` (`app/api/trace/route.ts`) *before* n8n is ever contacted. n8n
  never blocks, gates, or re-computes anything — it's notified after the
  fact.
- **The notification is fire-and-forget** (`lib/n8n.ts`): a 2-second
  timeout, wrapped in try/catch, returns a soft warning string instead of
  throwing. If n8n is down, unreachable, or was never started, the trace
  and the Sahyog mock-routing flow both complete exactly as if it didn't
  exist — the caller just doesn't get the demo visualization.
- **`N8N_TRACE_WEBHOOK_URL` / `N8N_SAHYOG_WEBHOOK_URL` are optional env
  vars.** Unset (the default), the app runs standalone with zero n8n
  dependency — this is what CI, a judge's laptop without Docker, or a quick
  local check should use.

This is the direct answer to "isn't n8n a fragile single point of failure
for a law-enforcement tool?" — no, because it isn't a point of failure at
all. It's an optional, after-the-fact observer.

### The two workflows

`n8n/workflows/tracing-pipeline.json` mirrors the conceptual pipeline from
`PLAN.md` item 6 node-for-node: Webhook trigger → Code node (visually
echoes the labeled-DB check) → IF (did the trace hit a VASP/mixer?) → HTTP
Request pushing an acknowledgment back to VASPtrace
(`app/api/n8n/trace-ack/route.ts`, which just logs receipt).

`n8n/workflows/sahyog-mock-routing.json` mirrors `PLAN.md` item 9: Webhook
trigger → Code node (annotates the simulated disclosure payload) → HTTP
Request to `app/api/n8n/sahyog-ack/route.ts`. Both ack endpoints are local —
nothing in this system, real or simulated, ever calls out past `localhost`.

### Running it

```bash
docker compose up -d
```

Then open `http://localhost:5678`, import both files from `n8n/workflows/`,
activate them, copy each Webhook node's Production URL into
`N8N_TRACE_WEBHOOK_URL` / `N8N_SAHYOG_WEBHOOK_URL` in `.env`, and restart
`npm run dev`. During a demo, keep the n8n canvas open in a second window —
each trace and each "route disclosure request" click will visibly execute
across it in real time.

If you don't set up n8n at all, nothing else in the app changes — this is
by design, not a degraded mode.
