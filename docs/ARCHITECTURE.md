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
  `vercel-postgres` branch; see `docs/DEPLOY.md` **on that branch** (it does not exist on this one, so the link would 404 here), including what it
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
- **`POST /api/watches/check-all` (added 2026-09-14) is the second
  server-to-server route, and it isn't unauthenticated like the ack
  endpoints — it triggers real API calls and writes alert data, so it
  carries its own bearer-token check (`WATCH_CRON_TOKEN`, constant-time
  compared) instead of relying on the session cookie an external scheduler
  can't supply. Same reasoning as the ack endpoints (no browser session
  exists to check), different conclusion (this route does enough to need a
  credential of its own).

## Chain of custody

Added 2026-09-14, closing a gap `PITCH.md` §12 already promised: "who ran
what, when, and what did the report say at the time." `AuditEvent`
(`lib/audit.ts`) is append-only and hash-chained — each row's hash covers its
own content plus the previous row's hash, so editing or deleting any row
breaks every hash after it. `verifyAuditChain` walks the whole log and
returns the id of the first broken link, or `null`. This is **tamper-
evident, not tamper-proof**: anyone with write access to `dev.db` can still
rewrite the entire chain from scratch, consistent hashes and all — the guard
is against a row being altered *without* also being caught, not against
someone with database access at all. Anchoring the head hash somewhere
external (a second store, a periodic external write) is the real upgrade,
not built here.

**Currently broken, live, since 2026-09-18** — not a hypothetical: deleting
a session's own test-case rows also deleted their `AuditEvent` rows, which
orphaned every later row's `prevHash` (chained onto the literal last row at
insert time, not `id − 1`). `verifyAuditChain` reports the break starting
at id 250. Left unrepaired on purpose — see `HANDOFF.md`'s 2026-09-18 entry
for why and what fixing it would take. Every action with legal or investigative weight is logged:
login (success and failure), trace, view/download/route/respond/draft-
narrative on a case, watch add/check, and sanctions sync. `/cases/[id]`
renders the case's own timeline plus the whole-log verification result.

Known limitation, stated plainly: there's a chain-of-custody audit log
(above) but no password reset and no SSO. For a real deployment those
matter, along with encryption at rest for the SQLite file. See
[`ROADMAP.md`](./ROADMAP.md).

## Tracer scope — native transfers plus stablecoins

