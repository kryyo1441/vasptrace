# Case scenarios — every outcome the tracer can produce, with an address for each

Written 2026-09-17. This is the catalogue: one section per *kind of result*
VASPtrace can return, with a real wallet address that produces it. Use it to
pick a demo address for the story you want to tell, or to check whether a
result you're seeing is a known shape or something new.

Companion docs: [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) (the 7-minute narration),
[`DEMO_ADDRESSES.md`](./DEMO_ADDRESSES.md) (provenance for the curated set).

**Two warnings before you rely on any row here.**

1. **These are live addresses.** Balances, graph sizes and hop counts drift as
   the wallets keep transacting. Dormant addresses (marked below) are stable;
   busy ones are not. Re-trace anything you haven't run in the last day or two
   before putting it in front of judges.
2. **Verification status is marked per row, honestly.** "Live-verified" means
   traced through the app's own tracer on the date shown. "Inherited" means it
   came from an earlier session's records and hasn't been re-checked since.

---

## Index — pick by outcome

| # | Outcome | Address | Chain | Depth |
|---|---|---|---|---|
| 1 | One hop → exchange, **highest score (8)** | `0x6eedf92fb92dd68a270c3205e96dccc527728066` | ETH | 1 |
| 2 | One hop → exchange, weaker standing | `0x1b8214682dee1c3d240e7241ef4e278854a2cdf3` | ETH | 1 |
| 3 | **Multi-hop** (2 hops) → FIU-IND exchange **with** nodal officer | `TDqZHB9kZ88Cu7CP9yAKPL3zhh9KKh9MiT` | TRON | 5 |
| 4 | **Multi-hop** (3 hops) → exchange, no nodal officer | `bc1qq80ekeufnjc9aaakfvj9llqjsaszzyfka9hkkw` | BTC | 5 |
| 5 | **Multi-hop** (4 hops) → exchange, no nodal officer | `1Cg1X5xS6wkLqPksNcsVzm41Mf24PsrE1` | BTC | 5 |
| 6 | **Node budget hit**, no recommendation at all | `bc1qjzmyhgrq9vamc5v9lsc3hcn6uqglz958hjv02t` | BTC | 5 |
| 7 | Search exhausted naturally, no VASP reached | `155Yv6Hmzs5RT8j6uZAzfWzecvV9FDyu6k` | BTC | 5 |
| 8 | **Same-wallet inference** — suspect *is* the exchange | `3FrmCRcGKiTATfreBDM9F17yAUDoDsnWeA` | BTC | 5 |
| 9 | Stablecoin trail + **issuer freeze leads** | `0x1b8214682dee1c3d240e7241ef4e278854a2cdf3` | ETH | 3 |
| 10 | **Bridge** identified, trace stops | `0xa77f2281a4163ff7eafca1dbb625b960adba24cc` | ETH | 1 |
| 11 | Chain with **no labels seeded** → warning state | `0xe252fb1eab899250361feab4ecbc358b02d81b3e` | ARB | 2 |
| 12 | Unusable shapes (know them, don't demo them) | see §12 | — | — |
| 13 | **CRITICAL risk** — sanctioned entity reached | `0x77bb1e8831b8c3fae0d69109dfff47b81857a5d2` | ETH | 1 |
| 14 | **CRITICAL + a routable exchange** — the full picture | `0xb25bdee2fd79b517db1b6fcb2c220fee5901fa83` | ETH | 3 |

---

## 1. One hop → exchange, highest possible score

**`0x6eedf92fb92dd68a270c3205e96dccc527728066`** · Ethereum · depth 1 ·
*inherited, dormant since 2024-07 — the most stable address in this file*

2 nodes, 1 edge, **LOW** risk, no typology flags. Reaches **WazirX** with
**score 8** — the highest in this catalogue (FIU-IND +3, nodal officer +2,
reliability 4, minus 1 hop).

**The thing to know cold:** the edge is a **dashed violet contract-call edge**
labelled `92 contract calls · no value moved`. All 92 outgoing transactions
are zero-value calls into WazirX's Gnosis Safe multisig, inside the
2024-07-18→22 hack window. It moved neither ETH nor tokens. The
recommendation is still correct — it comes from the labeled *node*, not the
edge — but **never narrate this as "funds moved to WazirX."**

## 2. One hop → exchange, weaker legal standing

**`0x1b8214682dee1c3d240e7241ef4e278854a2cdf3`** · Ethereum · depth 1 ·
*inherited, busy address — graph size drifts*

3 nodes, reaches **Binance 14** with 3,754.90 USDT. Binance is FIU-IND
registered but has **no** India nodal officer and reliability 2, so it scores
well below WazirX despite an equally direct hit. Useful as the direct
contrast to §1 — same hop distance, very different actionability.

Other one-hop picks per chain, all inherited:

| Address | Chain | Reaches |
|---|---|---|
| `0x82c705d7b532316e5b767df60d3be151b670aa1a` | ETH | Coinbase 1 (not FIU-IND registered — scores lowest of all) |
| `1CRLGcaXajtWVF5EopZgQUqE12dKn8Rtuh` | BTC | Binance (deprecated hot wallet), PEEL_CHAIN flag. Most stable BTC pick, ~1.9s |
| `1APECTsH2sVpr1usRe7k8sJYkgYfVZpTZZ` | BTC | Binance (cold wallet), only 3 txs total |
| `bc1qshmka805v0s9tcxumupntznxptamen2nnym5y9` | BTC | Binance (deprecated hot wallet), dormant one-shot |
| `TZ44qjhyXiqfW8rXr5U7tAgfS6qdtKKSGD` | TRON | Bitfinex (+ a USDT edge since the stablecoin work) |
| `TBADpGt2BSZkHXZQaScWwyR56eoScd4ibx` | TRON | Bitfinex |
| `TGEFpHcCZnJujjWUtHUpwdTeYe6Ts2QQvh` | TRON | Bitfinex (+ USDT edge) |
| `TAfeh255D76bsBPHtpKj29JpTcwCFmKMV2` | TRON | Bitfinex — 17,928 USDT + 46.77 TRX, USDT-heavy option |
| `0x135db93c0490501bf8d00600a9e494fdb7920b2d` | POLYGON | Binance 48 — 765.57 USDT0, ~1.4s |
| `0x10b692f5191c2c36a727b5a335337e7a300eddec` | POLYGON | Binance 48 — 208,387 USDT0 over 44 tx |
| `0xF977814e90dA44bFA03b6295A0616a897441aceC` | BSC | Binance — routed through Ankr, not Etherscan. **Least rehearsed chain**, verify before demoing |

## 3. Multi-hop → FIU-IND exchange *with* a nodal officer ← the "good ending"

**`TDqZHB9kZ88Cu7CP9yAKPL3zhh9KKh9MiT`** · Tron · depth 5 ·
*live-verified 2026-09-17, dormant (edges are 2021–2022) — stable*

60 nodes, 71 edges, 27.5s. Reaches **Bitbns** at **hop 2** through genuine
non-zero USDT-TRC20 transfers — a real `LABEL_MATCH`, no same-wallet
inference. **Score 6** (FIU-IND +3, nodal officer +2, reliability 3, minus 2
hops). `FAN_OUT` flagged → **MEDIUM** risk.

The most complete story in this file: several real hops of laundering-shaped
movement, terminating at an exchange that is both legally obligated *and* has
a named contact to serve. Also hits the node budget on other branches — the
Bitbns path resolves regardless, which is itself worth pointing at.

*Note:* three depth-1 nodes are labeled `Bitbns (inferred deposit address)` at
medium confidence by the clustering heuristic. Those never drive the
recommendation — the routed one is the depth-2 exact match.

## 4–5. Multi-hop → exchange with no nodal officer

Both *live-verified 2026-09-17*, both reach Binance's deprecated hot wallet
(`1NDyJt…`) through real transfer chains, `sameWallet` **not** set:

| Address | Hops | Nodes/Edges | Risk | Flags | Time |
|---|---|---|---|---|---|
| `bc1qq80ekeufnjc9aaakfvj9llqjsaszzyfka9hkkw` | 3 | 58/68 | HIGH | PEEL_CHAIN, FAN_OUT | 24.0s |
| `1Cg1X5xS6wkLqPksNcsVzm41Mf24PsrE1` | 4 | 60/64 | HIGH | PEEL_CHAIN, FAN_OUT | 20.6s |

These are the closest thing in the catalogue to a textbook laundering trail
that still ends somewhere actionable. Contrast them with §3: more hops, HIGH
risk, but a *lower*-standing exchange at the end.

## 6. Node budget hit → no recommendation at all

**`bc1qjzmyhgrq9vamc5v9lsc3hcn6uqglz958hjv02t`** · Bitcoin · depth 5 ·
*verified in a batch run 2026-09-17; re-trace once before relying on it —
Blockstream rate-limited the confirming run*

60 nodes, 76 edges, `PEEL_CHAIN` + `FAN_OUT`, and
`warnings: ["Node budget (60) reached — trace truncated before completing all branches."]`
with **`recommendation: null`**. No EXCHANGE/MIXER/RANSOMWARE node anywhere in
the graph — it genuinely never reached a label.

This is the honest-limits beat: a suspicious-shaped graph, searched to the
budget ceiling, ending in no actionable answer. That's a *result*, not a
failure — and it's the clearest place to talk about what a paid API tier or a
background job queue would change.

Eight other addresses from the same scan produce this shape with slightly
smaller graphs; this one is the richest.

## 7. Search exhausted naturally → no VASP reached

**`155Yv6Hmzs5RT8j6uZAzfWzecvV9FDyu6k`** · Bitcoin · depth 5 · *inherited*

Backups with the same outcome: `1CYYS3R6CKD43nCxFbqvEvjr3VUScKswBw`,
`3P9WebHkiDxCi8LDXiRQp8atNEagcQeRA3`.

Distinct from §6 and worth the distinction out loud: two of these *exhausted
their entire search space* (89 and 64 nodes at a raised budget, no truncation
at all) and still hit zero labels. §6 ran out of budget; these ran out of
graph. Same empty recommendation, different reason — and only §7 supports the
claim "this trail is genuinely exchange-free as far as we can see."

## 8. Same-wallet inference — the suspect *is* the exchange

**`3FrmCRcGKiTATfreBDM9F17yAUDoDsnWeA`** · Bitcoin · depth 5 · *inherited,
~21s*

60 nodes (hits the budget cap), FAN_OUT + PEEL_CHAIN, HIGH risk. Recommends
**Binance at hop 0, score 5, by same-wallet inference** — the button reads
*"Route ownership-confirmation request to Binance."*

**Corrected 2026-09-14 — this is not a laundering trail.** The address itself
co-spends transaction inputs with the seeded Binance cold wallet (tx
`716cca21…`), as do four downstream nodes. It's almost certainly Binance
moving its own funds, and the typology flags are firing on exchange
consolidation.

The true story here is a good one: an address pulled from a "suspicious
wallets" dataset turns out, on-chain, to be exchange-controlled — and the
tool says so with the transaction that proves it, while routing a request
that asks the exchange to *confirm ownership* rather than asserting it. Tell
that story. Never narrate it as laundering, and never open with it.

## 9. Stablecoin trail + issuer freeze leads

**`0x1b8214682dee1c3d240e7241ef4e278854a2cdf3`** · Ethereum · **depth 3** ·
*inherited, ~11.5s, 24–34 nodes (live, drifts)*

The same address as §2 but walked deeper: a multi-hop USDC tree that raises
**FAN_OUT on three intermediaries**, moving the case from LOW to **MEDIUM**,
reaching Binance, and surfacing **two issuer freeze leads** — Tether (acts on
a law-enforcement request) and Circle (requires a binding court order).

The only address in the catalogue that demonstrates the issuer-freeze lever,
which is a separate path from the VASP recommendation: the asset issuer can
freeze regardless of which exchange, if any, the funds reached.

## 10. Bridge identified, trace stops

**`0xa77f2281a4163ff7eafca1dbb625b960adba24cc`** · Ethereum · depth 1 ·
*inherited*

1 hop to a teal **`LayerZero: Swappable Bridge`** node, `recommendation: null`.

The tool labels the bridge and stops — it does **not** claim to know where
the funds went on the destination chain. Say that boundary out loud before
anyone asks; the failure mode to avoid is implying the trace follows money
across a bridge.

Other seeded bridges that produce this shape if a trace hits them:
MetaMask Meta Bridge (`0x0439e60f…`), Mayan Swap Bridge (`0x05b70fb5…`),
Synapse FastBridge RFQ Router V2 (`0x00cd0000…`), Arbitrum Outbox 4
(`0x0b9857ae…`).

## 11. Chain with no labels seeded → explicit warning state

**`0xe252fb1eab899250361feab4ecbc358b02d81b3e`** · Arbitrum · depth 2 ·
*inherited, ~50 nodes*

A busy USDT0/USDC graph that produces **no recommendation**, with the page
showing *"no labeled addresses are seeded for ARBITRUM."* Arbitrum has only
three labels total and none of them is reachable from ordinary activity.

Worth showing only if asked how the tool behaves on a chain it has thin
coverage for — the answer being that it says so explicitly rather than
implying the trail is clean.

## 12. Unusable shapes — recognise, don't demo

| Address / shape | Chain | Why it fails |
|---|---|---|
| `1FfmbHfnpaZjKFvyi1okTjJJusN455paPH` | BTC | Real counterparty of the seeded SamSam ransomware address, but 969 txs — Blockstream returns only ~25 recent, so the tracer sees zero outgoing and returns an **empty graph**. A real link that cannot be demoed |
| `bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h` | BTC | Pays the Binance cold wallet repeatedly, but it's a high-frequency sweeper (dozens of txs/hour) whose Binance send is already off its own 25-tx window |
| Any wallet with `total_sent = 0` | BTC | **55% of `btc_wallets_data.csv` (4,660 of 8,526 rows).** The tracer follows *outgoing* transfers, so these render a single node and nothing else |
| Any wallet with very high tx counts | any | The explorer APIs return only the most recent N transactions; older activity is invisible. Prefer 3–200 txs, safest 3–25 |
| Large Tron "hub" addresses (`TU4vEruvZ…`, `TBeSKLW…`, `TVmRwd2…`) | TRON | They do funnel into WazirX/Bitbns, but the fan-out cap of 5 ranks by value and their biggest flows go elsewhere, so the app's own BFS never reaches the VASP |

## 13. CRITICAL risk — a sanctioned entity, one hop out

**`0x77bb1e8831b8c3fae0d69109dfff47b81857a5d2`** · Ethereum · depth 1 ·
*live-verified 2026-09-17, 2.7s*

2 nodes, 1 edge, **CRITICAL** risk. Reaches **`GARANTEX EUROPE OU`** — the
OFAC-sanctioned Russian exchange — at hop 1, high confidence, from the
synced OFAC SDN list. No typology flags, `recommendation: null`.

The root has **only two transactions in its entire history**, making it the
most stable address in this file after §1 — nothing about it can drift.

The interesting shape here is the combination: *maximum* risk severity and
**nothing to route**. Worth saying out loud, because it's counter-intuitive
and it's honest:

> "Highest risk level the tool can assign — the money went straight to an
> OFAC-sanctioned exchange. And notice it recommends nothing, because a
> sanctioned entity is not somewhere I serve a disclosure request. That's a
> different action entirely — it goes to FIU-IND as a sanctions matter. The
> tool is telling me the severity and *declining* to suggest a legal route
> that wouldn't make sense, instead of forcing a recommendation because the
> screen has a box for one."

Alternates, all live-verified 2026-09-17 at depth 1, all CRITICAL:

| Address | Nodes/Edges | Sanctioned entity reached |
|---|---|---|
| `0xdbaef73d20b0ca4abc72e8daf97af36626e3b973` | 6/9 | **Two** distinct Garantex addresses at hop 1 |
| `0x5dcc4a41ef746c30c7d11b682525aef9f4a1882a` | 5/4 | Garantex Europe OU |
| `0xb25bdee2fd79b517db1b6fcb2c220fee5901fa83` | 4/3 | Task Force Rusich |

## 14. CRITICAL **and** a routable exchange — the most complete single case

**`0xb25bdee2fd79b517db1b6fcb2c220fee5901fa83`** · Ethereum · **depth 3** ·
*live-verified 2026-09-17, 19.0s*

42 nodes, 52 edges. **CRITICAL** risk from a `TASK FORCE RUSICH` sanctioned
node at hop 1 (an OFAC-designated Russian paramilitary group), **both**
typology flags raised — `FAN_OUT` *and* `PEEL_CHAIN` — and it still resolves
a **Binance recommendation at score 3**.

This is the only address in the catalogue that exercises every layer at once:
maximum risk severity, sanctions exposure, laundering-shaped movement, and a
legally actionable exchange at the end of it. If you only demo one multi-hop
case, this is the strongest candidate — at the cost of a 19-second trace, so
narrate over the wait.

> "This one has everything my job cares about. The first hop is an
> OFAC-sanctioned entity, so this is critical severity and there's a
> sanctions report to file. The money then fans out and peels down through
> forty-odd addresses — textbook laundering shape. And it still ends
> somewhere I can actually serve: Binance, scored three, because they're
> registered but there's no nodal officer and it's two hops out. Severity,
> pattern, and a legal route, on one screen."

---

## What's reachable at all — the label coverage that decides every outcome

A trace can only produce a recommendation if it routes into a seeded label
whose name also exists in the VASP registry. That coverage is the real
constraint behind most "no recommendation" results above.

**VASPs with both a registry entry and at least one labeled address:**

| VASP | FIU-IND | Nodal officer | Reliability | Best possible score (hop 0) | Chains with labels |
|---|---|---|---|---|---|
| WazirX | yes | yes | 4 | **9** | ETH, TRON |
| Bitbns | yes | yes | 3 | 8 | TRON |
| Binance | yes | no | 2 | 5 | ETH, BTC, POLYGON, ARBITRUM, BSC |
| OKX | yes | no | 2 | 5 | ETH, TRON, POLYGON, ARBITRUM |
| Coinbase | no | no | 3 | 3 | ETH, POLYGON, BSC |
| Kraken | no | no | 2 | 2 | ETH, TRON, POLYGON, BSC |
| KuCoin | no | no | 1 | 1 | ETH, TRON, POLYGON |
| MEXC | no | no | 1 | 1 | TRON |
| Bitfinex | no | no | 1 | 1 | TRON |

Registered with FIU-IND but **no labeled address anywhere**, so they can never
be recommended: CoinDCX (reliability 5 — the highest in the registry),
ZebPay, CoinSwitch, Giottus, Unocoin, BuyUcoin, KoinBX.

**Bitcoin is the thinnest chain by far** — only two labeled addresses exist
(`1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s` and `3M219KR5vEneNb47ewrPfWyb5jQ2DjxRP6`,
both Binance). That single fact explains why most BTC traces in this
catalogue end at §6 or §7.

**Non-exchange labels seeded** (these change the *risk level*, not the
recommendation):

| Label | Address | Chain | Effect |
|---|---|---|---|
| Tornado Cash Router | `0x722122df12d4e14e13ac3b6895a86e84145b6967` | ETH | MIXER node → **HIGH** risk; `RAPID_MIXER_HOP` if reached within 2 hops |
| Tornado Cash 100 ETH pool | `0x8589427373d6d84e98730d7795d8f6f8731fda16` | ETH | same |
| SamSam ransomware cash-out | `149w62rY42aZBox8fGcmqNsXUzSStKeq8C` | BTC | RANSOMWARE node → **CRITICAL** risk |
| OFAC SDN list (synced) | 456 addresses as of 2026-09-14 | various | SANCTIONED node → **CRITICAL** risk |

---

## Risk levels, and which scenario produces each

Risk is derived from the graph, not scored separately: any DARKNET /
RANSOMWARE / SANCTIONED node → **CRITICAL**; any MIXER node or 2+ typology
flags → **HIGH**; 1 flag → **MEDIUM**; otherwise **LOW**.

| Risk | Produced by | Example |
|---|---|---|
| LOW | clean one-hop trace, no flags | §1 `0x6eedf92f…` |
| MEDIUM | exactly one typology flag | §3 `TDqZHB9k…`, §9 `0x1b82…` at depth 3 |
| HIGH | two flags (FAN_OUT + PEEL_CHAIN), or any mixer | §4, §5, §6, §8 |
| CRITICAL | ransomware / sanctioned / darknet node reached | §13 `0x77bb1e88…`, §14 `0xb25bdee2…` |

**CRITICAL is reachable through the sanctioned route** (§13, §14, verified
2026-09-17). The *ransomware* route specifically is still unproven: the
seeded SamSam address (`149w62rY…`) has 6,232 transactions and its one known
low-volume counterparty (`1FfmbHfnpa…`, §12) has too much history for the API
window to see, so no verified root reaches a RANSOMWARE node. Sanctioned
nodes produce an identical CRITICAL verdict, so this is a curiosity rather
than a gap in the demo.

---

## Typology flags — what actually triggers each

| Flag | Rule | Seen in |
|---|---|---|
| `FAN_OUT` (fan-out / smurfing) | 5+ distinct non-contract-call destinations from one address | §3, §4, §5, §6, §8, §9 |
| `PEEL_CHAIN` | exactly 2 outgoing edges, same asset, larger leg ≥ 4× the smaller | §4, §5, §6, §8, and `1CRLGcaX…` |
| `RAPID_MIXER_HOP` | a MIXER node reached at depth ≤ 2 | no verified demo address |

All three are fixed-threshold heuristics, labeled as such in the UI. They
direct attention; they never drive a recommendation on their own.
