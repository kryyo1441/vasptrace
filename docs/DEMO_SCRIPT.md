# VASPtrace — demo runbook

Step-by-step script for the judge-facing demo, including the n8n canvas.
Written 2026-09-10. **Re-measured 2026-09-16** against the current code
(stablecoin tracing, same-wallet inference, money tracking, chain of custody,
VASP responses, watchlists). Every timing and expected result is measured,
not estimated. The date is noted wherever something wasn't re-checked.

Companion docs: [`DEMO_ADDRESSES.md`](./DEMO_ADDRESSES.md) (why each address
was picked), [`PITCH.md`](./PITCH.md) (the narrative), [`HANDOFF.md`](./HANDOFF.md)
(current state).

---

## The one thing that will bite you

n8n's **test-mode webhook fires exactly once per arming.** You click
"Execute workflow" on the canvas, and the *next single call* runs. The call
after that returns 404, the app shows `n8n webhook unreachable (non-fatal)`
under the result, and the canvas sits there doing nothing.

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

**On 2026-09-16 the Docker daemon wasn't running** (`/var/run/docker.sock`
didn't exist), so n8n was down and every trace printed the unreachable
warning. A stopped daemon just needs starting:

```bash
sudo systemctl start docker
```

If that fails with an `iptables`/`nf_tables` error (this happened twice on
this machine after a kernel upgrade):

```bash
sudo modprobe nf_tables && sudo systemctl start docker
```

If it still fails, check `uname -r` against `ls /lib/modules/`. A mismatch
means the running kernel has no module tree on disk and needs a **reboot**.
Budget 5 minutes for that; don't discover it at T-2.

### 2. Confirm both workflows are live

```bash
curl -s -o /dev/null -w "trace: %{http_code}\n" -X POST \
  http://localhost:5678/webhook/vasptrace-trace \
  -H 'Content-Type: application/json' -d '{"caseId":"preflight","hitVaspOrMixer":false}'
```

`200` means n8n is up, the workflow is Published, and the webhook is
registered. `404` means: open n8n and check both workflows show
**Published** in the top right. `000` means n8n isn't running at all — go
back to step 1.

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

`.env` holds both `N8N_TRACE_WEBHOOK_URL` and `N8N_SAHYOG_WEBHOOK_URL`
(confirmed 2026-09-16). It is read at boot, so the dev server must restart
after this.

### 4. Start the app clean

```bash
kill $(pgrep -f "next dev")    # if one is running
rm -rf .next
npm run dev
```

Use `pgrep` + `kill`, not `pkill -f`. `pkill` hung (exit 144) in the Claude
Code sandbox even with a pattern that matched nothing, and `pgrep` works
everywhere. Clearing `.next` is not superstition: a stale Turbopack module
has twice made a correct change look broken in this project.

### 5. Browser checks

- Open `http://localhost:3000/login`, sign in as
  `investigator` / `vasptrace-investigator-2026`.
- **Check DevTools → Application → Service Workers.** A leftover worker from
  another project on `localhost:3000` will serve a stale bundle and make the
  UI look a version behind (hit again 2026-09-14).
  `navigator.serviceWorker.controller` being non-null in the console is the
  tell. If one is registered, unregister it — or dodge the whole problem with
  `npm run dev -- -p 3001`.
- Set your window layout now: **app on the left, n8n tracing-pipeline tab on
  the right.** Have the Sahyog workflow open in a third tab behind it.
- **Decide about the AI narrative now.** The case page's *Draft narrative*
  button needs `GEMINI_API_KEY` in `.env`. Without it you get a clean
  "Narrative drafting is not configured" message, which is harmless but not
  worth showing. No key means skip that beat.
- **Decide about BNB Chain, Sahyog intake, and bridge identification now**
  (all new 2026-09-16). BNB Chain needs `ANKR_API_KEY`; Sahyog intake needs
  `SAHYOG_API_TOKEN` (both in `.env`). If you're running the Sahyog `curl`
  beat, run it once now during pre-flight — that both rehearses it and
  creates the unowned case you'll point at live later (see **If a judge asks
  about Sahyog**). If you're demoing BNB Chain, run that trace once now too;
  it's only been verified live via a direct API call so far, not rehearsed
  through the UI the way every other chain has.

