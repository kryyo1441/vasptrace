# VASPtrace — roadmap (post-submission)

Written 2026-09-12, after the SIH submission. **This is the single engineering
roadmap.** `PITCH.md` §12 is pitch-facing prose and points here; `HANDOFF.md`
points here for priority order; `PLAN.md` is the frozen 5-day brief and is not
a roadmap. Don't fork a second list — this repo already has a scar from a
duplicated brief going stale (`~/code/CLAUDE.md` exists only because of that).

**Status as of 2026-09-14 (session 2):** items 0-3, 5 and 6 are shipped.
Item 4 (bridge traversal) is scoped, with two real APIs confirmed working,
but not built — see its section. Item 7 (mixer demixing) is the one item
still deliberately untouched, per its own kill-criterion framing. See
`PROGRESS.md`'s 2026-09-14 session 2 entry for the full changelog, bugs
fixed alongside these items, and what's explicitly not attempted.

## The ranking principle

Every item below is either a **hard on-chain fact** or a **probabilistic
guess**. This project's stated differentiator is showing the arithmetic rather
than asking anyone to trust a badge (`PLAN.md`, "Differentiation note"), so
ground-truth capability ranks above heuristic capability — even when the
heuristic is more impressive in a demo. Items 1-5 are facts. Item 7 is a
guess and is ranked last on purpose, with a kill criterion attached. Item 0
sits outside the ranking: it's a semantics decision about what an edge
*means*, and item 1 reopens the same question.

## Two constraints that apply to everything below

- **Schema work doubles across two diverged branches — status changed
  2026-09-14.** `day3-n8n-rehearsal` is SQLite, `vercel-postgres` is Prisma
  Postgres. They were never reconciled, but `main` was fast-forwarded onto
  `day3-n8n-rehearsal` 2026-09-14 (it was 52 commits behind, 0 ahead — a
  clean fast-forward, no branch surgery needed) and phase-2 schema work
  (items 3/5/6 above) landed on `day3-n8n-rehearsal` anyway, via two more
  migrations there. `vercel-postgres` was deliberately left untouched and is
  now further behind than before — reconcile it (or declare it dead, which
  is looking like the honest call) before ever building on it again.
- **More API calls per node fights `withPacing`.** Pacing serializes one call
  per chain, a deep trace already measures ~25s (`HANDOFF.md` item 0), and
  raising `NODE_BUDGET` was measured and rejected. Items 1 and 2 both add
  calls *per node*, so both need a measured timing number before they land,
  not an estimate. Items 5 and 6 (both shipped 2026-09-14) don't touch this:
  the sanctions sync fetches one CSV, not a per-node call, and watch checks
  are one address's worth of work per check, not a trace.

---

## 0. The graph conflated contract calls with value transfers — DONE 2026-09-12

**Measured, decided and shipped the same day: option 2 below.** Kept in full
because the measurements are the baseline any future edge-model change (item
1 especially) has to be checked against. Not ranked against the items below —
it was a semantics fix, not a feature.

The tracers follow **transactions**, not transfers. Nothing filters
`value == 0`, so a zero-value contract call becomes a `TraceEdge` that renders
in the money-flow graph with a value label like any payment.

**What was measured** (`traceEthereum` called directly, per `HANDOFF.md`):

- A USDT mover (`0x93952d09…733b6a`, depth 2) → **2 nodes / 1 edge**, and the
  edge points at the **Tether contract** (`0xdac17f…831ec7`),
  `valueWei: "0"`, `txCount: 49`. The real recipient (`0xfae5f2…000b0b`)
  never appears. So the symptom item 1 used to describe — "renders a single
  node and stops" — **is wrong for Ethereum**: not a visible dead end, a
  *phantom node*. Accurate on Tron, which filters `contractType === 1`.
- The phantom node then gets expanded like a wallet. Tether came back empty
  only because token contracts rarely *send* transactions; a router or proxy
  in that slot would spend node budget on counterparties unrelated to the
  suspect.

**The headline demo is an interaction, not a flow — and the real story may be
better than the one currently shown.** `0x6eedf92f…728066`
(`DEMO_ADDRESSES.md`: "best headline demo", highest recommendation score of
any seed VASP) has **92 outgoing transactions, every one `value 0` with
calldata** — 91× selector `0x2d8a122e`, 1× `0x48d3c273`, neither in the
4byte directory — all into `0x27fd43ba…60c9b4`. Two facts sharpen this:

