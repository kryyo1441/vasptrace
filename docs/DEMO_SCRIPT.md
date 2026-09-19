# VASPtrace — demo narration script (7 minutes)

**Team Async/Pray — Smart India Hackathon, Problem Statement SIH26182 (MHA / I4C).**

This is a narration script, not an ops checklist — every beat pairs **what you
click** with **what you say and why**, so you can explain the tool to a judge
who has never seen it, not just operate it. Assume the app and n8n are
already running when you start; nothing here covers getting them there.

Full technical provenance for the addresses used below (why each one was
picked, what it drifted from) is in [`DEMO_ADDRESSES.md`](./DEMO_ADDRESSES.md).
[`CASE_SCENARIOS.md`](./CASE_SCENARIOS.md) is the wider catalogue — every
outcome the tracer can produce, with an address for each, if you want a
different story from the one scripted here. The problem statement itself is
[`PROBLEM_STATEMENT.md`](./PROBLEM_STATEMENT.md).

---

## The frame for the whole run

You are not a developer showing a build. You are an investigating officer in
a state cyber cell who has this tool on your desk. Open by saying so, then
stay in that voice throughout — "a complaint lands on my desk", "I need to
know who to serve", "I have to defend this in a case file." Every judge in
the room has sat through tech-stack tours. None of them has watched an
officer actually work a case with the tool in front of them.

Three habits that carry the whole seven minutes:

- **Narrate the intent before you click, not after.** Say what you're about
  to need, then click. The screen becomes the answer to your sentence instead
  of something you explain afterwards.
- **Explain the *why* behind every number on screen**, not just what it says.
  A judge can read "score: 8" themselves. What they came to hear is why it
  isn't 10, why the nearest exchange didn't win, why an edge is drawn dashed
  instead of solid. That explanation is the actual pitch — the UI is just
  where it's anchored.