### 6. Note the case count, then dry-run once, privately

```bash
sqlite3 dev.db 'select count(*) from "Case";'
```

**104 as of 2026-09-16.** Write down whatever it says today: the 6:00 beat
quotes it, and *Reset* returns to it.

**That total is not what the dashboard will show you.** RBAC scopes the list:
the `investigator` account sees only its own cases, the `supervisor` sees all
of them. The query above is the supervisor
number. Demo as `investigator` and you will see the smaller one, which is
correct, not a bug. Read whatever is on screen and don't quote a memorised
figure; if a judge spots the difference, that's a free chance to show the
per-investigator scoping is real and enforced server-side.

Then run the full script below start to finish before anyone is watching, and
reset.

---

## The demo — 7 minutes, told as an investigating officer

**The frame for the whole run.** You are not a developer showing a build. You
are an investigating officer in a state cyber cell who has this tool on your
desk. Open by saying so, then stay in that voice — "a complaint lands on my
desk", "I need to know who to serve", "I have to defend this in a case file".
Every judge in the room has heard ten tech-stack tours. None of them has
watched an officer work a case.

Two rules that save the demo:

- **Narrate the intent before you click, not after.** Say what you're about
  to need, then click. The screen becomes the answer to your sentence instead
  of a thing you explain afterwards.
- **Quote what is on screen, never a memorised number.** Case counts drift
  with every rehearsal, and they differ by who is logged in — RBAC means the
  investigator account sees only its own cases while the supervisor sees all
  (92 vs 101 on 2026-09-16). Read the figure in front of you.

| Clock | Beat | Runs |
|---|---|---|
| 0:00 | Frame it as a case landing on your desk | 0:40 |
| 0:40 | Arm the tracing canvas (silent, while still talking) | 0:05 |
| 0:45 | Run the trace | 0:45 |
| 1:30 | **The recommendation and its arithmetic** ← the one that wins | 1:10 |
| 2:40 | Graph, flags, money | 0:40 |
| 3:20 | The PDF a court would see | 0:30 |
| 3:50 | Arm the Sahyog canvas | 0:10 |
| 4:00 | Route the disclosure request | 0:45 |
| 4:45 | Chain of custody | 0:30 |
| 5:15 | n8n — the optional window onto the pipeline | 0:45 |
| 6:00 | Dashboard: the caseload, and finding one case in it | 0:40 |
| 6:40 | Close | 0:20 |

**This sums to 7:00 with no slack in it.** If you're running long, cut in this
order and nothing important is lost: the optional VASP-response click (0:15),
the two dashboard cards at 6:00 (0:15), the n8n beat entirely (0:45 — it is
explicitly optional, see that section). **Never cut or rush 1:30** — the
arithmetic beat is the one that wins the room. If you're running short, the
extra minute goes to a second trace from **Optional beats** below, not to
padding the close.

---

### 0:00 — Frame it (40s, no clicking)

**Focus on:** the bottleneck, not the technology. Do not open a terminal, do
not name a framework.

> "Think of me as an investigating officer in a state cyber cell. My desk is
> crypto fraud — investment scams, ransomware payouts, UPI fraud proceeds
> being cashed out. A complaint comes in and it gives me one thing: a wallet
> address. I can already see where the money went; a block explorer will show
> me that. What I cannot easily answer is the question my case actually turns
> on — **which exchange do I serve a disclosure request on, and will they
> answer me?** If I pick wrong I lose weeks, and the money is gone. That's
> the gap this closes."

### 0:40 — Arm the tracing canvas (5s, do it quietly)

**Click:** on the **n8n tracing-pipeline tab**, **Execute workflow** at the
bottom of the canvas. The webhook node reads *"Waiting for you to call the
Test URL"*.

Do this while you are still talking. It waits indefinitely, so arming early
costs nothing. Then switch back to the app.

### 0:45 — Run the trace (45s)

**Click:** on the app home page, fill in and press **Run trace**.

| Field | Value |
|---|---|
| Wallet address | `0x6eedf92fb92dd68a270c3205e96dccc527728066` |
| Blockchain | **Ethereum** |
| Max trace depth | **1** |