- `eth_getCode` on `0x27fd43ba` returns the **Gnosis Safe proxy** bytecode
  (it embeds the `masterCopy()` selector `0xa619486e` and delegatecalls
  through). So it is a **smart-contract wallet — a multisig**, not a token
  contract. Labelling it "WazirX 2" is legitimate; it really does custody
  funds.
- Every one of the 92 calls lands between **2024-07-18 06:42 and 2024-07-22
  06:53 UTC** — the WazirX hack window (the hack was 2024-07-18).

`tokentx` for the address: **0 outgoing token transfers.** So it moved
neither ETH nor tokens outward. Today the graph renders that as
`0.0000 ETH · 92 tx` (`components/graph-view.tsx` → `formatValue`). "92
contract calls into WazirX's multisig across the four days of the hack" is a
*stronger* investigative finding than a 0.0000 ETH edge — it is just not a
transfer, and the graph currently can't say the difference.

**Two things to get right, both verified in code rather than assumed:**

- **The recommendation does not depend on edge values at all.**
  `recommendVasp(nodes, vaspRegistry)` (`lib/scoring.ts:40`) reads only
  nodes — `kind === "EXCHANGE" && confidence === "high"`. So "bar these edges
  from the score" is a no-op. What actually controls the recommendation is
  whether the WazirX **node** exists, and node creation happens inside
  `bfs.ts`'s edge loop — so dropping the edge drops the node *and* the
  recommendation. Any fix has to decide the node's fate explicitly.
- **Typology already partly accounts for this, deliberately.**
  `lib/typology.ts:11-24` documents a live measurement where "near-zero-value
  contract calls" cleared the old 3-destination FAN_OUT threshold as noise,
  which is why `FAN_OUT_MIN_DESTINATIONS` is 5. Zero-value edges still count
  toward `outgoing.length`, so they can still inflate FAN_OUT at 5 — but this
  is a known, mitigated issue, not a new discovery. The `length === 2`
  PEEL_CHAIN branch is unaffected in practice: its `small > 0` guard already
  rejects a zero leg. `lib/clustering.ts:39,45`'s ≥80% ratio is also safe
  today, since zero edges add nothing to `totalOut` and the per-edge share is
  taken over that total.

**Options considered, in ascending cost:**

1. **Drop zero-value edges.** One filter. Loses the WazirX node and the
   headline recommendation with it (see above), and reduces `0x1b821468…`
   from 2 edges to 1 — its Binance share stays 100%, so its `medium` tier
   survives.
2. **Type the edge** (`TRANSFER` / `CONTRACT_CALL` on `TraceEdge`), render
   calls visually distinct, label them by count instead of by value, and keep
   the node. Preserves the WazirX finding and states it accurately. Costs a
   field plus UI and PDF rendering; no migration, since `traceResult` is a
   JSON blob.
3. **Option 2, plus decode the calldata** so the edge can say what the
   interaction *was*. Needs the Safe's masterCopy ABI; the two selectors
   aren't in 4byte.

### What shipped (option 2)

- `TraceEdgeKind = "TRANSFER" | "CONTRACT_CALL"` on `TraceEdge`
  (`lib/tracers/types.ts`), classified in `lib/tracers/bfs.ts` from whether
  the edge's **aggregate** value is zero. Deliberately *not* from calldata —
  a `ponytail:` comment there names the one shape that misnames (a genuine
  zero-value native send to an EOA) and the upgrade path (carry a
  `hasCalldata` flag on `RawTransfer`; Etherscan exposes `input`, Bitcoin has
  no equivalent).
- `isContractCall` / `edgeAmountLabel` live in **`lib/format.ts`**, not in
  the graph component, so the canvas and the PDF can't drift — the same
  reason `LEGAL_BASIS` already lives there. A contract-call edge reads
  `"92 contract calls · no value moved"`; it never names a currency or an
  amount.
- Canvas (`components/graph-view.tsx`): dashed, thinner, muted violet, and
  **no directional particles** — the particles read as value in motion, which
  is the exact wrong story here. Legend gains a "Contract call (no value)"
  key, shown only when the trace actually has one (same rule the node-kind
  legend already used).
- PDF (`lib/pdf/report.tsx`): the summary line used to call every edge a
  transfer. It now reads `0 transfers · 1 contract-call link (no value)` for
  the headline address, and the evidence trail marks those rows
  `contract calls — no value moved`. Verified with `pdftotext`.
- **Back-compat is a deliberate contract, not an accident.** The 83 existing
  `Case.traceResult` blobs have no `kind`, so every read tests
  `=== "CONTRACT_CALL"` and never `!== "TRANSFER"` — old cases keep rendering
  as transfers exactly as they did when generated. `lib/format.test.ts`
  asserts this with a `kind`-less edge.
