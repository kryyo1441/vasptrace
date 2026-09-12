# VASPtrace — Architecture

Built for Smart India Hackathon problem statement 26182 (MHA / I4C). See
[`PLAN.md`](./PLAN.md) for the full 5-day brief and priority order, and
[`PROGRESS.md`](./PROGRESS.md) for current status against it.

## Stack

- **Frontend/backend**: Next.js 16 App Router, single repo — pages and API
  routes together, no separate backend service (`app/api/*/route.ts`).
- **Database**: SQLite via Prisma ORM (`prisma/schema.prisma`), easy to seed
  and inspect locally. Deliberately a *file*, not a service — it's what makes
  the demo's offline fallback work (`/cases` renders stored cases with no
  network at all). A Postgres port for a Vercel deploy exists on the
  `vercel-postgres` branch; see [`DEPLOY.md`](./DEPLOY.md), including what it
  gives up.
- **Auth**: hand-rolled session auth (`lib/auth.ts`) — Node stdlib only,
  `crypto.scrypt` for password hashing and an HMAC-signed cookie for the
  session. See below for why not `next-auth`.
- **Graph visualization**: `react-force-graph-2d` inside a shadcn Card,
  custom-painted nodes (`nodeCanvasObject`).
- **Charts**: `recharts` via shadcn's chart components — the case dashboard's
  distribution bars and 14-day trend area chart.
- **Theming**: `next-themes`, real light/dark mode keyed off the `--*` token
  pairs in `app/globals.css`.
- **PDF reports**: `@react-pdf/renderer`, rendered server-side in a route
  handler.
- **Workflow visualization**: self-hosted n8n via Docker Compose — see
  below.

## Auth and access control

Added late (day 1 explicitly scoped it out as "single-user demo is fine";
reversed once it was clear the app was one URL away from exposing which
addresses are under active investigation). The design question that matters
isn't the login screen, it's what a session actually authorizes:

- **`proxy.ts`, not `middleware.ts`** — Next.js 16 deprecated and renamed
  the file convention; the old name silently does nothing. It gates every
  route except `/login`, `/api/auth/*`, and the n8n ack endpoints, and does
  a signature-only session check (no DB round trip).
- **Every protected route re-checks itself** via `getCurrentUser()` rather
  than trusting the proxy matcher. This follows Next's own guidance: a
  matcher misconfiguration, or a route added outside its coverage, should
  never be the only thing between a request and case data.
- **Object-level authorization, not just a login gate.** `canAccessCase()`
  is applied in the case detail page, the PDF report route, and the Sahyog
  routing route — so one investigator can't read another's case by guessing
  a case id. The `/cases` list is filtered in the query itself. Supervisors
  bypass both. Denials return 404, not 403, so the response doesn't confirm
  that someone else's case exists.
- **Why not `next-auth`**: it's still v5 beta, and brings
  provider/adapter/callback surface this app doesn't use — there's exactly
  one credentials flow. Node's stdlib covers it in less code with less
  dependency risk.
- **The n8n ack endpoints are deliberately unauthenticated.** They're called
  by n8n itself, server-to-server, with no browser session; they only log
  receipt and return nothing sensitive. Gating them would have broken the
  workflow integration for no real security gain.

Known limitation, stated plainly: there's no audit log, no password reset,
and no SSO. For a real deployment those matter, along with encryption at
rest for the SQLite file. See [`ROADMAP.md`](./ROADMAP.md).

## Tracer scope — native transfers only

Stated plainly because it's easy to assume otherwise: the tracer follows
**native currency transfers only** — ETH, BTC and TRX. It does not follow
ERC-20 or TRC-20 token transfers, so **USDT flows are invisible to it**
(`lib/etherscan.ts` uses `action=txlist`, not `tokentx`; `lib/tronscan.ts`
says the same for TRX in an in-code comment, and
[`DEMO_ADDRESSES.md`](./DEMO_ADDRESSES.md) explains why the Tron demo
addresses were picked from native deposits specifically).

The consequence worth knowing before debugging: a suspect who moved funds in
USDT renders as a single node with no outgoing edges. That looks like a bug
or a dead address and is neither. Closing this is
[`ROADMAP.md`](./ROADMAP.md) item 1 — ranked first because USDT-TRC20 is the
rail most Indian investment-fraud proceeds actually move on.

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
| Auth + RBAC | **Live** — real password hashing, real signed sessions, real per-user case scoping enforced server-side. Demo *accounts* are seeded; the mechanism isn't mocked |
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