Start the sentence as you click — it returns in roughly 3 seconds (2.9s
measured 2026-09-16 with n8n unreachable, so treat that as a floor; time it
once in your private dry-run).

> "This is the address off the complaint. I paste it in, pick the chain, and
> the tool walks the money outward hop by hop until it hits something it can
> name — an exchange, a mixer — or runs out of depth."

**Depth 1 is a deliberate choice here, and say so rather than letting it look
like a limitation you didn't notice.** One hop is all this particular trace
needs — the very first hop lands on a labelled exchange, so going deeper
would add nothing. Set it to 1 out loud:

> "I'm setting depth to one because this address deposits straight into an
> exchange — there's nothing past that hop worth walking. On a laundered
> trail I'd raise it."

The full answer to "why are the limits so low" is below under **If a judge
asks about depth, breadth or scale** — have it ready, because it's the most
likely technical question you'll get.

**Expected:** 2 nodes, 1 edge, **LOW** risk, no typology flags, WazirX at
**high** confidence, recommendation score **8**. No issuer freeze leads, which
is correct — no stablecoin moved.

> **Do not say "the funds moved to WazirX." Know this cold.** That edge is
> **dashed violet**, labelled `92 contract calls · no value moved`, and the
> header reads `0 transfers, 1 contract-call link (no value)`. It is correct,
> not a bug. Say instead:
>
> > "Notice it is not claiming a payment here — the edge is dashed because no
> > value moved. What it found is 92 contract calls into WazirX's multisig,
> > all inside the four days of the 2024 WazirX hack. As an investigator
> > that's a *stronger* lead than a transfer. But a tool that drew it as a
> > payment would be lying to me, and I'd have to defend that wording in
> > court. So it doesn't."

**Click:** **Open case, generate report, route disclosure request**. Everything
from here happens on the case page.

### 1:30 — The recommendation and its arithmetic (70s) ← *don't rush this*

**Focus on:** the score breakdown. Point at the arithmetic, not the badge.
This is the single most important minute of the demo.

> "Here's the part that matters to me. It hasn't recommended WazirX because
> WazirX is nearest. It's recommended it because WazirX is FIU-IND
> registered, has an India nodal officer, and has a response reliability of
> 4 — minus one for hop distance. Total, 8. A closer offshore exchange that
> won't answer an Indian request scores *lower* and drops down this list.
>
> And the sum is on the screen. I can put that in a case file, my supervisor
> can check it, and defence counsel can argue with it. What I can't do is
> put 'the software said HIGH RISK' in front of a judge."

### 2:40 — Graph, flags, money (40s)

**Click:** scroll to the force graph, then click a node to open the detail
sheet (address, label, confidence tier, balance).

- **Suspect node:** live balance, **0.3041 ETH** as of 2026-09-16 — it's a
  live figure, so glance at it during pre-flight.
- **WazirX node:** **0.0000 ETH** and **no "received in trace"** line. Both
  correct: nothing was sent to it.

> "Only an exact label match can drive a recommendation. The clustering
> heuristics will flag something for my attention — this looks like a deposit
> address, this looks like smurfing — but a *guess* never becomes the basis of
> a legal request. And the money figures only count value that actually
> moved, which here is none."

If asked what the multisig's zero balance means: that Safe's native ETH
balance *today*. It says nothing about July 2024.

### 3:20 — The PDF a court would see (30s)

**Click:** **Download PDF report** at the top of the case page, and open it.

> "This is generated from the stored trace — no re-computation, no
> placeholder data. Case ID, the hop-by-hop narrative, and an evidence trail
> with real transaction hashes. This is what I attach to the file."

Verified 2026-09-16: summary reads `1 hop · 2 addresses · 0 transfers, 1
contract-call link (no value)`; evidence trail reads `(92 tx, contract calls
— no value moved)`. If you see "1 hops", the dev server is serving a stale
build. The PDF and the screen share the same `lib/format.ts` helpers, so they
cannot contradict each other.

**If the case has an AI-drafted summary**, it appears as its own section
above the recommendation, in amber italics naming the model and the draft
time. One sentence only: *"A drafted summary I review and edit — it writes
prose over facts the tool already computed, and it never sets the risk level
or the recommendation."* Skip the beat entirely if no key is configured.

### 3:50 — Arm the Sahyog canvas (10s)