- **Name the brief as you meet it — lightly.** Judges score against the
  problem statement, so when a beat fulfils one of its lines, say so in half a
  sentence ("that's the brief's *nearest VASP receiving direct deposits*") and
  keep moving. When something goes *beyond* the brief, say that too ("nobody
  asked for this, but…"). Never stop to read a checklist mid-demo — the full
  point-by-point comes once, near the end, when they've already seen it all.

### How to read this script

Every beat carries two presenter notes. **Don't read them aloud** — the
spoken lines already carry the distinction.

- **Brief** — the line(s) of the problem statement this beat fulfils.
  These are the *necessary* parts: what SIH26182 explicitly asks for.
- **Beyond the brief** — what this beat shows that the problem statement
  never asked for. These are the brownie points.

The full requirement-by-requirement map, with honest status for each, is in
[the appendix](#the-brief-requirement-by-requirement).

---

## Timing (6:55 without n8n)

| Clock | Beat | Runs | Covers |
|---|---|---|---|
| 0:00 | Introduction — team, problem statement, the gap this closes | 0:45 | Brief |
| 0:45 | The input screen and its options | 0:25 | Brief + beyond |
| 1:10 | Run the trace | 0:30 | Brief |
| 1:40 | Reading the graph | 0:35 | Brief |
| 2:15 | The recommendation and its arithmetic ← the beat that wins the room | 1:05 | Brief + **the differentiator** |
| 3:20 | Typology flags and money tracking | 0:25 | Brief + beyond |
| 3:45 | The PDF a court would see | 0:15 | Brief |
| 4:00 | Routing the disclosure request | 0:35 | Brief |
| 4:35 | A second case: the deposit address and a freeze | 0:45 | Brief + beyond |
| 5:20 | Chain of custody | 0:20 | Beyond |
| 5:40 | The caseload dashboard | 0:20 | Brief |
| 6:00 | The brief, point by point | 0:35 | Brief (recap) |
| 6:35 | Conclusion | 0:20 | — |
| *(opt.)* | *n8n — the optional window onto the pipeline* | *0:30* | *Beyond* |

The n8n beat is **off by default** now — it's the only beat nothing else
depends on, and the new second-case beat earns its time more. Put it back
between custody and the dashboard only if you're running under.

If you're still running long, cut in this order: the cyan-ring sentence in
the second case, the dashboard's filter clicks, the inference paragraph in
routing. **Never cut or rush 2:15** — that's the one differentiator none of
the big commercial tracing tools have — **and never cut 6:00**, which is
where the brief is visibly closed out.

---

### 0:00 — Introduction (45s)

> "Good [morning/afternoon]. We're Team Async/Pray, and this is VASPtrace,
> built for problem statement 26182 from the Ministry of Home Affairs and
> I4C.
>
> Think of me as an investigating officer in a state cyber cell. My desk is
> crypto fraud — investment scams, ransomware payouts, UPI fraud proceeds
> being cashed out. A complaint comes in and it gives me one thing: a wallet
> address. I can already see where the money went — any block explorer shows
> me that for free. What I cannot easily answer is the question my case
> actually turns on: **which exchange do I serve a request on, and will they
> actually answer me?** Pick wrong, and I lose weeks while the money moves
> again. That gap — between 'I can see the money' and 'I know who to legally
> ask for it' — is what this closes.
>
> Everything the problem statement asks for is in what you're about to see.
> I'll point at each piece as we pass it, and I'll tell you when something
> goes beyond what was asked."

**Brief:** the title ask — automated attribution of an unknown wallet to its
nearest VASP.

### 0:45 — The input screen and its options (25s)

Land on the home page before you type anything, and name what's in front of
you — this is the only screen a judge hasn't already inferred the purpose of.
The three "how it works" cards under the search box are there for exactly
this moment; gesture at them, don't read them.

> "Three things to set. First, what's on the complaint — a wallet address, or
> just a transaction hash if that's all the victim has; the tool resolves the
> hash to whoever it paid and starts from there. Second, which chain:
> Bitcoin, Ethereum, Tron, BNB Chain, Solana and Polygon — every chain the
> problem statement names — plus Arbitrum. Third, how many hops outward to
> walk. Too shallow and I miss the exchange; too deep and a busy wallet fans
> out into thousands of addresses I don't have time to read. I pick it per
> case, the way I'd decide how many links to chase in a paper trail."

**Brief:** "map… transaction flows across multiple blockchain networks such
as Bitcoin, Ethereum, Tron, BNB Chain, Solana, Polygon and other major
chains" — all six named, plus Arbitrum.
**Beyond the brief:** transaction-hash intake. The brief asks for wallet
addresses; complaints usually arrive with a transaction reference instead.

### 1:10 — Run the trace (30s)

**Click:** fill in and press **Run trace**.

| Field | Value |
|---|---|
| Wallet address | `0x6eedf92fb92dd68a270c3205e96dccc527728066` |
| Blockchain | **Ethereum** |
| Max trace depth | **1** |

Start the sentence as you click — it returns in a few seconds, so the live
progress line only flashes. Don't wait for it; describe it.

> "I paste it in, pick the chain, and the tool walks the money outward hop by
> hop until it hits something it can name — a registered exchange, a mixer, a
> sanctioned wallet — or runs out of depth. On a long trace you'd watch it
> count the addresses as it goes rather than sit on a spinner. Depth one
> here, because this address reaches an exchange on its very first hop."

**Click:** **Open case, generate report, route disclosure request** once the
result appears. Everything from here happens on the case page.

**Brief:** "automatically trace blockchain transaction paths"; "real-time
generation of investigative intelligence" (the streamed progress line).

### 1:40 — Reading the graph (35s)

**Focus on:** the force-directed graph itself, before touching the
recommendation card below it.

> "Every dot is an address the trace touched; every line is a real
> transaction. Colour is meaning, not decoration: red is my suspect, green a
> registered exchange, orange a mixer, teal a DeFi bridge or cross-chain swap
> service, dark red a sanctioned or terror-listed wallet, grey an
> intermediary passing money through."

**Click:** the exchange node to open its detail sheet.

> "And it says how sure it is — *high* here, an exact match against a known
> WazirX address; a pattern-based guess would say medium or low and write out
> why. Now notice the edge is dashed violet, labelled '92 contract calls, no
> value moved.' This address made 92 zero-value calls into WazirX's own
> multisig, all inside the four days of the 2024 WazirX hack. That's a
> *stronger* lead than a transfer — but a tool that drew it as a payment
> would be lying to me in a document I have to defend. So it draws exactly
> what happened."

**Brief:** "visualization of fund movement"; "support identification of
exchange clusters, hot wallets, deposit wallets, mixers/tumblers, DeFi
bridges, and cross-chain swap services"; "automated tagging and confidence
scoring for suspected VASPs".
**Beyond the brief:** the transfer-vs-contract-call distinction. Nobody asked
for it; it's what keeps the legal paperwork truthful.

### 2:15 — The recommendation and its arithmetic (65s) ← *don't rush this*

**Focus on:** the score gauge and the line of reasoning next to it, not the
badge colour.

> "Here's the part that actually matters to my case. The brief asks for the
> *nearest* VASP. We went one step further, because nearest isn't enough — I
> need the one that will actually answer. So it's scored on four real facts,
> added up in front of me:
>
> - **Plus three, if the exchange is FIU-IND registered** — legally obligated
>   to respond to an Indian law-enforcement request at all.
> - **Plus two, if it has a dedicated India nodal officer** — a named legal
>   contact, instead of a support inbox that takes six weeks to route.
> - **Plus its response-reliability score**, out of five — how often it has
>   actually answered in the past.
> - **Minus one for every hop of distance** — an exchange three hops
>   downstream is a weaker, more inferential link than a direct one.
>
> WazirX here: registered, has that officer, reliability four, one hop. Three
> plus two plus four minus one is eight. That arithmetic is printed on the
> screen, not hidden in a model. My supervisor can check it, and defence
> counsel can argue with the actual numbers — what I could never do is put
> 'the software said HIGH RISK' in front of a judge and expect it to survive
> cross-examination.
>
> So a closer offshore exchange with no Indian presence scores *lower* than a
> slightly further one that will reply. And the line underneath tells me how
> to reach them: WazirX is an Indian reporting entity, so it's Sahyog. For an
> offshore exchange, that line names its own law-enforcement portal and the
> Letter of Request route through the Home Ministry instead."

**Brief:** "automated identification of nearest VASP/exchange linked to
unknown wallets"; the aim to "strengthen cross-border cybercrime
investigations" (the channel line).
**Beyond the brief — the differentiator:** ranking by legal actionability,
with the arithmetic shown. The brief asks for *nearest*; *will actually
answer* is ours.

### 3:20 — Typology flags and money tracking (25s)

**Focus on:** any flag badges above the graph, and the money figures inside
the node detail sheet.

> "Two quick things. The flag badges — fan-out, peel chain, rapid mixer hop —
> are the laundering patterns the brief asks for, detected by fixed rules,
> not AI guesses. They tell me where to look; they never by themselves become
> the basis of a legal request. And the money figures show what this trace
> actually saw received — never a rupee estimate, because there's no live
> price feed here. If it can't stand behind a number, it doesn't print one."

**Brief:** "identification of laundering typologies"; "risk classification of
wallets and transaction flows".
**Beyond the brief:** per-node money tracking, and the refusal to invent an
exchange rate.

### 3:45 — The PDF a court would see (15s)

**Click:** **Download PDF report** at the top of the case page, and open it.

> "Generated straight from the stored trace — case ID, the hop-by-hop
> narrative, the score and its reasoning, the evidence trail with real
> transaction hashes. Same numbers as the screen, because both come from the
> same data."

**Brief:** "generate investigation-ready reports for LEAs".

### 4:00 — Routing the disclosure request (35s)

**Click:** **Route disclosure request to WazirX**.

The payload renders inline and the page updates in place — status flips
**TRACED → ROUTED**, a response card appears, chain of custody gains the
routing event.

> "This builds the exact request a real disclosure would need: the suspect
> address, the target exchange, the section of law — Section 94 of the BNSS —
> and the evidence trail the PDF just showed. To be straight with you: there's
> no public Sahyog API to integrate against yet, so this never leaves this
> laptop, and it says *simulated* on screen before anyone has to ask.
>
> If the link to an exchange is an *inference* rather than an exact label, the
> request rewrites itself to ask the exchange to confirm ownership first. And
> you'll notice a second button — route a *freeze* request. Here nothing of
> value moved, so there's nothing to freeze. Let me show you a case where
> there is."

**Brief:** "assist investigators in automatically routing lawful disclosure…
requests to the correct VASP through the SAHYOG Portal" — shaped for Sahyog,
simulated because no public API exists.

### 4:35 — A second case: the deposit address and a freeze (45s)

**Click:** back to the home page, and trace:

| Field | Value |
|---|---|
| Wallet address | `0x1b8214682dee1c3d240e7241ef4e278854a2cdf3` |
| Blockchain | **Ethereum** |
| Max trace depth | **1** |

Returns in about three seconds. Open the case.

> "Different complaint. This time money really moved — ETH and USDT into
> Binance. The problem statement asks for the exchange *receiving direct
> deposits*, and this is why that wording matters: an exchange doesn't find
> its customer by its own hot wallet, it finds them by the deposit address it
> handed that customer. This suspect wallet forwards everything straight into
> Binance, so the tool marks it as a Binance deposit address — as an
> inference, never a confirmed label — and puts it in the request as the
> account to identify."

**Click:** **Route freeze request to Binance**.

> "Same case, different request. This one cites the police seizure power,
> Section 106 of the BNSS, and the exact amount this trace saw credited to
> Binance. It also states its own limit: a seizure has to be reported to the
> Magistrate, and actually attaching the funds needs the Magistrate's order.
> The request is ready the second the trace finishes — which is what matters
> when money can be withdrawn in hours.
>
> One more thing nobody asked for: that dashed cyan ring on the suspect. This
> same wallet appears in other cases on my own caseload — different
> complaints, same operator. That's the first thing I'd want to know."

The cyan ring and the "also appears in N of your other cases" banner only
show if the logged-in account has traced this address before — the
investigator demo account has. Links only ever count cases the viewer is
allowed to open, so they never reveal another officer's investigation.

**Brief:** "nearest centralized exchange… receiving direct deposits from the
suspect wallet"; "routing lawful… freezing requests to the correct VASP"; the
aim to "improve asset freezing efficiency".
**Beyond the brief:** cross-case linking.

### 5:20 — Chain of custody (20s)

**Focus on:** the audit-log card and this case's timeline underneath it —
trace, report download, routing.

**Check which version of the card you have before the demo.** As of
2026-09-18 it reads *"Audit log hash chain broken at event #250"* — a real
break caused during development (see `HANDOFF.md`'s 2026-09-18 entry). If it
has been repaired and reads *"intact"*, use the first line; if it still
reads *broken*, use the second — it's the stronger moment of the two.

*If intact:*

> "Every action with legal weight is logged — who traced, who pulled the
> report, who routed the request, and when. Each entry's hash covers the one
> before it, so editing or deleting any row breaks the chain and this card
> says so. Tamper-*evident*, not tamper-proof — and I'd rather tell you that
> limit than overclaim it."

*If broken:*

> "Every action with legal weight is logged, and each entry's hash covers the
> one before it. And notice it's reporting a break — that's real. During
> development we deleted some test rows, and the log caught it at the exact
> event where it happened. That's precisely what it's for: it can't stop
> someone with database access, but it can't be quietly edited either."

**Beyond the brief:** the hash-chained chain-of-custody log, and the login and
role-based access behind it — one investigator cannot open another's case.

### 5:40 — The caseload dashboard (20s)

**Click:** go to `/cases`, then type a VASP name into the search box and set
the risk filter to **HIGH**.

> "This is my caseload — every one a real trace against live chain data. I'm
> not scrolling it; I'm asking which of my cases point at this exchange, or
> which are high risk, because that's where I move first. And across all of
> them: how much has flowed into each exchange, per asset, and how often each
> exchange has actually answered."

Read whatever count is actually on screen — never quote a memorised number,
it drifts every time this gets rehearsed. The investigator account sees only
its own cases; a supervisor sees all of them.

**Brief:** "dashboard for LEAs with case-based analytics and reporting".
**Beyond the brief:** the observed VASP response rate, tracked next to the
seeded reliability score rather than overwriting it.

### 6:00 — The brief, point by point (35s)

No clicks — face the judges. This is the one place you run the list, and
it lands because they've just watched every item work. Keep a brisk rhythm:
requirement, then where it lives.

> "Before I finish — the brief, point by point.
>
> Analyse wallets reported on Sahyog automatically: there's a
> token-authenticated intake endpoint, one address or a batch of twenty, no
> human in the loop. Trace to the nearest exchange receiving direct deposits:
> you've seen it, deposit address included. Bitcoin, Ethereum, Tron, BNB
> Chain, Solana, Polygon: all live. Hot wallets, deposit wallets, clusters,
> mixers, bridges, swap services: recognised and labelled. Tagging with
> confidence, risk scoring, laundering typologies: on every trace.
> Investigation-ready reports: the PDF. Disclosure *and* freezing requests to
> the right VASP: both, shaped for Sahyog. Alerting on high-risk wallets:
> ransomware, OFAC sanctions, terror-financing lists, and a watchlist that
> fires when a wallet moves.
>
> The one thing we haven't built is following money across a bridge onto the
> other chain — we identify the bridge and stop, and we say so.
>
> Beyond the brief: the actionability score, the chain of custody, cross-case
> links, transaction-hash intake, and access control."

**Brief:** all of it — this is the recap. The full table with evidence and
honest status for every line is in
[the appendix](#the-brief-requirement-by-requirement); have it open in
another tab if a judge wants to go line by line.

### 6:35 — Conclusion (20s)

> "So the brief is covered. But tracing crypto is a solved problem —
> commercial tools already do the hop-by-hop walk. What none of them are
> built around is the question I'm left holding once the trace is done: of
> everything this touched, which exchange will actually answer an Indian
> police request, and why. That arithmetic — not a black-box risk score — is
> what this tool hands back, and it shows its work every time. Thank you.
> We're Team Async/Pray, problem statement 26182."

### *(optional)* n8n — the optional window onto the pipeline (30s)

Only if you're running under time. Slot it between custody and the
dashboard. **Arm it with Execute workflow while still talking about
custody** — it waits indefinitely once armed, so arming early costs nothing.

> "This is the same pipeline, executing live on the trace you watched. But
> it's a visibility layer, optional by construction: every piece of real
> work had already happened and been saved *before* this was contacted. If
> n8n is down, nothing about my workflow breaks. It's here because a
> pipeline you can watch execute is easier to trust than a finished screen —
> and because this is the shape it takes plugging into an agency's own
> automation stack."

**Beyond the brief:** a live, watchable view of the pipeline.

---

## The brief, requirement by requirement

Every line of [`PROBLEM_STATEMENT.md`](./PROBLEM_STATEMENT.md), in its own
order, with where it lives and its honest status. **Live** = real data, real
computation. **Simulated** = the real shape, but no external system exists to
send it to. **Partial** / **Not built** = said out loud, never implied.

### "The system should…" — the necessary part

| Requirement (PS wording) | Where it lives | Status |
|---|---|---|
| Automatically analyze suspect wallet addresses reported on the Sahyog Platform | `POST /api/sahyog/trace` — bearer-token intake, single address or a batch of up to 20; the case lands unassigned until an officer claims it | **Live** endpoint. No public Sahyog API exists to call it, so nothing real calls it yet |
| Trace paths to the nearest centralized exchange, custodial wallet service, or VASP receiving direct deposits | Hop-by-hop tracer + the recommendation card; the deposit address is cited when the trace shows one | **Live.** Custodial VASPs are labelled as exchanges — there is no separate "custodial wallet" label type |
| Map deposit addresses and flows across Bitcoin, Ethereum, Tron, BNB Chain, Solana, Polygon and other major chains | All six named, plus Arbitrum | **Live.** Native coins plus USDT/USDC; other tokens aren't followed |
| Identify exchange clusters | Bitcoin common-input ownership ("same wallet"); many hot wallets map to one registry VASP | **Live** |
| Identify hot wallets | Labelled exchange addresses across all seven chains | **Live** — hand-verified seed, not a live feed |
| Identify deposit wallets | "Inferred deposit address" (forwards ≥80% to a known exchange), cited in requests | **Live**, always marked as an inference |
| Identify mixers/tumblers | Tornado Cash labels, orange nodes, `RAPID_MIXER_HOP` flag | **Live** |
| Identify DeFi bridges and cross-chain swap services | Seeded bridges including Mayan (a swap service), teal nodes; the trace stops and labels them | **Live** identification |
| Integrate Sahyog with blockchain intelligence APIs and graph analytics engines | Intake endpoint above + live explorer APIs + the graph view | **Live** on our side; Sahyog side **simulated** |
| Automated tagging and confidence scoring for suspected VASPs | High / medium / low confidence per node, with the reason written out | **Live** |
| Generate investigation-ready reports | PDF from the stored trace | **Live** |
| Route lawful disclosure or freezing requests to the correct VASP through Sahyog | Two routing buttons: disclosure (BNSS s.94) and freeze (BNSS s.106, with its Magistrate caveat) | **Simulated** — no public Sahyog API. Legal citations still need sign-off from someone with legal training |

### "The system may additionally support…"

| Requirement | Where it lives | Status |
|---|---|---|
| Visualization of fund movement | Force-directed graph, colour-coded by entity kind | **Live** |
| Cross-chain transaction mapping | Bridges are identified and the trace stops there | **Partial — not built.** Following funds onto the destination chain is scoped (`ROADMAP.md` item 4), not built. Say so |
| Risk scoring | LOW / MEDIUM / HIGH / CRITICAL per case | **Live** |
| Identification of laundering typologies | Fan-out, peel chain, rapid mixer hop — drawn on the graph | **Live**, rule-based |
| Alerting for high-risk wallets (ransomware, darknet, terrorism financing, fraud) | Ransomware label; OFAC sanctions sync; terror-financing sync (OFAC SDGT + Israel NBCTF); watchlist alerts when a watched wallet moves | **Live**, with two caveats: no darknet-market feed is seeded, and watchlist checks run on demand or from a scheduler, not continuously |

### Expected solution, and what it "should aim to" do

| Item | Where it lives | Status |
|---|---|---|
| Automated identification of nearest VASP/exchange | Recommendation card | **Live** |
| API-driven blockchain tracing and attribution | Live explorer APIs; `/api/trace`, `/api/sahyog/trace` | **Live** |
| Multi-chain analysis and visualization | Seven chains, one graph view | **Live** |
| Real-time generation of investigative intelligence | Trace progress streamed as it runs | **Live** |
| Risk classification of wallets and flows | Case risk level + typology flags | **Live** |
| Dashboard with case-based analytics and reporting | `/cases` | **Live** |
| Scalable architecture for large-volume analysis | Batch intake of up to 20 addresses per call | **Demonstrated at demo scale.** Free-tier API limits are the ceiling, not the design — see "depth/breadth limits" below |
| Reduce investigation time | Minutes of manual explorer work → one trace | — |
| Improve asset freezing efficiency | Freeze requests citing the amount credited; stablecoin issuer freeze leads (Tether, Circle) | **Simulated** routing, **live** data |
| Enhance attribution capabilities | Confidence tiers, same-wallet inference, deposit addresses | **Live** |
| Strengthen cross-border investigations | Jurisdiction + each offshore exchange's own LE channel; BNSS s.112 Letter of Request note | **Live** data; the request itself is still a human process |

### Beyond the brief — the brownie points

None of these appear anywhere in the problem statement.

| What | Why it matters |
|---|---|
| **Legal-actionability scoring** (FIU-IND + nodal officer + reliability − hops), arithmetic on screen | The brief asks for *nearest*; this finds the one that will *answer*. The headline differentiator |
| Transfer vs. contract-call edges | Stops the tool claiming "funds received" in a legal request when no value moved |
| Hash-chained chain-of-custody log | Who did what, when — tamper-evident |
| Login and role-based access | One investigator can't open another's case, report or routing |
| Cross-case linking | The same wallet across different complaints, without leaking other officers' cases |
| Transaction-hash intake | Complaints carry a transaction, not always an address |
| Money tracking, observed VASP response rates | Real figures, never a blended rupee estimate |
| Stablecoin issuer freeze leads | Tether/Circle can freeze regardless of which exchange the funds reached |
| n8n pipeline view | Watchable automation, optional by construction |
| AI-drafted case narrative (Gemini) | Prose only — never touches the score, risk or recommendation |

---

## Deeper explanations — keep ready for questions, or a slower run

### If asked why the depth/breadth limits are so low

The problem statement itself asks for "scalable architecture capable of
handling large-volume blockchain transaction analysis," so have the honest
version ready rather than improvising.

**The actual numbers:**

| Limit | Value | What it does |
|---|---|---|
| Max depth | 1–10, chosen per trace | how many hops outward the trace walks |
| Fan-out cap | 5 | at each address, follow only the 5 highest-value outgoing destinations |
| Node budget | 60 | hard stop on total addresses in one trace |
| Batch intake | 20 per call | addresses per `/api/sahyog/trace` batch |

When a trace hits the node budget it says so on screen — *"Node budget (60)
reached — trace truncated before completing all branches"* — rather than
quietly returning a partial graph as if it were complete.

> "First, these are free public API tiers — every hop is a live call to a
> block explorer, and pushing them harder just produces rate-limit errors, so
> the ceiling here is the free API key, not the algorithm. Second, this has
> to return in seconds in front of you on venue wifi; a wallet with thousands
> of counterparties would fan out enormously, so ranking by value and capping
> breadth keeps a live trace bounded. Third, and this is the part that
> matters: these are constants in one file, not an architectural ceiling. A
> real deployment would change what sits *behind* them — a paid API tier, a
> background job queue instead of a request that must answer in seconds,
> Postgres instead of the single file this demo runs on."

### If asked to show large-volume / batch intake

```bash
curl -X POST http://localhost:3000/api/sahyog/trace \
  -H "Authorization: Bearer $SAHYOG_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"addresses":[
        {"address":"0x6eedf92fb92dd68a270c3205e96dccc527728066","chain":"ETHEREUM","maxDepth":1},
        {"address":"H6KX9bqVC38ecJPwpd39ESBqSQEfpszMaFQXFzbXAVXR","chain":"SOLANA","maxDepth":1}
      ]}'
```

Returns `{ total, succeeded, failed, results }`. One bad address fails on its
own line without aborting the batch. **Never batch Bitcoin addresses before a
demo** — Blockstream allows 700 requests an hour per IP, and a batch of deep
Bitcoin traces can lock every Bitcoin trace out for over an hour.

> "Sahyog sends a list of reported wallets; each one becomes a case, traced
> exactly like the one you watched, and one malformed address doesn't sink
> the rest. It shares the same pacing as a live trace, so a batch can't
> hammer the explorer APIs any harder than twenty officers clicking at once."

### If asked about terrorism financing specifically

The problem statement names it outright. Two addresses, verified 2026-09-18
through the app's own tracer, both **Tron, depth 1, about 2–3 seconds**, both
**CRITICAL** with no recommendation (correctly — a designated wallet isn't a
disclosure target):

- `TTnAW1Uhd4RnBDQTeEbYrD145aBaRQ3Hr7` → a wallet in Israeli **NBCTF
  seizure order ASO 18/26**.
- `TCvvJ1Ewd28Agm219r6HFdUV8NVn9mZ413` → **Bank Markazi (Central Bank of
  Iran)**, OFAC-designated under the SDGT terrorism program.

The case page shows a red banner: *"Terror-financing designation reached —
CRITICAL. Not a disclosure target: escalate as a terror-financing lead
(UAPA)."*

> "Two sources, both primary: OFAC's terrorism designations, and Israel's
> counter-terror-financing seizure orders, which list the Tron wallets Hamas
> and others have actually used. The tool keeps them separate from ordinary
> sanctions so the reason for *critical* is right on the node — and it
> declines to recommend a disclosure request, because this isn't a
> disclosure matter, it's an escalation."

The lists update from the case dashboard's **Sync sanctions &
terror-financing lists** button (supervisor only). As of 2026-09-18 it holds
705 terror-financing addresses; the count moves with every sync.

### If asked about an offshore exchange / cross-border cases

`0x82c705d7b532316e5b767df60d3be151b670aa1a` · Ethereum · depth 1 · ~3s.
Reaches **Coinbase** — not FIU-IND registered — score 2. The recommendation
card shows *"United States · Coinbase law-enforcement portal, run on Kodex"*
and an amber cross-border note.

> "Coinbase owes an Indian officer nothing domestically, and the tool says
> so. It still tells me how to proceed: their own law-enforcement portal is
> the fast, voluntary route; a Letter of Request under Section 112 of the
> BNSS, through the Home Ministry, is the compelled one. That turns a
> low-scoring dead end into a next step."

Every offshore exchange in the registry has its real, published LE channel:
Binance, Coinbase, Kraken, KuCoin, OKX, Bitfinex, MEXC.

### If asked to show Solana

`H6KX9bqVC38ecJPwpd39ESBqSQEfpszMaFQXFzbXAVXR` · Solana · depth 1 · ~4s,
verified 2026-09-18. One real deposit into **Binance** (Solana hot wallet
"Binance 2"), score 4.

> "Solana works differently under the hood — a token transfer names a token
> account, not a wallet, so the tool resolves who actually owns the
> receiving account before it draws the edge. Same graph, same scoring, same
> request at the end."

Solana traces are the slowest per hop — every transaction is its own API
call on the free public endpoint. Keep Solana at depth 1–2 live.

### If asked how the transaction-hash input works

Paste any transaction hash into the same search box with the right chain
selected — `0x…` 64-hex for the EVM chains, bare 64-hex for Bitcoin and Tron,
a base58 signature for Solana. One recipient: it traces immediately. Several
(a Bitcoin payment with more than one output, say): it lists them with
amounts and asks which to trace — it never picks silently.

> "The victim usually has the transaction off their own wallet or exchange
> receipt, not the scammer's address. This saves the officer looking it up
> by hand — and where the answer is ambiguous, it asks rather than guesses."

### If asked about a Bitcoin wallet whose trace hits the cap and finds nothing

This is a real, honest outcome, not a failure — worth having a live example
of rather than describing it in the abstract. `bc1qjzmyhgrq9vamc5v9lsc3hcn6uqglz958hjv02t`
(Bitcoin, depth 5) hits the 60-node cap with `PEEL_CHAIN` and `FAN_OUT` flags
raised — a genuinely busy, suspicious-shaped graph — and resolves **no
recommendation at all**, because nothing in it ever touched a labeled
address.

> "This is the honest failure mode, and it's worth showing on purpose. A
> heavily-peeled, fanned-out wallet — exactly the shape a launderer's wallet
> should have — searched exhaustively within budget, and it never reached
> anything I can serve a request on. That's a real answer: it tells me this
> trail doesn't terminate anywhere actionable *yet*, which is different from
> the tool failing."

### If asked about a multi-hop trail into an exchange with weaker standing

`1Cg1X5xS6wkLqPksNcsVzm41Mf24PsrE1` (Bitcoin, 4 hops) and
`bc1qq80ekeufnjc9aaakfvj9llqjsaszzyfka9hkkw` (Bitcoin, 3 hops) both reach
Binance's deprecated hot wallet through genuine, multi-hop transfers — not an
inference. Binance is FIU-IND registered but has **no** India nodal officer
and a reliability score of 2, so even a direct hit scores lower than WazirX's
one-hop, nodal-officer-backed 8.

> "Here the money actually crosses several wallets before landing in an
> exchange — a shape much closer to real laundering than the headline
> address. It still resolves a recommendation, because the label match at
> the end is exact. But watch the score: registered, so not zero, but no
> dedicated officer and a weaker track record."

### If asked to show a case reaching an exchange with a nodal officer through several hops

`TDqZHB9kZ88Cu7CP9yAKPL3zhh9KKh9MiT` (Tron, depth 5) reaches **Bitbns** — FIU-IND
registered, India nodal officer — two hops downstream through real USDT
transfers, not an inference. Score 6 (three for registration, two for the
nodal officer, three for reliability, minus two for hop distance), `FAN_OUT`
flagged, risk MEDIUM. About 27 seconds — narrate over the live progress line.

> "This is the shape I actually want to end a case on: several real hops,
> genuine transfers the whole way, landing on an exchange with both legal
> standing and a named contact."

### If asked what a worst-case result looks like — or if you want a stronger second trace

Two addresses, both live-verified 2026-09-17, both **CRITICAL** risk from an
OFAC-sanctioned node picked up by the sanctions sync.

**The clean one:** `0x77bb1e8831b8c3fae0d69109dfff47b81857a5d2` · Ethereum ·
depth 1 · 2.7s. Two nodes, one edge, straight into **Garantex Europe OU**,
the sanctioned Russian exchange. The root has only two transactions in its
entire history, so nothing about it drifts.

> "That's the highest risk level the tool can assign — the money went
> straight into an OFAC-sanctioned exchange. And notice it recommends
> nothing, because a sanctioned entity isn't somewhere I serve a disclosure
> request. That goes to FIU-IND as a sanctions matter. The tool tells me the
> severity and *declines* to suggest a legal route that wouldn't make sense."

**The complete one:** `0xb25bdee2fd79b517db1b6fcb2c220fee5901fa83` ·
Ethereum · **depth 3** · 19s. 42 nodes, 52 edges. CRITICAL from a
`TASK FORCE RUSICH` sanctioned node at hop 1, **both** typology flags
(FAN_OUT *and* PEEL_CHAIN), and it still resolves **Binance at score 3**.

> "First hop is an OFAC-sanctioned entity — critical severity and a
> sanctions report to file. The money then fans out and peels down through
> forty-odd addresses — textbook laundering shape. And it *still* ends
> somewhere I can actually serve: Binance, scored three. Severity, pattern,
> and a legal route, all on one screen."

### If asked to paste their own address live

Say yes — but steer them to **Ethereum or Tron**, which have the richest set
of labeled exchange addresses seeded. Bitcoin's exchange labels are scarce
(only two Binance addresses), so a random BTC pick is likelier to trace
cleanly to nothing. Set depth 3 and expect several seconds on a busy address.
If it reaches nothing:

> "No labeled exchange within three hops. That's a real answer — it tells
> the investigator this trail doesn't terminate at an exchange we can serve,
> which is different from the tool failing."

Never let a judge's address be the *first* thing shown.

### If asked about bridges or cross-chain funds

This is the one "may additionally support" line that isn't built — say it
before it's asked, if a bridge node ever appears:

> "This is a real bridge contract, and the tool correctly stops and labels it
> the same way it stops at a mixer — it does not claim to know where the
> funds went on the other chain. Following money across a bridge is a
> genuinely different problem; it needs a second lookup against the bridge's
> own message log. That's scoped as next work, not built, and I'd rather say
> that than imply this silently keeps tracing on the other side."

Demo address if you want one: `0xa77f2281a4163ff7eafca1dbb625b960adba24cc`
(Ethereum, depth 1) reaches the LayerZero bridge.

### If asked "is this actually integrated with anything, or just a UI"

The strongest concrete answer available — run it live if you can, don't just
describe it:

```bash
curl -X POST http://localhost:3000/api/sahyog/trace \
  -H "Authorization: Bearer $SAHYOG_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"address":"0x6eedf92fb92dd68a270c3205e96dccc527728066","chain":"ETHEREUM","maxDepth":1}'
```

> "The problem statement asks the system to automatically analyse a wallet
> address reported on the Sahyog Platform. There's no public Sahyog API yet
> to receive real traffic from, so I can't show Sahyog calling this — but I
> can show the endpoint that would answer it. No browser, no session, no
> human clicking a button — a bearer token and an address, and it returns the
> same recommendation, same score, same confidence tiers you saw on screen.
> Send it a list instead of one address and it takes the batch."

The returned `caseId` opens on `/cases` for a supervisor, unassigned to any
investigator — deliberately: an automated intake case has no human owner
until someone claims it. **Don't run `npm run db:seed` between rehearsal and
the demo** — its backfill step assigns unowned cases to the demo
investigator and would erase that property.

---

## Address quick reference

| Address | Chain | Depth | What it shows | Beat |
|---|---|---|---|---|
| `0x6eedf92fb92dd68a270c3205e96dccc527728066` | Ethereum | 1 | **Headline.** One hop, WazirX, score 8. Contract calls, not a transfer — say so | 1:10 |
| `0x1b8214682dee1c3d240e7241ef4e278854a2cdf3` | Ethereum | 1 | **Second case.** Real ETH + USDT into Binance 14; suspect cited as a deposit address; freeze request cites the amount credited; cross-case ring. At depth 3 it's the multi-hop USDC tree with issuer-freeze leads | 4:35 |
| `0x82c705d7b532316e5b767df60d3be151b670aa1a` | Ethereum | 1 | Offshore **Coinbase**, score 2, cross-border channel + BNSS s.112 note | Q&A |
| `TTnAW1Uhd4RnBDQTeEbYrD145aBaRQ3Hr7` | Tron | 1 | **CRITICAL** — Israeli NBCTF seizure order ASO 18/26 (terror financing) | Q&A |
| `TCvvJ1Ewd28Agm219r6HFdUV8NVn9mZ413` | Tron | 1 | **CRITICAL** — Bank Markazi, OFAC SDGT (terror financing) | Q&A |
| `H6KX9bqVC38ecJPwpd39ESBqSQEfpszMaFQXFzbXAVXR` | Solana | 1 | One real deposit into Binance 2, score 4, ~4s | Q&A |
| `0x77bb1e8831b8c3fae0d69109dfff47b81857a5d2` | Ethereum | 1 | **CRITICAL** — one hop into OFAC-sanctioned Garantex, no recommendation (correctly). Cannot drift | Q&A |
| `0xb25bdee2fd79b517db1b6fcb2c220fee5901fa83` | Ethereum | 3 | **CRITICAL + FAN_OUT + PEEL_CHAIN + Binance score 3.** 42 nodes, 19s — the richest single case | Q&A |
| `TDqZHB9kZ88Cu7CP9yAKPL3zhh9KKh9MiT` | Tron | 5 | 2 real hops into Bitbns (FIU-IND + nodal officer) — the "good ending" multi-hop case, ~27s | Q&A |
| `1Cg1X5xS6wkLqPksNcsVzm41Mf24PsrE1` | Bitcoin | 5 | 4 real hops into Binance (no nodal officer) — lower score despite an exact match | Q&A |
| `bc1qq80ekeufnjc9aaakfvj9llqjsaszzyfka9hkkw` | Bitcoin | 5 | 3 real hops into Binance — same story, backup pick | Q&A |
| `bc1qjzmyhgrq9vamc5v9lsc3hcn6uqglz958hjv02t` | Bitcoin | 5 | Hits the 60-node budget cap, resolves **no recommendation** — the honest dead end | Q&A |
| `0xa77f2281a4163ff7eafca1dbb625b960adba24cc` | Ethereum | 1 | LayerZero bridge identified, trace stops — the one unbuilt "may additionally" item | Q&A |
| `3FrmCRcGKiTATfreBDM9F17yAUDoDsnWeA` | Bitcoin | 5 | Same-wallet inference finds the address *is* Binance's own wallet — **not** a laundering trail | Q&A |

Balances, live figures, and busy-address graphs drift over time — re-verify
anything you haven't traced in the last day or two before relying on it live.
