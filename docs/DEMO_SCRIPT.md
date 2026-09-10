# VASPtrace — demo runbook

Step-by-step script for the judge-facing demo, including the n8n canvas.
Written 2026-09-10; every timing and command here was measured or run on
that date, not estimated.

Companion docs: [`DEMO_ADDRESSES.md`](./DEMO_ADDRESSES.md) (why each address
was picked), [`PITCH.md`](./PITCH.md) (the narrative), [`HANDOFF.md`](./HANDOFF.md)
(current state).

---

## The one thing that will bite you

n8n's **test-mode webhook fires exactly once per arming.** You click
"Execute workflow" on the canvas, and the *next single call* runs. The call
after that returns 404, the app shows an "n8n unreachable" warning banner,
and the canvas sits there doing nothing.

That is the price of the good visual. Production mode (`/webhook/…`) never
needs arming and never fails, but the editor canvas shows **nothing** live —
executions only appear under the Executions tab after the fact.

**So: arm immediately before each trigger, every time.** The script below
puts each arming step right where it belongs.

---

## Pre-flight (do this 15 minutes before, not during)

### 1. Docker + n8n

```bash
docker ps                      # expect vasptrace-n8n-1 running
docker compose up -d           # if it isn't
```

If the daemon is down with an `iptables`/`nf_tables` error (this has
happened twice on this machine after a kernel upgrade):

```bash
sudo modprobe nf_tables && sudo systemctl start docker
```

If it still fails, check `uname -r` against `ls /lib/modules/` — a mismatch
means the running kernel has no module tree on disk and needs a **reboot**.
Budget 5 minutes for that; don't discover it at T-2.

### 2. Confirm both workflows are live

```bash
curl -s -o /dev/null -w "trace: %{http_code}\n" -X POST \
  http://localhost:5678/webhook/vasptrace-trace \
  -H 'Content-Type: application/json' -d '{"caseId":"preflight","hitVaspOrMixer":false}'
```

`200` means n8n is up, the workflow is Published, and the webhook is
registered. If you get `404`, open n8n and check both workflows show
**Published** in the top right.

n8n workflow URLs (bookmark both, you need them in separate tabs):

| Workflow | URL |
|---|---|
| Tracing Pipeline | `http://localhost:5678/workflow/oaqzv5c4RzfmOO9a` |
| Sahyog Mock Routing | `http://localhost:5678/workflow/dga5qK9kjEgVaF8C` |

> If the `n8n_data` volume was ever wiped, n8n will ask you to create an
> owner account on first boot, and both workflows need re-importing from
> `n8n/workflows/*.json` and re-publishing. That is a 10-minute job, not a
> 1-minute one — check this the day before, not on the day.

### 3. Switch to test mode (this is what makes the canvas light up)

```bash
sed -i 's|/webhook/vasptrace-|/webhook-test/vasptrace-|g' .env
```

`.env` is read at boot, so the dev server must restart after this.

### 4. Start the app clean

```bash
pkill -f "next dev"; rm -rf .next
npm run dev
```

Clearing `.next` is not superstition — a stale Turbopack module has twice
made a correct change look broken in this project.

### 5. Browser checks

- Open `http://localhost:3000/login`, sign in as
  `investigator` / `vasptrace-investigator-2026`.
- **Check DevTools → Application → Service Workers.** A leftover worker from
  another project on `localhost:3000` will serve a stale bundle and make the
  UI look a version behind. If one is registered, unregister it — or dodge
  the whole problem with `npm run dev -- -p 3001`.
- Set your window layout now: **app on the left, n8n tracing-pipeline tab on
  the right.** Have the Sahyog workflow open in a third tab behind it.

### 6. Dry-run once, privately

Run the full script below start to finish before anyone is watching, then
delete the case rows it created (see *Reset* at the bottom).

---

## The demo — ~7 minutes

### Step 0 — Frame the problem (45s, no clicking)

> "Indian law enforcement can already see where crypto went. What they can't
> easily answer is *which exchange to serve a disclosure request on, and
> whether that exchange will actually respond.* That's what this does."

