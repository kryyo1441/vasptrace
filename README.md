# VASPtrace

Blockchain intelligence platform for tracing suspect crypto wallets to the
nearest legally-actionable VASP/exchange. Built for Smart India Hackathon,
problem statement 26182 (MHA / I4C).

See [`docs/PLAN.md`](./docs/PLAN.md) for the full brief (closed — the
submission shipped 2026-09-11), [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
for how it's built and what's live vs. simulated,
[`docs/PROGRESS.md`](./docs/PROGRESS.md) for current status, and
[`docs/ROADMAP.md`](./docs/ROADMAP.md) for what's next.

Tracer scope: **native transfers only** (ETH/BTC/TRX) — ERC-20/TRC-20 token
flows including USDT are not followed yet (`docs/ROADMAP.md` item 1).

## Setup

```bash
npm install
cp .env.example .env   # fill in ETHERSCAN_API_KEY and SESSION_SECRET — see below
npx prisma migrate dev # creates dev.db and applies prisma/migrations
npm run db:seed        # loads real labeled addresses + VASP registry + demo accounts
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on a login
page. Sign in with one of the two demo accounts `npm run db:seed` creates
(**rotate these before any real deployment**):

| Username | Password | Role |
|---|---|---|
| `investigator` | `vasptrace-investigator-2026` | Investigator — sees own cases |
| `supervisor` | `vasptrace-supervisor-2026` | Supervisor — sees all cases |

`ETHERSCAN_API_KEY` — get one free at etherscan.io/apis. `SESSION_SECRET` —
any long random string, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`;
the app refuses to boot without it rather than silently signing sessions
with `undefined`.

Once signed in, paste a wallet address, pick a chain (Ethereum, Bitcoin, or
Tron all trace live), run a trace.

`TRONSCAN_API_KEY` in `.env.example` is optional — the Tron tracer works
keyless at demo volume.

## n8n (optional)

The workflow-visualization layer (see `docs/ARCHITECTURE.md`) is entirely
optional — the app is fully functional without it. To wire it up:

```bash
docker compose up -d
```

Open `http://localhost:5678`, import `n8n/workflows/tracing-pipeline.json`
and `n8n/workflows/sahyog-mock-routing.json`, activate both, and copy each
Webhook node's Production URL into `.env` as `N8N_TRACE_WEBHOOK_URL` /
`N8N_SAHYOG_WEBHOOK_URL`. Restart `npm run dev` to pick up the new env vars.

## Tests

Each non-trivial module has a small `assert`-based self-check, no test
framework:

```bash
npx tsx lib/scoring.test.ts
npx tsx lib/typology.test.ts
npx tsx lib/clustering.test.ts
```