**Click:** switch to the **Sahyog workflow tab** and click **Execute
workflow**.

This is the step everyone forgets. It is a *separate* workflow with its own
one-shot arming. Skip it and the next step shows an unreachable warning
instead of a canvas.

### 4:00 — Route the disclosure request (45s)

**Click:** back on the case page, **Route disclosure request to WazirX**.

The payload renders inline and the page updates in place — status flips
**TRACED → ROUTED**, a response card appears, custody gains the routing event.
Read the badge out loud before a judge finds it:

> "Labelled *simulated integration*, and I want to be straight about why.
> There is no public Sahyog API to integrate against today. This is exactly
> the payload that would go, shaped the way Sahyog would need it — and it
> never leaves this laptop. We'd rather show you the real shape and say it's
> not wired, than fake an integration and hope nobody asks."

Volunteering the limitation lands better than getting caught on it.

*Optional, 15s:* click a response button (e.g. *No response received*) to
close the loop — it feeds the observed response rate on `/cases`, shown next
to the seeded score and never overwriting it. It changes the dashboard, so
**Reset** afterwards.

### 4:45 — Chain of custody (30s)

**Focus on:** the card reading **"Audit log hash chain intact."** followed by
this case's timeline — trace, report download, routing.

> "Every action with legal weight is logged: who traced, who pulled the
> report, who routed the request. Each entry's hash covers the one before it,
> so deleting or editing a row breaks the chain from that point and this card
> says so. That's tamper-*evident*, not tamper-proof — someone with database
> access could rewrite the whole chain — and I'd rather tell you that than
> overclaim it."

**Before a judge asks:** each action is followed a split second later by a
**"Viewed case"** entry. That's the page re-rendering to show the update, not
a second person.

### 5:15 — n8n: the optional window onto the pipeline (45s)

**Click:** switch to the n8n tabs. Both canvases have now executed — the
tracing one from 0:45, the Sahyog one from 4:00.

**Focus on:** green checkmarks on every executed node, green edges reading
**"1 item"**, the **true** branch flowing into *Push result to VASPtrace
dashboard*, and *No VASP/mixer reached* sitting **grey and unexecuted**.

Lead with what it is, and immediately with what it isn't:

> "This is the same pipeline you just watched, executing for real on my
> trace — not a mockup, not a recording. The branch on the left decided this
> trace *did* reach a VASP, so it took the true path.
>
> But I want to be clear that **none of this is load-bearing.** It's a
> visibility layer, and it's optional by construction. All the real work —
> the trace, the scoring, saving the case — happened inside the application
> and was already written to the database *before* n8n was ever contacted.
> The call out to it is fire-and-forget with a two-second timeout. If n8n is
> down, or not installed, or the webhook URL is unset, the trace completes
> exactly the same and nothing warns me.
>
> It's here because a pipeline you can *watch execute* is easier to trust
> than a finished screen you're asked to take on faith — and because this is
> how it would plug into an agency's existing automation stack. If you'd
> rather I skip it, nothing else in the demo changes."

That last paragraph is the whole point of the beat: it answers "isn't a
workflow tool a fragile dependency for a law-enforcement product?" before
anyone asks it. **If n8n is broken on the day, say exactly that and move on** —
"the pipeline visualization needs n8n running, I'll show you the executions
afterwards" — and you lose nothing but 45 seconds.

### 6:00 — The caseload, and finding one case in it (40s)

**Click:** go to `/cases`.

**Focus on:** first the scale, then the working tools.

> "This is my caseload — every one of these is a real trace against live
> chain data during development, not a handful of cherry-picked screenshots."

Read the count off the screen. Then use the table like an officer would:

**Click:** type a VASP name (e.g. `Bitfinex`) into the search box, then set
the **risk filter to HIGH**.

> "In practice I'm not scrolling this. I'm asking: which of my cases point at
> this exchange, or show me only the high-risk ones — because that's where I
> need to move first."

One sentence each on two cards if time allows:

- **Money into each VASP:** summed per asset, never blended into one figure
  — "there's no live price feed, so it won't invent a rupee number for me."
- **Observed response rate:** what exchanges actually answered, sitting next
  to the seeded score rather than overwriting it.