Don't open with the tech stack. Open with the bottleneck.

### Step 1 — Arm the canvas (5s)

On the **n8n tracing-pipeline tab**, click **Execute workflow** at the
bottom of the canvas. The webhook node shows *"Waiting for you to call the
Test URL"*.

Do this now, quietly, while you're still talking. If you arm it and then
spend two minutes on preamble, that's fine — it waits indefinitely.

### Step 2 — Run the headline trace (~1.5s)

On the app's home page:

| Field | Value |
|---|---|
| Wallet address | `0x6eedf92fb92dd68a270c3205e96dccc527728066` |
| Blockchain | **Ethereum** |
| Max trace depth | **1** |

Click **Run trace**.

Measured: **1.33s**. It returns before you finish the sentence — say
something while it runs or you'll be talking into a completed result.

Expected result: 2 nodes, 1 edge, WazirX at **high** confidence,
recommendation score **8** (FIU-IND registered ✓, India nodal officer ✓,
reliability 4, minus 1 hop).

### Step 3 — The n8n moment (30s) ← *this is the differentiator slide*

Turn to the n8n tab. The canvas now shows:

- Green checkmarks on every executed node
- Green edges labelled **"1 item"**
- The **true** branch flowing into *Push result to VASPtrace dashboard*
- *No VASP/mixer reached* sitting **grey and unexecuted**

> "That's the same pipeline, running for real on the trace you just watched.
> The branch on the left decided this trace *did* reach a VASP, so it took
> the true path and pushed the result back to the dashboard. Nothing here is
> a mockup — but also, none of it is load-bearing. If n8n is down, the trace
> still completes; this is a window onto the pipeline, not the pipeline."

That last sentence pre-empts the obvious "isn't that a fragile dependency?"
question. Say it before they ask it.

### Step 4 — The recommendation, with its arithmetic (60s)

Back on the app. Point at the score breakdown, not the badge:

> "It's not recommending WazirX because it's nearest. It's recommending it
> because WazirX is FIU-IND registered, has an India nodal officer, and has
> a reliability score of 4 — minus one for hop distance, total 8. A closer
> offshore exchange that won't answer an Indian request scores *lower*. The
> arithmetic is on screen because an investigator has to be able to defend
> this in a case file, not trust a black box."

This is the single most important 60 seconds of the demo. Don't rush it.

### Step 5 — The graph and typology flags (45s)

Scroll to the force graph. Click the exchange node — a detail sheet opens
with address, label, and confidence tier.

Note the confidence rule explicitly:

> "Only an exact label match can drive a recommendation. The clustering
> heuristics surface things for attention, but a *guess* never becomes the
> basis of a legal disclosure request."

### Step 6 — The PDF report (30s)

Open the case from `/cases`, click **Download PDF report**. Open it.

> "Generated from the stored trace — no re-computation, no placeholder data.
> Case ID, hop-by-hop narrative, evidence trail with real transaction hashes."

### Step 7 — Arm the second canvas (5s)

**Switch to the Sahyog workflow tab and click Execute workflow.**

This is the step everyone forgets. It is a *separate workflow* with its own
one-shot arming. If you skip it, the next step shows a warning banner
instead of a canvas.

### Step 8 — Sahyog routing (45s)

On the case page, click **Route disclosure request to WazirX**.

The simulated payload renders inline, and the Sahyog canvas lights up in the
other tab. Read the badge out loud rather than letting a judge find it:

> "Labelled *Simulated integration — Sahyog API access not publicly
> available*. There is no public Sahyog API to integrate with. This is
> exactly the payload that would be sent, and it never leaves localhost. We
> didn't want to fake an integration and hope nobody asked."

Volunteering the limitation lands better than being caught on it.

### Step 9 — Close (30s)

Go to `/cases`. The dashboard shows 82 real traced cases, risk distribution,
per-chain breakdown, most-recommended VASPs.

> "Eighty-two real traces against live chain data during development — not a
> handful of cherry-picked screenshots."

---

## If a judge asks to paste their own address