- `lib/format.test.ts` is the self-check (`npx tsx lib/format.test.ts`).
  All five existing self-checks still pass; `next build` clean at 12 routes.

**Verified against the live chain, and every baseline below held** — node
counts, edge counts, recommendations, root confidences and typology flags all
unchanged, which is what option 2 was chosen for. The headline demo still
recommends WazirX; `recommendVasp` reads nodes, and the node stayed. The
Binance demo turned out to have a phantom **Tether** edge of its own (2
zero-value calls), now typed as such.

**The second pass is where the real bug was.** Typing the edge fixed the
canvas and the PDF but left the *legal* output untouched: the Sahyog route
built the disclosure request's `evidenceTrail` from every edge hash unmarked,
while the email draft asks the VASP about addresses that "received funds…
per the evidence trail below". On the headline address every hash there is a
zero-value call, so the draft asserted a fund movement that never happened.
`/` and `/cases/[id]` also both printed `N transfers`. All of it now routes
through `lib/format.ts` — `evidenceTrail` (transfers first, calls annotated),
`hasValueTransfer`, `edgeCountLabel` — and the draft swaps its ask when
nothing moved. Lesson for the next edge-model change (item 1): grep every
consumer of `edges`, not just the two that render a value.

**Not done, and deliberately so:** contract-call edges still count toward
`outgoing.length`, so they can still inflate FAN_OUT at the threshold of 5.
That is pre-existing, known and mitigated (see the typology note above);
excluding them would change flag output on stored cases, which is a separate
decision from how an edge is *labelled*. Option 3 (decoding the two
selectors) also stayed out.

**Baseline to check any fix against** (ETH demo addresses, depth 3, measured
2026-09-12): `0x6eedf92f…` = 2 nodes / 1 edge / 1 zero-value / WazirX / root
`confidence: null`; `0x1b821468…` = 3 nodes / 2 edges / 1 zero-value /
Binance / root `medium`; `0x82c705d7…` = 2 nodes / 1 edge / **0 zero-value** /
Coinbase / root `medium`. Only the Coinbase path is pure native value today.

## 1. Token / stablecoin tracing — SHIPPED 2026-09-13 (stablecoins only)

### What shipped

- **Ethereum:** `txlist` + `tokentx` per node; **USDT and USDC** only, keyed
  by contract in `ERC20_ALLOWLIST` (`lib/etherscan.ts`). Allowlisting by
  contract isn't optional: the Binance demo address has a spam token named
  `E͏TH` (zero-width character) "sent" from it. Zero-value token transfers are
  dropped (address poisoning).
- **Tron:** native TRX + **USDT-TRC20** via
  `api/filter/trc20/transfers?relatedAddress=…&contract_address=<USDT>`
  (`lib/tronscan.ts`). `fromAddress` isn't served keyless (301 → 401), so
  direction is filtered client-side from a 50-row mixed-direction page.
- **Phantom fixed at the source:** a USDT send is also a zero-value `txlist`
  tx into the token contract with the same hash. The ETH adapter drops those
  hashes when an allowlisted transfer replaces them, so the edge goes to the
  real recipient instead of Tether. Non-allowlisted token sends keep their
  `CONTRACT_CALL` edge, as before.
- **Edge model:** `asset?: { symbol, decimals, contract }` on `TraceEdge`,
  **absent = native**, so stored cases read unchanged. Edges aggregate per
  destination *and* asset; `FANOUT_CAP` applies per asset (one value sort
  across assets would bury every token).
- **Heuristics made asset-safe:** `clustering.ts` takes the 80% share within
  one asset; `typology.ts` PEEL_CHAIN only compares same-asset legs, FAN_OUT
  counts destinations rather than edges. On a native-only trace all three
  compute exactly what they did before.