### 6:40 — Close (20s)

> "Tracing crypto is a solved problem — there are large commercial tools that
> do it better than we ever could in five days. What none of them are built
> around is the question I'm left holding once the trace is done: of the
> exchanges this touched, which one will actually answer an Indian police
> request, and why. That's the decision this tool makes, and it shows me its
> arithmetic while it does it."

---

## Optional beats — only if there's time or a judge asks

| Beat | How | Measured 2026-09-16 | Say |
|---|---|---|---|
| **Stablecoins + freeze paths** | `0x1b8214682dee1c3d240e7241ef4e278854a2cdf3`, ETH, depth 3 | **11.5s**, 24 nodes (34 earlier the same day — live address, drifts), FAN_OUT, Binance, 2 issuer leads | USDT/USDC transfers are traced to real recipients, and the issuer leads show who can freeze: Tether acts on a law-enforcement request, Circle needs a court order (`ROADMAP.md` item 3) |
| **Exchange-owned "suspect"** | `3FrmCRcGKiTATfreBDM9F17yAUDoDsnWeA`, BTC, **depth 5** | **20.8s**, 60 nodes, FAN_OUT + PEEL_CHAIN, Binance **score 5** at hop 0 by **same-wallet inference** | See the cheat-sheet note below — this is *not* a laundering trail. Button reads "Route ownership-confirmation request to Binance" |
| **Watchlist** | `/cases` → **Watchlist**, add an address, **Check now** | not re-measured (2026-09-14: `0x1b82…` produced 10 alerts, 9 labeled `→ Binance 14`) | No background polling by design: checks run on demand or from an external scheduler hitting `/api/watches/check-all` |
| **OFAC sanctions sync** | sign in as `supervisor`, `/cases` → sync button | ~17s, 456 addresses (2026-09-14) | Pulls OFAC's public SDN list, and never downgrades a hand-verified label. Needs venue internet — skip if the network is shaky |
| **AI narrative** | case page → **Draft narrative** | needs `GEMINI_API_KEY` | Prose drafted from the already-computed facts; it can never change the score, risk or recommendation |
| **BNB Chain (new, 2026-09-16)** | `0xF977814e90dA44bFA03b6295A0616a897441aceC`, **BNB Chain**, depth 1 | Live-verified once via API: real balance `6,735,702.78 BNB`, matching BscScan's own figure exactly | "Etherscan's free tier won't serve BNB Chain data at all, so this goes through a second provider, Ankr, with its own client." **Rehearse this one yourself before demo day** — verified once via a direct API call, not yet rehearsed through the UI the way every other chain has been |
| **Bridge identification (new, 2026-09-16)** | `0xa77f2281a4163ff7eafca1dbb625b960adba24cc`, ETH, depth 1 | Live-verified: 1 hop, `LayerZero: Swappable Bridge` node, teal, `recommendation: null` | See **If a judge asks about bridges or cross-chain funds** below — say the boundary out loud, don't wait to be asked |
| **Sahyog automated intake (new, 2026-09-16)** | terminal, not the UI — see **If a judge asks about Sahyog / API integration** below | Live-verified, real recommendation returned | The strongest answer to "is this actually integrated with anything" — a judge watches a `curl` return a real score |

---

## If a judge asks to paste their own address

Say yes — but **steer them to Ethereum or Tron**. Bitcoin exchange labels
are scarce (only Binance addresses are seeded), so a random BTC address very
likely traces to a clean graph with no recommendation. Same-wallet inference
helps a little, but only when the trail co-spends with a labeled wallet.
Polygon has Binance labels; Arbitrum has only three labels in total; BNB
Chain has 7 (Binance, Kraken, Coinbase, OKX) but is the newest chain and
least rehearsed — don't offer it as the option here even though it's
selectable.

Set **max depth 3** and expect **~5-15s** on a busy Ethereum address (each
node costs two paced calls, since tokens are traced too). If the address is
valid on a different chain from the one selected, the error names the right
chain. If it reaches nothing, that is a *correct* result and there's a
designed empty state for it:

> "No labeled VASP within three hops. That's a real answer — it tells the
> investigator this trail doesn't terminate at an exchange we can serve,
> which is different from the tool failing."

Never let a live judge-supplied address be the *first* thing you show.