**Updated 2026-09-13:** the tracer runs on **five chains** — Ethereum,
Polygon and Arbitrum (one adapter, `lib/tracers/ethereum.ts`, over Etherscan
v2 with only the `chainid` changing; BSC/Base/Optimism/Avalanche are refused
by Etherscan's free tier), Bitcoin and Tron — and follows **native transfers
plus USDT/USDC on the EVM chains and USDT on Tron**. The EVM chains share an
address format, so a pasted `0x…` address can't be auto-assigned to one: the
chain selector decides, and the wrong-chain error names all three. Arbitrum
has no seeded labels (Arbiscan can't be read by a script, and Etherscan's
name-tag API is paid), so it traces but never recommends. Tokens are allowlisted by
contract address, since spam tokens copy real symbols. Every other token is
still invisible. A token edge carries `asset` and is labelled in that
asset's units; an edge without it is native, which is how every
pre-2026-09-13 stored case reads. See [`ROADMAP.md`](./ROADMAP.md) item 1.
What follows is the pre-2026-09-13 description, kept as history.

Stated plainly because it's easy to assume otherwise: the tracer follows
**native currency transfers only** — ETH, BTC and TRX. It does not follow
ERC-20 or TRC-20 token transfers, so **USDT flows are invisible to it**
(`lib/etherscan.ts` uses `action=txlist`, not `tokentx`; `lib/tronscan.ts`
says the same for TRX in an in-code comment, and
[`DEMO_ADDRESSES.md`](./DEMO_ADDRESSES.md) explains why the Tron demo
addresses were picked from native deposits specifically).

The consequence worth knowing before debugging, **measured 2026-09-12 and
chain-dependent**: on **Tron** a USDT mover really does render as a single
node with no outgoing edges (the adapter filters `contractType === 1`). On
**Ethereum** it does something less obvious — the ERC-20 transfer is still a
transaction *from* the suspect, so the trace draws an edge to the **token
contract** and the real recipient never appears. Either way it looks like a
bug or a dead address and is neither. Closing this is
[`ROADMAP.md`](./ROADMAP.md) item 1 — ranked first because USDT-TRC20 is the
rail most Indian investment-fraud proceeds actually move on.

## Edges say whether value actually moved

The tracers read **transactions**, and a transaction that moves no value is
an interaction, not a payment. So every `TraceEdge` carries
`kind: "TRANSFER" | "CONTRACT_CALL"` (`lib/tracers/types.ts`), classified in
`lib/tracers/bfs.ts` from whether the edge's aggregate value is zero.

This is not a cosmetic distinction, and it is load-bearing in the one place
that matters most. Before it existed, the headline demo address reached
WazirX purely through 92 zero-value calls into WazirX's Gnosis Safe multisig
— and the app rendered that as `0.0000 ETH · 92 tx`, counted it as a
"transfer" on `/` and `/cases/[id]`, and cited its hashes in a **disclosure
request that asks the VASP about addresses which "received funds"**. No funds
had moved. See [`ROADMAP.md`](./ROADMAP.md) item 0 for the measurements.

Everything that reads an edge now goes through `lib/format.ts`, so the canvas,
the PDF and the legal payload cannot disagree:

| Helper | Used by | Behaviour |
|---|---|---|
| `edgeAmountLabel` | graph canvas | `"92 contract calls · no value moved"` — never names a currency or an amount for a call. Dust transfers read `< 0.0001 ETH`, so a real-but-tiny amount can't be confused with nothing |
| `edgeCountLabel` | `/`, `/cases/[id]`, PDF | `"0 transfers, 1 contract-call link (no value)"` |
| `evidenceTrail` | Sahyog payload + email draft | transfers first (so the 10-hash cap can't drop a real transfer for a call), call hashes annotated `(contract call — no value moved)` |
| `hasValueTransfer` | email draft | when false the draft drops the "received funds" ask entirely and says the evidence is contract interactions, not incoming funds |

On the canvas a call edge is dashed, thinner, muted violet and carries **no
directional particles** — the particles animate value in motion, which is the
wrong story for an edge that moved none — plus a legend key shown only when
the trace has one.

**Back-compat is a deliberate contract.** The stored `Case.traceResult` blobs
predate the field, so every read tests `=== "CONTRACT_CALL"` and never
`!== "TRANSFER"`: an old case renders exactly as it did when it was
generated. `lib/format.test.ts` asserts this against a `kind`-less edge.

## What's live vs. simulated

Every non-trivial piece of logic in this codebase is commented inline as
either `LIVE` (real on-chain data, real computation) or clearly marked as a
heuristic/simulation. At a glance:

| Piece | Status |
|---|---|
| Ethereum/Polygon/Arbitrum/Bitcoin/Tron tracers | **Live** — real public block explorer APIs (Etherscan v2, Blockstream, Tronscan), no synthetic data |
| Labeled address DB, VASP registry | **Live** — real, individually-verified public data (`prisma/seed.ts`) |
| Legal-actionability scoring | **Live** — real arithmetic over the seeded registry, not a black box |
| Confidence clustering (medium/low tiers) | **Live** — real graph-structural heuristics, not AI/ML (`lib/clustering.ts`) |
| Typology flags | **Live** — real rule-based pattern detection over the traced graph (`lib/typology.ts`) |
| Auth + RBAC | **Live** — real password hashing, real signed sessions, real per-user case scoping enforced server-side. Demo *accounts* are seeded; the mechanism isn't mocked |
| PDF report | **Live** — generated from the actual persisted trace, no placeholder data |
| n8n pipeline visualization | **Real workflow, illustrative re-check** — the canvas actually executes on real trace data, but the "check against labeled DB" step it shows is a visual mirror of a check Next.js already performed, not a second live lookup |
| Sahyog routing | **Simulated** — no real Sahyog API is publicly available; the JSON payload shown is what *would* be sent, and it's never transmitted anywhere outside the local system |
| Cross-chain bridge correlation | **Scoped, not built** — `ROADMAP.md` item 4; two real bridge-message APIs confirmed working, no code yet |
| OFAC sanctions sync | **Live** — parses OFAC's real public `SDN.CSV` export, `lib/sanctions.ts`, `ROADMAP.md` item 5 |
| Issuer freeze-path facts | **Live data, no scoring** — Tether/Circle's own public statements, `lib/scoring.ts`'s `issuerLeads`; deliberately unscored, see `ROADMAP.md` item 3 |
| Address watchlist | **Live** — real API polling on demand or via an external scheduler, no synthetic alerts, `ROADMAP.md` item 6 |
| Audit log / chain of custody | **Live** — a real hash-chained log of real actions, `lib/audit.ts`; tamper-*evident*, not tamper-*proof* (see its own section below) |
| LLM-drafted case narrative | **Live when configured, optional** — real Gemini API call (`gemini-3.6-flash`) over the already-computed trace facts; drafts prose only, never the score/risk/recommendation. Degrades to a clear error, never blocks the app, if `GEMINI_API_KEY` is unset |
| Money tracking (received-in-trace, wallet balances, cross-case VASP inflow) | **Live** — real chain data throughout; no price feed, so nothing is ever converted to or blended into one dollar figure. See below |

## Money tracking: three questions, three costs

Added 2026-09-14, user-requested. "How much money has gone to each wallet"
split into three genuinely different questions, each answered a different
way and each carrying a different cost:

- **Received within a trace.** Free — `lib/format.ts`'s `sumValuesByAsset`
  sums a node's incoming edges (already fetched by the BFS), grouped by
  asset. Every node. A zero total (reached only via zero-value
  `CONTRACT_CALL` edges) is filtered before it's even stored, not just
  before display — the same "a zero isn't an observation" rule that edge
  typing already enforces (below).
- **A wallet's real balance / total-received.** One extra paced live call,
  so deliberately **not** every node — only the suspect root and any
  `LABEL_MATCH` node, via a new optional `ChainAdapter.fetchStats`.
  Asymmetric on purpose: Bitcoin's `totalReceivedBaseUnits` is a genuine
  lifetime figure (Blockstream's `chain_stats.funded_txo_sum` indexes full
  history); every other chain only ever gets `balanceBaseUnits` (current
  holdings), because their free-tier APIs have no equivalent without
  paginating an address's entire history — showing an approximate "total
  received" there would overstate what was actually observed.
- **Money into each VASP, across every stored case.** A `/cases` dashboard
  card, not a per-trace figure — `lib/scoring.ts`'s `aggregateReceivedByVasp`
  parses every case's stored `traceResult` (a second O(all-cases) pass,
  same `ponytail:` cost note as the existing typology tally) and sums
  confirmed-transfer edges into each exact-label exchange, grouped by VASP
  name **and** asset symbol. Never blended into one dollar figure — there is
  no price feed anywhere in this app, and same-wallet (co-spend) matches are
  excluded, since an inference isn't confirmed money to that VASP.

**Two real bugs, one shape, caught live.** The cross-case aggregation
originally summed `CONTRACT_CALL` edges too, so a VASP reached only through
zero-value calls printed "0.0000 ETH" — the identical mistake "Edges say
whether value actually moved" (below) already exists to prevent, just
reintroduced in a new aggregation that hadn't been taught the rule yet.
Fixed, then a second, subtler case surfaced: a pre-2026-09-12 stored case
(no `kind` field, correctly read as `TRANSFER` by the standing back-compat
rule) whose edge value happened to be a literal `"0"` — a fossil of the
exact phantom-edge bug that rule exists to paper over. Rather than enumerate
every historical reason a total could land on exactly zero, the aggregation
now drops any zero total at the end, regardless of source.

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
