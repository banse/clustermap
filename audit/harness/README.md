# tools/sybil — sybilkit reality-check harness (THE LIST)

Produced 2026-08-25. Report: `docs/sybilkit-reality-check.html`. Everything is read-only, keyless, python3 stdlib;
the harness imports sybilkit from the sibling repo (`/Library/Vibes/autopull/sybilkit/src`) and reads the settled
maxpane cache (`~/.maxpane/curator_cache.json`). Nothing here modifies sybilkit.

| file | what it does |
|---|---|
| `sk_diag.py` | reproduces the live run (263 clusters / 11,573 flagged), labels every edge by rule kind, per-cluster anatomy → `clusters_diag.json`, single-rule ablations, controls/ENS checks |
| `sk_v2.py` | the v2 prototype: re-implements tier A with knobs (block-bounded windows, near-minimum band, ≥6-decimal odd amounts, tight peel-chain builder, ladder / engine-pocket / residual families, freshness-gated exchange hubs, per-member gate) and a metrics table (farm-wave recall, ENS/IDMD/controls/rescuers collateral). `--only "name;name"`, `--infra infra_cex.json`, `--enrich-extra a.json;b.json`, `--diff "<variant>"` |
| `null_model.py` | operator-free synthetic population (observed pace, ENS amount prior, empirical funder mix); flag rate per rule set = false-linking base rate |
| `fetch_all_enrich.py` | **full-population enrichment**: first funder for every contributor + a tx fingerprint for every deposit. Funders via Blockscout legacy `txlist&sort=asc` (oldest-first — one request instead of paging an 80-page newest-first feed), internal-transactions fallback for disperse/multisend recipients; tx rows via batched `eth_getTransactionByHash` on a public node. Resumable (JSONL checkpoints), rate-limited with 429 backoff, never writes a resolved row for a request it could not read. `--merge-only` rebuilds `full_enrich.json` from the checkpoints |
| `funder_profile.py` | classifies every distinct funder by what the chain says it is — nonce + code via batched RPC → exchange (≥50 k txs) / service (≥2 k) / contract / contributor / operator / personal. Writes `funder_profile.json`, `infra_cex_full.json`, `infra_all.json` (drop-in for `sk_v2 --infra`, replacing the hand-written 12-address CEX list) |
| `full_census.py` | what the population is made of once every funder is known: funding source by class (wallets + points), peel chains (loose vs the tight v2 form), chain depth and components, nonce-at-deposit distribution → `full_census.json` |
| `verify_enrich.py` | independent check: re-resolves a uniform and a high-activity sample against the rows maxpane's paginated walk produced, cross-checks RPC tx rows against Blockscout, prints coverage. Run it when nothing else is hitting Blockscout — a 429 looks exactly like a disagreement |
| `run_full.sh` | merge → classify → census → rerun shipped + v2 on complete data → rebuild the report |
| `fetch_list_enrich.py` | keyless Blockscout first-funder + deposit-tx fingerprint fetch for a JSON list of addresses (1 req/s) |
| `build_report.py` | renders the HTML report from the harness logs/JSON |
| `infra_cex.json` | 25 exchange-scale first funders seen in this population (Bitget 6, Binance 18, OKX 3/24, …); `hub_candidates.json` = the 164 funders with ≥2 funded wallets |

Evidence lives in `data/sybil/` (gitignored, on disk): `agents/agent_*.json` (11 investigations, 22 skeptic passes, completeness
critic), `enrichment/ring_enrich.json` + `ladder_enrich.json` (fetched first funders / deposit-tx fingerprints for the ring and
ladder wallets — pass via `--enrich-extra`), `clusters_diag.json`, `null_model.json`, `v2_diff.json` (released / newly flagged
wallets), `idmd_*.json`, `runs/*.log`, `workflow_script.js`. Scripts resolve their data dir to `data/sybil` (override: env `SYBIL_DATA`); `python3 tools/sybil/build_report.py`
regenerates the report from the saved logs.

Headline (complete enrichment, every contributor's funder + every deposit's tx): the shipped rules flag 59 % of THE LIST and
45.8 % of an operator-free null population, and complete data does not change their output by a single wallet — their funding
family only corroborates clusters that the amount/timing rules already built, so the ≈99 ETH ring stays 81/419. 66 % of the list
(78.4 % of points) was funded by another wallet on the list; 7,511 wallets sit >100 funding hops deep; the deepest single chain is
2,000 nonce-0 wallets depositing inside one 240-block window. The v2g rule set at 100 % coverage: 12,431 flagged (76.7 % of points),
ENS-named flagged 360→28, IDMD holders 35→2, ring 397/419, the 1.0–1.14 ETH relay 840/841, Bitget loop 238/239, all audited waves
≥99.4 %, null-model false linking 0.1 %. It releases 2,069 wallets (343 ENS-named) and adds 2,927 carrying funding evidence.
Rebuild it all: `tools/sybil/run_full.sh` (add `--with-null` for the null model).

**How the proof works.** The public mirror at `github.com/banse/clustermap` under `audit/` reproduces
every number here from a clone with no private inputs, no key and no network — and reproduces **cluster
membership**, not just totals: v2h's sorted membership hashes to `bd986908e33bf6c1c4cda481dae0009f` and
its flagged set to `71e561a2d104bea9f0e36e742ec54ddc`, stable across processes. Keep it that way —
anything that makes those unstable (unsorted set iteration, a timestamp in an artefact) breaks the proof
without breaking a test. Next step, spec in `ONCHAIN_LOADER.md`: rebuild the population straight from the
contract's event log so the snapshot file leaves the trust surface too.

Superseded (kept for the diff): Headline: shipped rules flag 59 % of THE LIST and 44 % of an operator-free null population; ≈1.5–2.3k honest wallets
are flagged while a ≈99 ETH peel-chain ring (15.6 % of all points) is 81 % unflagged. The v2 rule set measured here:
10,780 flagged, 70.2 % of points, ENS-named flagged 360→19, IDMD holders 35→2, ring 397/419, Bitget loop 232/232, 10.x ladder engine 176/176, all audited waves ≥99.4 %.
Rerun: `python3 tools/sybil/sk_v2.py --infra tools/sybil/infra_cex.json --only "baseline(shipped);v2f (v2e + fresh hub + cex fan-out)"` (inputs: `~/.maxpane/curator_cache.json` and sybilkit source at `/Library/Vibes/autopull/sybilkit/src`, both hard-coded at the top of `sk_diag.py`; add `--enrich-extra "data/sybil/enrichment/ring_enrich.json;data/sybil/enrichment/ladder_enrich.json"` for the ring/ladder recall numbers).