---

## If a judge asks about depth, breadth or scale

The most likely technical question of the whole session, and the PS itself
asks for "scalable architecture capable of handling large-volume blockchain
transaction analysis" — so have the honest version ready rather than
improvising.

**The actual numbers** (`lib/tracers/bfs.ts`, and the depth input on `/`):

| Limit | Value | What it does |
|---|---|---|
| Max depth | 1-10, default 5 | how many hops outward the trace walks |
| `FANOUT_CAP` | 5 | at each node, follow only the 5 highest-value outgoing destinations |
| `NODE_BUDGET` | 60 | hard stop on total addresses in one trace |

When a trace hits the node budget it says so on screen — *"Node budget (60)
reached — trace truncated before completing all branches"* — rather than
quietly returning a partial graph as if it were complete. Point at that
warning if it appears; it's the honest behaviour, not an error.

**Why they're set low. Three real reasons, in this order:**

> "First, these are free public API tiers. Every hop is a live call to
> Etherscan or Blockstream, and we pace them to one in-flight request per
> chain because we tested it — six concurrent traces produced real rate-limit
> errors, and so did six raw curl calls with no app involved. So the ceiling
> here is the free API key, not the algorithm.
>
> Second, this has to return in seconds in front of you, on venue wifi. A
> wallet with thousands of counterparties would fan out enormously; ranking
> by value and capping breadth keeps a demo trace bounded.
>
> Third — and this is the part that matters — these are three constants in
> one file, not an architectural ceiling. Raising them is a config change, or
> a request parameter. What a real deployment would change is what's *behind*
> them: a paid API tier or a commercial data provider, a proper job queue so a
> deep trace runs as a background job instead of a request that has to answer
> in three seconds, and Postgres instead of the single SQLite file this demo
> runs on."

**Do not claim it already scales.** The honest framing is that the *shape* is
right — one shared BFS engine, thin per-chain adapters, work that's already
bounded and already reports its own truncation — and the limits are tuned for
a laptop on free API keys. Adding Polygon and Arbitrum post-submission
without touching the core tracer is the evidence that the shape holds; adding
BNB Chain through a completely different provider (Ankr, not Etherscan) is
stronger evidence still — a new chain didn't need a new engine, just a new
adapter behind the same interface.

If they push on volume specifically: the dashboard's search and filters run
client-side over rows already fetched, which is right for a caseload in the
hundreds and marked in the code as something to push into the database query
if it reaches thousands. Saying that unprompted tends to land well — it shows
you know where your own ceilings are.

---

## If a judge asks about bridges or cross-chain funds

Say this **before** they ask it, at the point in the demo where a bridge node
would appear (it won't in the headline WazirX trace — this is for the
optional bridge-identification beat, or if a judge's own address happens to
hit one):

> "This is a real bridge contract — LayerZero's — and the tool correctly
> stopped and labeled it, the same way it stops at a mixer. What it does
> *not* claim is where the funds went after crossing to the other chain.
> Following money across a bridge to its destination chain is a genuinely
> different, harder problem — it needs a second lookup against the bridge's
> own message log, not just another block-explorer call. We checked: the
> lookup APIs exist and respond correctly to a real message hash — LayerZero,
> Wormhole, and Across all verified reachable — but wiring that up honestly
> means the result reads as 'this message proves the funds landed on chain X
> at address Y,' not as this tool silently continuing to trace on a second
> chain behind your back. That's scoped and next, not built yet."

The failure mode to avoid: claiming or implying the trace "follows" funds
across a bridge. It identifies the bridge and stops — full stop, and that
sentence should come out of your mouth before a judge has to ask for it.

---

## If a judge asks about Sahyog or API integration

This is the strongest concrete answer available to "is this actually
integrated with anything, or is it just a UI." Have this ready to run live,
not just describe:

```bash
curl -X POST http://localhost:3000/api/sahyog/trace \
  -H "Authorization: Bearer $SAHYOG_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"address":"0x6eedf92fb92dd68a270c3205e96dccc527728066","chain":"ETHEREUM","maxDepth":1}'
```