- **Display:** `edgeAmountLabel` uses the edge's asset (`3754.9000 USDT · 8
  tx`); parallel ETH+USDT links to one node bow apart on the canvas; PDF
  evidence rows name the asset. Self-checks extended in `format`,
  `clustering` and `typology`.

**Measured against item 0's baseline (depth 3, live, 2026-09-13):**
`0x6eedf92f…` unchanged (2/1/1 call/WazirX/root null). `0x82c705d7…`
unchanged (2/1/0/Coinbase/medium). `0x1b821468…` changed as predicted: the
phantom Tether calls are gone, replaced by **3,754.90 USDT → Binance 14**
beside the 23.70 ETH edge, and a previously invisible **USDC** send to an
intermediary opens a real multi-hop stablecoin tree (27–40 nodes between
runs, since it's a live, active address). Still Binance, root still medium,
and FAN_OUT now fires on it. All three Tron demos keep Bitfinex + medium
root; two gain a USDT edge. `TAfeh255…` (a USDT sender into Bitfinex) shows
17,928 USDT alongside 46.77 TRX.

**Timing: ~1.4–1.6s per expanded ETH/Tron node**, now that each node makes
two paced calls. That's measured on the new code only, not A/B'd against the
old code on an identical graph. One-hop demo traces still finish in
~1–1.5s. Bitcoin is untouched.

**Breadth and risk changes, measured on `0x1b821468…`:** because
`FANOUT_CAP` is per asset, one node can now emit up to 15 edges (14
observed, on a USDC intermediary) where it used to emit 5. The address still
doesn't hit `NODE_BUDGET` (35 nodes, no warning). But at depth 3 FAN_OUT now
fires on three USDC intermediaries, so `deriveRiskLevel` goes from **LOW to
MEDIUM**. At depth 1 it's still LOW with no flags. That is real flow
becoming visible, not noise, but the node-budget measurement from 2026-09-10
(2.4% of traces truncated) was taken at native-only breadth and hasn't been
redone.

**Still open:** Tron USDT pagination (one 50-row page); any token beyond the
three stablecoins; the canvas's parallel-edge bowing wasn't checked in a
browser (no logged-in browser session). Item 3 (issuer freeze paths) is now
unblocked.

### Original write-up

**What.** Both tracers follow **native transfers only** — `lib/etherscan.ts:30`
uses `action=txlist` (native ETH, not `tokentx`), and `lib/tronscan.ts:9-12`
says so in an honest in-code comment (native TRX, not TRC20).

**Why it ranks first.** USDT-TRC20 is the dominant laundering rail in Indian
investment-fraud and pig-butchering cases. The tool today structurally cannot
see the most common path the money actually takes — a suspect wallet can move
its entire balance in USDT and the trace never shows where it went. This is
ground truth, not a heuristic: it's a different endpoint feeding the same
BFS, not a new inference layer.

**Premise corrected 2026-09-12:** this item used to say such a trace "renders
a single node and stops". Measured, that's only true on Tron. On Ethereum it
renders an edge to the *token contract* instead — see item 0, which is the
same edge-semantics question and should be settled first. `tokentx` is
verified working and carries `tokenSymbol`, `tokenDecimal` and
`contractAddress`, so per-asset values are available; the 6-vs-18 decimal
gap is exactly why the value ratios in item 0's last paragraph can't be fed
mixed assets.

**To verify before building.** Etherscan `action=tokentx` response shape and
whether the v2 API migration changes it; Tronscan's TRC20 transfer endpoint
and its pagination; the per-node call cost against `withPacing`. Also decide
the graph question this raises — one edge per asset, or one edge per
counterparty with assets summed. (Native + USDT to the same address is two
transfers but arguably one relationship.)

## 2. Bitcoin common-input-ownership clustering — SHIPPED 2026-09-14 (attribution only)

### What shipped

- **Zero extra API calls.** Esplora's `/address/:addr/txs` — the response
  the tracer already fetched — carries every input's
  `prevout.scriptpubkey_address`. `lib/blockstream.ts` now returns the
  address's **co-spenders** (addresses signed as inputs in the same tx, one
  evidence txid each) alongside its outgoing transfers.
- **CoinJoin guard** (`isLikelyCoinJoin`): ≥2 input owners, ≥3 outputs and a
  repeated output value → the tx's inputs are not read as one owner. Fired on
  6 txs across the three no-VASP dataset addresses, so it isn't theoretical.
  PayJoin is undetectable by design (`ponytail:` note).
- **`applyCoSpendAttribution`** (`lib/clustering.ts`): an unlabeled node that
  co-spent with a labeled address gets `confidence: "medium"`,
  `entityName: "<label> — same wallet"`, and a reason naming the labeled
  address and the txid. Runs before the 80%-forward rule so direct evidence
  wins. **Nodes are annotated, never merged**, so the graph still shows which
  address transacted and the 88 stored cases render unchanged. The root keeps
  `kind: SUSPECT`.
- **Medium, not high — so it does not route a disclosure request.**
  `recommendVasp` still only takes exact matches. This is the open decision
  below.

**Measured 2026-09-14** (library calls, depth 5, no `Case` rows):
`3FrmCRcG…` — **the suspect address itself co-spends with the seeded Binance
cold wallet**, as do 4 more nodes at hops 1-3. Graph, risk (HIGH), flags
(FAN_OUT + PEEL_CHAIN) and recommendation (Binance @ hop 4) unchanged;
26.5s vs the 25.5s baseline. The three no-VASP backups got 0 attributions.
Expanding the labeled addresses into their own clusters first added nothing
beyond direct peers, so it wasn't built.

**Routable, with confirm-ownership wording (user decision, later
2026-09-14):** an exchange reached only by co-spend enters `recommendation`
with a `sameWallet` basis and its evidence tx. Recommendations are one per
VASP; at equal score an exact label beats an inference. Everywhere it
surfaces it's named as an inference: the rec line on `/` and the case page
(with the evidence underneath), an "Attribution basis" row in the PDF, the
Sahyog payload (`requestType: OWNERSHIP_CONFIRMATION_AND_DISCLOSURE_REQUEST`,
`attribution.basis: SAME_WALLET_INFERENCE`), and the email draft, which asks
the VASP to confirm the address is theirs before disclosing anything and to
say so if it isn't. This is the item's original payoff: a "no VASP" Bitcoin
trace can now produce a request when it only reaches an exchange's wallet
through co-spent inputs.

**Still open:**
- **Exchanges missing from the registry produce nothing.** `recommendVasp`
  skips an `entityName` absent from `vaspRegistry` (exact or inferred),
  so a niche or offshore exchange that *is* labeled still yields no
  recommendation or lead. It should surface as "exchange reached, not in the
  actionability registry".
- Change detection: a vout to a co-spender is almost certainly change but
  still draws as a hop; dropping it would move PEEL_CHAIN output.
- Transitive clustering (union-find across the trace) and paging past the
  ~25-tx window.

### Original write-up

**What.** If two addresses appear as inputs to the same transaction they are
almost certainly the same wallet. This is the standard Bitcoin forensics
primitive, with a known failure mode (CoinJoin deliberately breaks it — which
is item 7's territory).

**Why.** It collapses addresses into **entities**, and an entity matches a
label if *any* address in it does. That multiplies the existing labels without
seeding a single new one — which directly attacks the documented weak spot:
only 2 of 15 seeded exchange addresses are Bitcoin, and `HANDOFF.md` item 0
concluded BTC label coverage is "the only lever left on VASP hit-rate" after
the node-budget raise was measured and rejected. It also makes the graph read
the way real tools present one (entities, not raw addresses).

**To verify.** Whether Blockstream's `/tx` response exposes input addresses
cheaply enough to cluster during a trace rather than in a prepass; the extra
call cost per node; and how a cluster renders without making the graph lie
about which specific address actually transacted.

## 3. Actionable-entity registry — issuer freeze paths — SHIPPED 2026-09-14

### What shipped

A sibling model, not a `VaspRegistry` generalization (the "to verify"
question below): `IssuerRegistry` (`symbol`, `issuerName`, `freezeProcess`,
`requiresCourtOrder`, `sourceUrl`) — deliberately **not scored** on
`VaspRegistry`'s formula, since no India-specific channel or reliability
figure for either issuer is publicly verifiable, and inventing one would be
exactly the "unverified optimism worse than omitting it" this item warned
against. Seeded with Tether and Circle from their own public statements
(WebFetch/WebSearch, cited in `prisma/seed.ts`): Tether says it works with
340+ agencies in 65+ countries and freezes on a direct law-enforcement
request, no court order documented as required; Circle freezes only "at the
direction of law enforcement or the courts" — a binding order. Neither has a
publicly documented India-specific process.

`lib/scoring.ts`'s `issuerLeads(edges, issuerRegistry)` surfaces every
stablecoin symbol that actually appeared on a trace's edges, independent of
where the trace ended — the issuer can freeze regardless of which exchange
(if any) the funds reached, so this runs alongside `recommendVasp`, not
conditioned on it. Rendered as its own block on `/`, `/cases/[id]` and the
PDF (`components/vasp-rec-line.tsx`'s `IssuerLeads`,
`lib/pdf/report.tsx`'s new section).

**Verified live:** a real depth-3 trace of `0x1b8214682dee1c3d240e7241ef4e278854a2cdf3`
(the Binance/USDT demo address) showed both the USDT and USDC leads with the
correct court-order distinction, on the page and matching the trace's actual
assets — no issuer name appears for a trace that never touched that asset.

**Still open:** no India-specific request route for either issuer is
publicly documented, so the seeded text says that plainly rather than
guessing one. `VaspRegistry` generalization was considered and rejected — a
different institution type (asset issuer vs. custodial exchange) with a
different, unscored process is a cleaner model than forcing both through one
schema.

## 4. Bridge traversal — scoped 2026-09-14, not built

**What.** `LabelType.BRIDGE` already exists in the schema and today only
produces a placeholder — the trace stops and asks for manual correlation.
Bridge messages carry an explicit destination chain and recipient, so
following one is a lookup, not an inference.

**Why.** It's the only cross-chain item that is near-ground-truth, which is
what separates it from mixer demixing. Already promised as roadmap in
`PITCH.md` §12 and `PLAN.md`'s out-of-scope list.

**Verified working, not yet wired in.** Three real message-lookup APIs
responded correctly to a live probe: `scan.layerzero-api.com/v1/messages/tx/<hash>`
returned real pathway data (source/dest chain, sender/receiver) for a known
LayerZero message and a clean 404-shaped "not found" for a made-up hash;
`api.wormholescan.io` and `app.across.to`'s deposit-status endpoint both
responded in the same well-formed way. So the premise holds — this is a real,
tractable lookup, not a research problem.

**Why it still isn't built.** Three things this session didn't have room for
once the constraints below were factored in: (1) a bridge-*detection* step —
today `BRIDGE` is a label type nothing seeds an address as, so the tracer
needs to recognize a bridge contract before it knows which API to call; (2)
one adapter per bridge family (LayerZero-message vs. Wormhole-VAA vs.
Across-deposit are three different request/response shapes, not one); (3) a
rendering decision — a resolved cross-chain hop must read as "the message
proves the funds landed on chain X at address Y," a one-hop fact, not as the
tracer silently continuing to trace on a second chain (that would be a much
bigger claim than this item asks for). None of the three is hard on its own;
doing all three carefully in the same session as the tracer/scoring/legal-
output changes above risked the "rushed integration" failure mode this
project's own review culture keeps catching elsewhere.

**To verify, before building:** which bridge each of this app's seeded/
demo-relevant BRIDGE-worthy contracts actually is (LayerZero OFT is the most
relevant given USDT0 is already traced on Polygon/Arbitrum — see item 1); the
exact response shape for a *found* message (only a not-found shape was
probed); and how a resolved hop's fact should be labeled in the disclosure
payload alongside `evidenceTrail`, so this doesn't repeat item 0's "grep
every consumer of edges" lesson from the other direction.

## 5. Live label / sanctions sync — SHIPPED 2026-09-14

### What shipped

`lib/sanctions.ts` parses OFAC's public `SDN.CSV` export directly (no header
row; a small RFC-4180-ish splitter handles quoted fields with embedded
commas) for `Digital Currency Address - <code>` remarks, keeping only the
currencies this tracer follows: `XBT`→Bitcoin, `ETH`→Ethereum, `TRX`→Tron,
`USDT`/`USDC`→both EVM and Tron (an issuer-listed address isn't chain-scoped
by OFAC, so both are labeled — see the `ponytail:` note in the code for the
one place this over-reaches: an ETH-listed key also controls Polygon/
Arbitrum, but only the Ethereum label is written). Every parsed address is
re-validated against `lib/address.ts`'s own format checks before being
trusted, so a malformed remarks field can't silently mislabel something.

New `SANCTIONED` label type and graph node kind (`#991b1b`, distinct from
`DARKNET`/`RANSOMWARE`'s `#7f1d1d`), feeding `CRITICAL` risk the same way
those two already do. `POST /api/admin/sync-sanctions`, SUPERVISOR-only,
triggered from a button on `/cases` — no scheduled job, per this item's own
"neither branch has anywhere to run one" note; a supervisor runs it by hand.

