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
| `3FrmCRcGKiTATfreBDM9F17yAUDoDsnWeA` | Binance (cold wallet) @ hop 4 | needs **maxDepth 5**, unlike everything above. HIGH risk, FAN_OUT + PEEL_CHAIN — the best "messy real laundering trail" visual we have, vs. the clean 1-hop addresses above. Two cautions, both measured 2026-09-10: it renders 60 nodes because it *hits* `NODE_BUDGET` and truncates, not because the graph is that size (at budget 150 it draws 150 and still truncates, with an identical Binance/risk/flags result — see `PROGRESS.md`); and it takes **~25s** to trace (vs. ~1s for the curated one-hop addresses above, which stop on a label immediately), so narrate over the wait |

Two caveats before relying on it: it is **not** pre-verified to the same
standard as the table above (it was traced once, not re-checked for drift),
and at depth 5 it hits the 60-node budget cap, so the trail is truncated.
The 1-hop addresses above remain the safe headline picks; this one is for
showing what a *realistic* multi-hop trace looks like.

## Tron (Tronscan)

| Address | Hits | Confidence chain |
|---|---|---|
| `TZ44qjhyXiqfW8rXr5U7tAgfS6qdtKKSGD` | Bitfinex | root inferred medium, exchange node high |
| `TBADpGt2BSZkHXZQaScWwyR56eoScd4ibx` | Bitfinex | root inferred medium, exchange node high |
| `TGEFpHcCZnJujjWUtHUpwdTeYe6Ts2QQvh` | Bitfinex | root inferred medium, exchange node high |

Native-TRX-only tracer (see `lib/tronscan.ts`), so these were picked from
Bitfinex's recent *native TRX* deposits specifically — most Tron flow into
big exchanges is USDT (TRC20), which isn't traced (out of scope, noted in
`lib/tronscan.ts`; closing it is [`ROADMAP.md`](./ROADMAP.md) item 1 — if it
lands, this table can be rebuilt from the far larger USDT deposit flow).
