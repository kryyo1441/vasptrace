# VASPtrace — roadmap (post-submission)

Written 2026-09-12, after the SIH submission. **This is the single engineering
roadmap.** `PITCH.md` §12 is pitch-facing prose and points here; `HANDOFF.md`
points here for priority order; `PLAN.md` is the frozen 5-day brief and is not
a roadmap. Don't fork a second list — this repo already has a scar from a
duplicated brief going stale (`~/code/CLAUDE.md` exists only because of that).

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

- **Schema work doubles across two diverged branches.** `day3-n8n-rehearsal`
  is SQLite, `vercel-postgres` is Prisma Postgres, and they have already
  diverged enough to break a build on branch switch (see `PROGRESS.md`,
  2026-09-12). Any item here that touches `prisma/schema.prisma` costs two
  migrations and two verifications. **Reconcile the branches before starting
  phase-2 schema work**, or pick one and declare the other dead.
- **More API calls per node fights `withPacing`.** Pacing serializes one call
  per chain, a deep trace already measures ~25s (`HANDOFF.md` item 0), and
  raising `NODE_BUDGET` was measured and rejected. Items 1 and 2 both add
  calls *per node*, so both need a measured timing number before they land,
  not an estimate.

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

## 1. Token / stablecoin tracing — the biggest real gap

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

## 2. Bitcoin common-input-ownership clustering

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

## 3. Actionable-entity registry — issuer freeze paths

**What.** Generalize `VaspRegistry` beyond exchanges. Stablecoin issuers
(Tether, Circle) freeze addresses at law-enforcement request, so for
USDT-denominated flows the actionable party may be the **issuer**, not the
exchange the funds reached.

**Why.** This extends the project's actual differentiator — *who in India can
make someone answer* — rather than adding generic tracing capability. It is
also the natural payoff of item 1 and is meaningless before it: there is no
issuer to act against until the tracer can see token flows at all.

**To verify.** The documented request routes for Indian LEAs to Tether/Circle
and their realistic response characteristics (the registry's whole point is
honest reliability scoring, so unverified optimism here would be worse than
omitting it); whether `VaspRegistry` generalizes cleanly or wants a sibling
model.

## 4. Bridge traversal

**What.** `LabelType.BRIDGE` already exists in the schema and today only
produces a placeholder — the trace stops and asks for manual correlation.
Bridge messages carry an explicit destination chain and recipient, so
following one is a lookup, not an inference.

**Why.** It's the only cross-chain item that is near-ground-truth, which is
what separates it from mixer demixing. Already promised as roadmap in
`PITCH.md` §12 and `PLAN.md`'s out-of-scope list.

**To verify.** Which bridges expose a public message-lookup API, and whether
any single aggregator covers enough of them to be worth one integration
instead of N.

## 5. Live label / sanctions sync

**What.** OFAC publishes machine-readable SDN data; the labeled-address DB is
currently a point-in-time seed (`prisma/seed.ts`) that ages silently.

**Why.** Low effort, and it removes a slow-rotting correctness problem — a
seeded label is a claim about the world that was true when it was written. The
seed's existing bar (never add a label without verifying it) should carry over
to whatever syncs it.

**To verify.** The SDN feed's crypto-address field shape and update cadence,
and *where a scheduled refresh runs* — neither branch currently has anywhere
to put a recurring job (see item 6).

## 6. Watchlists / monitoring — highest operational value, biggest architectural cost

**What.** Subscribe to an address and alert when it moves, instead of one-shot
retrospective traces.

**Why.** A disclosure request is retrospective; an alert fired when funds land
on an exchange deposit address is actionable **while the money is still
there**. For the LEA use case that is the difference between tracing and
freezing — arguably the highest-value idea on this list.

**Why it isn't ranked higher.** It needs a worker/queue and somewhere to run
it. That's an architecture change, not a feature, and neither branch can host
it today (n8n can't follow the app to Vercel either — `HANDOFF.md` item 6).
Sequence it after the branch reconciliation in the constraints above.

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

- **Audit log / chain of custody** — already promised in `PITCH.md` §12 and
  named as a known gap in `ARCHITECTURE.md`. For a tool whose output is meant
  to support legal process, "who ran what, when, and what did the report say
  at the time" is a credibility feature, not a nice-to-have.
- **LLM-drafted case narrative** — plausible use of current tooling *only*
  under one hard constraint: it drafts prose from the already-computed
  structured trace and never touches the score, the risk level, or the
  recommendation. Those stay rule-based and auditable. An LLM that decides
  risk would delete the project's entire differentiation story.
- **MCP server exposing the trace tool** — the API routes already exist, so
  wrapping them lets an investigator drive a trace from an agent. Cheap; do it
  only once auth can issue a non-browser credential, since the current session
  model is a signed browser cookie.
- **`confirmedByVaspResponse` feedback loop** — the unused field from day 1
  (`PLAN.md`, out-of-scope list). Only becomes meaningful with real VASP
  responses, so it stays parked.

## What is deliberately not here

Anything that trades the explainability story for capability. The scoring, the
risk levels and the typology flags stay rule-based and visible on screen. If a
future item can't show its arithmetic, it needs to render as a labeled guess
(item 7's constraint) or not ship.