**A real bug the first live run caught, not code review:** a blind upsert
overwrote the seeded SamSam ransomware address's hand-verified `RANSOMWARE`
label with the generic `SANCTIONED` one, since OFAC's own SDN list also
carries that address (true — it's the same designation `prisma/seed.ts`
already cites). Fixed: the sync now skips any address whose existing label
isn't already `SANCTIONED` — create if absent, refresh if already
`SANCTIONED`, otherwise leave the curated label alone and count it as
skipped. Verified live, twice: the pre-fix sync's downgrade was visible in
`dev.db`; `prisma/seed.ts` restored `RANSOMWARE`; the post-fix sync reported
`0 new, 455 updated, 1 skipped, 456 total` and the row held.

**Measured:** 456 crypto addresses across the 3 traced chains as of
2026-09-14 (252 Bitcoin, 113 Tron, 91 Ethereum), ~17 seconds per sync (455
sequential `findUnique` + `upsert` pairs — acceptable for a manual,
supervisor-triggered action, explicitly not a hot path; batching would be
the first thing to change if this ever ran on a schedule). Self-check:
`npx tsx lib/sanctions.test.ts`.

**Still open:** a real scheduled refresh (see item 6's own note — still no
recurring-job host); the SDN feed's update cadence wasn't measured, only its
current shape.