> "The problem statement asks the system to automatically analyze a wallet
> address reported on the Sahyog Platform. There's no public Sahyog API yet
> to receive real traffic from, so I can't show you Sahyog calling this —
> but I can show you the endpoint that would answer it. No browser, no
> session, no human clicking a button — a bearer token, the same address I
> traced earlier, and it returns the same recommendation, the same score,
> the same confidence tiers. It's a real, running HTTP endpoint today, shaped
> exactly like what a future Sahyog integration would call."

Run it live and let them watch real JSON come back with a `caseId` in it —
say that `caseId` opens on `/cases` right now, under the supervisor account,
unassigned, waiting for an investigator to pick it up. That last detail
matters: it demonstrates the automated-intake case has **no human owner**
until someone claims it, which is the honest shape of what an automated
Sahyog trigger would produce.

**Needs `SAHYOG_API_TOKEN` set in `.env`** (see pre-flight) and the case from
your rehearsal run **not yet reassigned by a `db:seed` re-run** — see *Reset*
below, this is the one rehearsal artifact `db:seed` will quietly break.

---

## When something breaks

| Symptom | Cause | Fix |
|---|---|---|
| Canvas doesn't light up, app shows `n8n webhook unreachable (non-fatal)` | Forgot to arm, used the one shot, or n8n/Docker is down | Click **Execute workflow**, re-run. The trace/routing itself succeeded — say so |
| Test webhook returns 404 | Same as above | Re-arm |
| UI looks a version behind | Stale service worker on `localhost:3000` | DevTools → Application → Service Workers → unregister |
| Case page doesn't update after routing / recording a response | Stale bundle (fixed in source 2026-09-16) | Check the service worker, then restart clean (pre-flight step 4). A reload shows the correct state meanwhile |
| A change that should work doesn't | Stale Turbopack module | `kill $(pgrep -f "next dev"); rm -rf .next; npm run dev` |
| Trace noticeably slower than the cheat sheet | API latency; every trace also makes live balance calls | Keep talking. BTC times varied 17.6-22.8s run to run on 2026-09-16 |
| "Narrative drafting is not configured" | `GEMINI_API_KEY` unset | Harmless. Move on |
| **Draft narrative** turns into a red error mentioning quota / 429 | Gemini's free tier is rate-limited, and rehearsal burns through it | Harmless — nothing else on the page depends on it. If the case already shows a narrative from an earlier draft, talk to that one; otherwise skip the beat |
| Custody card says the hash chain is broken | Someone deleted or edited `AuditEvent` rows | Don't demo that card. See *Reset* — never delete audit rows |
| All three addresses on a chain fail | The public API is down or venue wifi is blocking it | Switch chains. If all chains fail, go to `/cases` and walk an existing case — full graph, recommendation and PDF all render from stored data with zero API calls |
| n8n is a mess in front of judges | — | Drop it. Say "the pipeline visualization needs n8n running, I'll show you the executions after" and continue. Nothing else depends on it |

**The all-purpose fallback:** every stored case at `/cases/[id]` renders its
full graph, recommendation, typology flags, money figures and PDF **without
touching a single live API**. The money figures are the values stored at
trace time. If the network dies completely, the demo still runs — you just
lose the word "live".

---

## Reset after a rehearsal

Rehearsal traces persist as real `Case` rows and inflate the dashboard count
you quote in the 6:00 beat. A recorded VASP response also moves the observed
response rate.

```bash
sqlite3 dev.db "select id, chain, status, createdAt from \"Case\" order by createdAt desc limit 5;"
```

Delete only the rows you just created, by id. Deleting the case also removes
its recorded VASP response from the dashboard:

```bash
sqlite3 dev.db "delete from \"Case\" where id='<the-id>';"
sqlite3 dev.db "select count(*) from \"Case\";"   # back to the pre-demo count
```

> **Check `createdAt` before deleting anything.** The baseline was **104**
> cases on 2026-09-16 (98 earlier the same day, 88 on 2026-09-13, 83 on
> 2026-09-12). Every increase was the user tracing real addresses — plus, as
> of 2026-09-16, real verification traces through `/api/sahyog/trace` — so
> treat it as a landmark rather than a checksum and delete only the rows
> *this* run created. See `HANDOFF.md`.
>
> **One row you may want to keep rather than delete**: a case created
> through `/api/sahyog/trace` has `createdById: null`. If you're planning
> the Sahyog-integration beat (see **If a judge asks about Sahyog**), leave
> that row alone — it's the live evidence of an unassigned, automated-intake
> case sitting in the queue.