Say yes — but **steer them to Ethereum**. Only 2 of the 15 seeded exchange
addresses are Bitcoin (both Binance), so a random BTC address very likely
traces to a clean graph with no recommendation. Ethereum and Tron have far
better label coverage.

Set **max depth 3**. If it reaches nothing, that is a *correct* result and
there's a designed empty state for it:

> "No labeled VASP within three hops. That's a real answer — it tells the
> investigator this trail doesn't terminate at an exchange we can serve,
> which is different from the tool failing."

Never let a live judge-supplied address be the *first* thing you show.

---

## When something breaks

| Symptom | Cause | Fix |
|---|---|---|
| Canvas doesn't light up, app shows n8n warning banner | Forgot to arm, or already used the one shot | Click **Execute workflow**, re-run. Trace itself was unaffected — say so |
| Test webhook returns 404 | Same as above | Re-arm |
| UI looks a version behind | Stale service worker on `localhost:3000` | DevTools → Application → Service Workers → unregister |
| A change that should work doesn't | Stale Turbopack module | `pkill -f "next dev"; rm -rf .next; npm run dev` |
| All three addresses on a chain fail | The public API is down or venue wifi is blocking it | Switch chains. If all three chains fail, go to `/cases` and walk an existing case — full graph, recommendation and PDF all render from stored data with zero API calls |
| n8n is a mess in front of judges | — | Drop it. Say "the pipeline visualization needs n8n running, I'll show you the executions after" and continue. Nothing else depends on it |

**The all-purpose fallback:** every stored case at `/cases/[id]` renders its
full graph, recommendation, typology flags and PDF **without touching a
single live API**. If the network dies completely, the demo still runs — you
just lose the word "live".

---

## Reset after a rehearsal

Rehearsal traces persist as real `Case` rows and will inflate the dashboard
count you quote in Step 9.

```bash
sqlite3 dev.db "select id, chain, status, createdAt from \"Case\" order by createdAt desc limit 5;"
```

Delete only the rows you just created, by id:

```bash
sqlite3 dev.db "delete from \"Case\" where id='<the-id>';"
sqlite3 dev.db "select count(*) from \"Case\";"   # should return to 82
```

> **Check `createdAt` before deleting anything.** The DB should sit at **82**
> cases. Case `cmtuarozi00008iyf9ma7ibz5` (Bitcoin, 2026-09-09) is the user's
> own trace, not test pollution — see `HANDOFF.md`.

To put `.env` back to production webhooks afterwards:

```bash
sed -i 's|/webhook-test/vasptrace-|/webhook/vasptrace-|g' .env
```

---

## Address cheat sheet

| Address | Chain | Depth | Time | Result |
|---|---|---|---|---|
| `0x6eedf92fb92dd68a270c3205e96dccc527728066` | ETH | 1 | **1.3s** | **WazirX, score 8** — the headline. Dormant since 2024, won't drift |
| `0x1b8214682dee1c3d240e7241ef4e278854a2cdf3` | ETH | 1 | ~1s | Binance 14 — backup |
| `1CRLGcaXajtWVF5EopZgQUqE12dKn8Rtuh` | BTC | 1 | **0.9s** | Binance — most stable BTC pick |
| `TZ44qjhyXiqfW8rXr5U7tAgfS6qdtKKSGD` | TRON | 1 | ~1s | Bitfinex |
| `3FrmCRcGKiTATfreBDM9F17yAUDoDsnWeA` | BTC | **5** | **~25s** | 60 nodes, HIGH risk, FAN_OUT + PEEL_CHAIN, Binance at hop 4 |

**On `3Frm…`:** it is the only address that shows a *messy, realistic*
multi-hop laundering trail — everything else is a clean one-hop graph. But it
costs ~25 seconds of dead air, and it is not pre-verified against drift to
the same standard as the curated set.

Use it only if you have time to fill and a story to tell while it runs
("watch the node count climb — this is what a real peel chain looks like").
Otherwise stick to the 1-hop addresses. Never open with it.

Full provenance for every address is in
[`DEMO_ADDRESSES.md`](./DEMO_ADDRESSES.md); re-verify the curated nine before
demo day, it takes under a minute at ~1s each.