## 6. Watchlists / monitoring — SHIPPED 2026-09-14 (no worker, by design)

### What shipped

The architecture cost named below was real, and this ships *without* paying
it: new `Watch`/`WatchAlert` models, `lib/watch.ts`'s `checkWatch(watch)`
re-fetches one address's outgoing transfers directly through the existing
per-chain API clients (not a second BFS tracer) and diffs against
`lastSeenTimestamp`, writing one `WatchAlert` per new transfer with the
destination's label (if any) attached. No in-app scheduler anywhere — three
entry points instead: a session-gated "Check now" per watch
(`POST /api/watches/[id]/check`), a bearer-token bulk endpoint for an
external cron or n8n (`POST /api/watches/check-all`, `WATCH_CRON_TOKEN`,
excluded from `proxy.ts`'s session gate the same way the n8n ack routes
already are), and a minimal `/watches` page to add/list/check.

**Verified live:** watching the WazirX headline address (`0x6eedf92f…`)
found zero new alerts on check — correct, per `ROADMAP.md` item 0's finding
that this address moves neither ETH nor tokens. Watching
`0x1b8214682dee1c3d240e7241ef4e278854a2cdf3` found 10 real alerts, 9 of them
correctly labeled `→ Binance 14`. Both demo watches were deleted afterward.