> **Never delete `AuditEvent` rows.** A rehearsal leaves its trace, view,
> download and routing events behind, and that's fine: `AuditEvent.caseId`
> isn't a foreign key, and the chain stays intact. Deleting an audit row
> breaks the hash chain for every later event, so **every** case page would
> show a broken custody card, in front of judges.

If you demoed the watchlist, remove that watch too. Turn foreign keys on in
the same command so its alerts cascade instead of being orphaned:

```bash
sqlite3 dev.db "select id, address, createdAt from Watch order by createdAt desc limit 5;"
sqlite3 dev.db "PRAGMA foreign_keys=ON; delete from Watch where id='<the-id>';"
```

> **Do not run `npm run db:seed` between rehearsal and the live demo if
> you're keeping the Sahyog-intake case for that beat.** The seed script's
> existing "backfill any case with no owner to the demo investigator" step
> (originally written for the pre-auth cases) runs unconditionally on every
> seed, and will silently reassign that case's `createdById` away from
> `null` — quietly removing the "no human owner" fact the beat exists to
> show. Re-seeding is safe for everything *else* in this doc; just re-run
> the Sahyog `curl` afterwards if you do.

To put `.env` back to production webhooks afterwards:

```bash
sed -i 's|/webhook-test/vasptrace-|/webhook/vasptrace-|g' .env
```

---

## Address cheat sheet

Timings are from 2026-09-16 library calls against the current tracer
(live balance lookups included, no DB write or n8n call). The headline row
went through the real route. Balances and busy-address graphs are live, so
they drift.

| Address | Chain | Depth | Time | Result |
|---|---|---|---|---|
| `0x6eedf92fb92dd68a270c3205e96dccc527728066` | ETH | 1 | **2.9s+** (route, n8n down — more with n8n live) | **WazirX, score 8**, LOW, 92 contract calls, no value moved — the headline. Dormant since 2024 |
| `0x1b8214682dee1c3d240e7241ef4e278854a2cdf3` | ETH | 1 | 3.1s | Binance 14, 3 nodes, 2 issuer leads — backup |
| `0x1b8214682dee1c3d240e7241ef4e278854a2cdf3` | ETH | 3 | 11.5s | Binance, FAN_OUT, 2 issuer leads, 24-34 nodes (drifts) — the stablecoin beat |
| `1CRLGcaXajtWVF5EopZgQUqE12dKn8Rtuh` | BTC | 1 | **1.9s** | Binance, PEEL_CHAIN flag. Most stable BTC pick; PDF shows all three money fields |
| `TZ44qjhyXiqfW8rXr5U7tAgfS6qdtKKSGD` | TRON | 1 | 2.6s | Bitfinex |
| `3FrmCRcGKiTATfreBDM9F17yAUDoDsnWeA` | BTC | **5** | **~21s** | 60 nodes, FAN_OUT + PEEL_CHAIN; **Binance, score 5 at hop 0, by same-wallet inference** (re-checked 2026-09-16). It scores below WazirX's 8 despite hop 0 because Binance has no India nodal officer and reliability 2, versus WazirX's officer and reliability 4. The button reads "Route ownership-confirmation request to Binance" |

**On `3Frm…` — corrected 2026-09-14:** this used to be pitched as a *messy,
realistic multi-hop laundering trail*. It isn't one. The address itself
co-spends inputs with the seeded Binance cold wallet, as do four nodes
downstream, so the graph is Binance moving its own funds and the "peel chain"
flag is firing on exchange consolidation. **Don't narrate it as laundering.**

What it *does* show well is item 2's same-wallet recommendation: an address from a
"suspicious wallets" dataset turns out, on-chain, to be exchange-controlled,
with the transaction that proves it. That's a true and useful story — tell
that one, while the ~21s trace runs. Otherwise stick to the 1-hop addresses.
Never open with it.

Full provenance for every address is in
[`DEMO_ADDRESSES.md`](./DEMO_ADDRESSES.md). Re-verify the curated set before
demo day; it takes a couple of minutes at ~2-3s each.
