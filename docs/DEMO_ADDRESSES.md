# Demo addresses — verified live 2026-09-08

Pre-verified so judging-day API flakiness/venue wifi doesn't sink the live
demo. For *how* to run the demo around these, see
[`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md). Each address is one hop from a labeled exchange, chosen so the
transfer sits at the *front* of that address's own recent-transaction list
(the APIs only return the most recent N txs — see the `ponytail:` notes in
each tracer), which keeps these stable even if the address transacts more
before judging day. All confirmed via `POST /api/trace` with `maxDepth: 1`.

If all three per chain fail simultaneously, the API itself is down (or a
network/firewall issue) — no address is going to fix that; see PLAN.md's
Day 2 note about a live-API fallback for that scenario.

## Ethereum (Etherscan)

| Address | Hits | Confidence chain |
|---|---|---|
| `0x1b8214682dee1c3d240e7241ef4e278854a2cdf3` | Binance 14 (Binance) | root inferred medium ("Binance 14 (inferred deposit address)"), exchange node high |
| `0x82c705d7b532316e5b767df60d3be151b670aa1a` | Coinbase 1 (Coinbase) | root inferred medium, exchange node high |
| `0x6eedf92fb92dd68a270c3205e96dccc527728066` | WazirX 2 (WazirX) | **best headline demo** — WazirX is FIU-IND registered + has an India nodal officer, highest recommendation score (8) of any seed VASP; this address is dormant since 2024-07 so it will not drift |

**What this address actually shows, corrected 2026-09-12.** Its link to
WazirX is **not a transfer.** All 92 of its outgoing transactions are
zero-value calls with calldata into `0x27fd43ba…60c9b4`, which `eth_getCode`
confirms is a **Gnosis Safe proxy** — WazirX's multisig — and every one lands
between 2024-07-18 and 2024-07-22, the WazirX hack window. It has **no**
outgoing token transfers either, so it moved neither ETH nor tokens.

The graph used to label that edge `0.0000 ETH · 92 tx`. Since `ROADMAP.md`
item 0 shipped it reads **`92 contract calls · no value moved`**, drawn as a
dashed violet edge with a legend key. The WazirX recommendation is unchanged
(it comes from the labeled *node*, not the edge value), so the demo still
works end to end — and "92 calls into WazirX's multisig across the four days
of the hack" is a stronger thing to say out loud than a zero-value transfer
was. Say that, not "funds moved to WazirX".

## Bitcoin (Blockstream Esplora)

| Address | Hits | Confidence chain |
|---|---|---|
| `1CRLGcaXajtWVF5EopZgQUqE12dKn8Rtuh` | Binance (deprecated hot wallet) | dormant one-shot address (2025-06-27), most stable pick |
| `1APECTsH2sVpr1usRe7k8sJYkgYfVZpTZZ` | Binance (cold wallet) | low tx count (3 total) |
| `bc1qshmka805v0s9tcxumupntznxptamen2nnym5y9` | Binance (deprecated hot wallet) | dormant one-shot address |

Avoid `bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h` even though it repeatedly
pays the Binance cold wallet — it's an extremely high-frequency sweeper
(dozens of txs/hour) whose send to Binance is already pushed off its own
25-tx Blockstream window; not usable as a root.

### From the suspicious-wallet dataset (added 2026-09-09)

`btc_wallets_data.csv` at the repo root (~8.5k suspicious BTC wallets) was
profiled and sample-traced; the full findings are in
[`HANDOFF.md`](./HANDOFF.md). The one address worth adding to a demo:

| Address | Hits | Notes |
|---|---|---|
| `3FrmCRcGKiTATfreBDM9F17yAUDoDsnWeA` | **Binance @ hop 0, score 5 — same-wallet inference**, routed as an ownership-confirmation request (the exact Binance label at hop 4 is the same VASP, so it's folded in) | needs **maxDepth 5**, unlike everything above. HIGH risk, FAN_OUT + PEEL_CHAIN. **Corrected 2026-09-14 — this is not a laundering trail.** Common-input ownership shows the address *itself* co-spends with the seeded Binance cold wallet `3M219KR5…` (tx `716cca21…`), and so do 4 more nodes at hops 1-3 (txs `a66e02cd…` ×2, `779106c3…`, `eb013fac…`). The graph is almost certainly Binance moving its own funds, and the typology flags are firing on exchange consolidation. If you demo it, the story is "the tool caught that a wallet from a 'suspicious' dataset is an exchange's own", not "watch the money get laundered into Binance". Two cautions, both measured 2026-09-10: it renders 60 nodes because it *hits* `NODE_BUDGET` and truncates, not because the graph is that size (at budget 150 it draws 150 and still truncates, with an identical Binance/risk/flags result — see `PROGRESS.md`); and it takes **~25s** to trace (vs. ~1s for the curated one-hop addresses above, which stop on a label immediately), so narrate over the wait |

Two caveats before relying on it: it is **not** pre-verified to the same
standard as the table above (it was traced once, not re-checked for drift),
and at depth 5 it hits the 60-node budget cap, so the trail is truncated.
The 1-hop addresses above remain the safe headline picks. This one shows a
multi-hop graph and a same-wallet (ownership-confirmation) recommendation, but no longer stands in for a
suspect's laundering path (see the correction in the table).

## Polygon and Arbitrum (Etherscan v2) — added 2026-09-13

Traced once through the library on 2026-09-13, not drift-checked to the bar
of the tables above.

| Chain | Address | Hits |
|---|---|---|
| Polygon | `0x135db93c0490501bf8d00600a9e494fdb7920b2d` | Binance 48 — 765.57 USDT0, root medium, ~1.4s at depth 1–2 (also verified end to end through `POST /api/trace`, case page and PDF) |
| Polygon | `0x10b692f5191c2c36a727b5a335337e7a300eddec` | Binance 48 — 208,387 USDT0 over 44 tx, root medium |
| Arbitrum | `0xe252fb1eab899250361feab4ecbc358b02d81b3e` | no recommendation (no Arbitrum labels exist) — a busy USDT0/USDC graph, ~50 nodes at depth 2; the page shows a "no labeled addresses are seeded for ARBITRUM" warning |

An EVM `0x…` address is valid on all three EVM chains, so pick the chain in
the selector deliberately — the app can't infer it.

## Tron (Tronscan)

| Address | Hits | Confidence chain |
|---|---|---|
| `TZ44qjhyXiqfW8rXr5U7tAgfS6qdtKKSGD` | Bitfinex | root inferred medium, exchange node high |
| `TBADpGt2BSZkHXZQaScWwyR56eoScd4ibx` | Bitfinex | root inferred medium, exchange node high |
| `TGEFpHcCZnJujjWUtHUpwdTeYe6Ts2QQvh` | Bitfinex | root inferred medium, exchange node high |

**Since 2026-09-13 the tracer also follows USDT.** All three still reach
Bitfinex with a medium root. `TZ44…` and `TGEF…` now also draw a USDT edge
to Bitfinex next to the TRX one. `TAfeh255D76bsBPHtpKj29JpTcwCFmKMV2` is a
new USDT-heavy option: 17,928 USDT + 46.77 TRX into Bitfinex, ~1.4s at depth
2. It has been traced once, not drift-checked. On Ethereum, `0x1b82…` now
shows 3,754.90 USDT → Binance 14 instead of a phantom Tether call, plus a
multi-hop USDC tree (~11s at depth 3, so use depth 1 for a fast demo). At
depth 3 that tree also raises **FAN_OUT on three USDC intermediaries, moving
the case from LOW to MEDIUM risk**. At depth 1 it's still LOW with no flags
(measured 2026-09-13).

*Pre-2026-09-13 note:* native-TRX-only tracer (see `lib/tronscan.ts`), so these were picked from
Bitfinex's recent *native TRX* deposits specifically — most Tron flow into
big exchanges is USDT (TRC20), which isn't traced (out of scope, noted in
`lib/tronscan.ts`; closing it is [`ROADMAP.md`](./ROADMAP.md) item 1 — if it
lands, this table can be rebuilt from the far larger USDT deposit flow).