**Still open, exactly as this item originally flagged:** there is still no
recurring-job host on either branch — a real deployment needs an actual
scheduler pointed at `/api/watches/check-all`, this item doesn't invent one.
`lib/sanctions.ts` (item 5) would use the same missing piece for a scheduled
refresh.

## 7. Mixer demixing lab — approved experiment, honestly reframed

**The original framing was weaker than it looked, and the reframe matters.**
This started as "correlate transaction amount + timing to re-link flows across
a mixer." Against Tornado Cash specifically that is close to worthless:

- Pools are **fixed-denomination** (0.1/1/10/100 ETH), so amount carries no
  distinguishing signal — every withdrawal from a pool is identical.
- Large-pool anonymity sets run into the hundreds of thousands of deposits, so
  a pure timing match has a prior around 1/k with k enormous.

The published deanonymizations largely exploited **user error and behavioral
fingerprints**, not timing: depositing and withdrawing to the same address,
withdrawal addresses funded by the deposit address, self-relayed withdrawals
paying gas from a linked wallet, reused custom gas prices, and multi-deposit
amount patterns (7×10 ETH in, 7×10 ETH out). Timing is one weak signal among
several, not the mechanism.

**So the experiment is:** test the behavioral fingerprints, with timing as a
contributing signal, and report which ones actually carry information.

**Kill criterion, fixed upfront.** Baseline is the anonymity-set prior (1/k,
where k = deposits outstanding in that pool between deposit and withdrawal).
If the heuristics can't beat that baseline on known pairs, it doesn't ship.
Address-reuse cases are usable as ground truth for scoring, since those are
independently verifiable on-chain.

**Hard output constraint.** A correlated link is a guess sitting in a graph
where every other edge is a fact. It must render as a visually distinct
"possible link — 1 of k" edge carrying its own denominator, and must never
merge into the real edge set or feed the legal-actionability score. A
heuristic that routes a real disclosure request is a worse failure than no
feature.

**Containment.** Standalone script outside `lib/tracers/`, run manually, so
the demo path stays untouched. `HANDOFF.md` already documents how to test
tracer code without polluting the demo DB (call the library function directly
in a throwaway `tsx` script, never `POST /api/trace`).

**To verify.** Tornado Cash deposit/withdrawal event signatures, whether
Etherscan `getLogs` covers the pools affordably, and which published
heuristics are actually reproducible from public data.

---

## Smaller items, not ranked

- **More chains (partly done 2026-09-13, Arbitrum labels done 2026-09-14).**
  Polygon and Arbitrum shipped on the Etherscan v2 adapter (`PROGRESS.md`,
  2026-09-13). **Arbitrum exchange labels**: three seeded 2026-09-14
  (Binance ×2, OKX) — Arbiscan's Cloudflare challenge blocks `curl` but not a
  real browser session with a short wait, which is how these were finally
  read; Bybit's hot wallet was also confirmed but skipped, not in
  `vaspRegistry`. Still open: **BSC / Base / Optimism / Avalanche**, same
  code plus an allowlist entry each but refused by Etherscan's free tier.
  BSC matters most (USDT-BEP20 is a real fraud rail), so that's a paid-plan
  decision. Non-EVM chains (Solana etc.) each need a new API client and
  address format.

- **Audit log / chain of custody — SHIPPED 2026-09-14.** Append-only,
  hash-chained `AuditEvent` (`lib/audit.ts`) — each row's hash covers its own
  content plus the previous row's hash, so an edited or deleted row breaks
  every hash after it. Tamper-*evident*, not tamper-*proof*, stated plainly
  in the code: `dev.db` write access still lets someone rewrite the whole
  chain; anchoring the head hash somewhere external is the real upgrade.
  Wired into every action with legal or investigative weight (login, trace,
  view/download/route/respond on a case, watch add/check, sanctions sync).
  `/cases/[id]` shows the case's own timeline plus a whole-log chain-verify.
  Self-check: `npx tsx lib/audit.test.ts`.
- **LLM-drafted case narrative — SHIPPED 2026-09-14.**
  `POST /api/cases/[id]/narrative` sends only the already-computed
  structured facts (risk level, flags, nodes, recommendation) to
  `claude-opus-5`, with a system prompt that states the hard constraint
  explicitly: never invent or override the risk, score, or recommendation.
  Stored on `Case.narrativeDraft` so it's not silently re-generated on every
  view. `ANTHROPIC_API_KEY` unset in dev — verified the route degrades to a
  clear 503 rather than a raw SDK error, same contract `lib/n8n.ts` already
  uses for its own optional dependency.
- **MCP server exposing the trace tool** — still blocked exactly as stated:
  auth can't yet issue a non-browser credential (the session model is a
  signed browser cookie). The new `WATCH_CRON_TOKEN` bearer-token pattern on
  `/api/watches/check-all` is the same *shape* of fix, scoped to one route —
  worth reusing the pattern for an MCP-facing token rather than inventing a
  second auth mechanism, but the MCP server itself isn't built.
- **`confirmedByVaspResponse` feedback loop — SHIPPED 2026-09-14.** The
  unused field from day 1 now records what a VASP actually answered
  (`CONFIRMED`/`DENIED`/`NO_RESPONSE`, entered by the investigator on the
  case page after routing). Deliberately does **not** write back into
  `VaspRegistry.responseReliabilityScore` — that stays a seeded,
  hand-verified figure; `/cases` shows the observed rate next to it instead,
  never overwriting it. Verified live: routing a case and marking it
  confirmed moved the dashboard's per-VASP line from `0/3` to `1/4`.
- **Money tracking — SHIPPED 2026-09-14, not originally a roadmap item.**
  User-requested ("can we track how much money has gone to each wallet").
  Three separate answers, each costed differently: (1) received-in-trace —
  free, every node, summed from edges the trace already fetched; (2) live
  wallet balance — one extra paced call, scoped to the suspect root and
  labeled nodes only, never every intermediary (the same per-node-cost
  discipline items 1/2 above are held to); Bitcoin alone gets a real
  lifetime total-received figure, since Blockstream indexes full history and
  Etherscan/Tronscan's free tiers don't; (3) money into each VASP across
  every stored case — a new `/cases` card, grouped by VASP and asset symbol,
  never blended into one dollar figure (no live price feed anywhere in this
  app). Two real bugs, both the "a zero-value contract call isn't a
  payment" shape item 0 already established, caught by checking the live
  dashboard rather than assumed correct: a `CONTRACT_CALL` edge was being
  summed as money received, and a pre-2026-09-12 stored case's literal-zero
  edge slipped through even after that fix. Both fixed by filtering zero
  totals at the source. Self-checks extended in `lib/format.test.ts` and
  `lib/scoring.test.ts`. Full write-up: `PROGRESS.md`'s "session 3" entry;
  `EXPLAINER.md` Feature 18.

## What is deliberately not here

Anything that trades the explainability story for capability. The scoring, the
risk levels and the typology flags stay rule-based and visible on screen. If a
future item can't show its arithmetic, it needs to render as a labeled guess
(item 7's constraint) or not ship.
