# Audit — sybilkit reality check

An independent audit of the detector whose output this repository publishes, run on the settled
WhitelistCurator population (19,522 wallets / 28,353 deposits, Ethereum mainnet), together with the
complete on-chain enrichment the live pipeline never had.

Everything here is reproducible from a clone: the harness reads the pinned snapshot
(`../data/curator_snapshot.json.gz`, tagged `v0.1.0`) and the vendored `sybilkit` 0.1.1
(`../vendor/sybilkit`). No private inputs, no API key, no network access.

Report: [`report/sybilkit-reality-check.html`](report/sybilkit-reality-check.html) ·
published copy: <https://claude.ai/code/artifact/80a0b440-a5a8-467a-869d-0624f8686d75>

## What it found

| | |
|---|---|
| Shipped rules flag | **11,573 of 19,522** wallets (59.3%), 57.6% of all points |
| …and on an operator-free synthetic population | **45.8%** — every wallet linked there is a false positive by construction |
| Complete enrichment changes the shipped output by | **zero wallets** — same 263 clusters, same 11,573 |
| Wallets funded by another wallet on the list | **66%** (78.4% of points); 7,511 sit >100 funding hops deep |
| Deposits sent at nonce 0 (wallet's first ever transaction) | **57.9%** |
| The ≈99 ETH peel-chain operator | 419 wallets, 15.6% of all points, **81 flagged** by the shipped rules |
| v2g prototype | 12,431 flagged, 76.7% of points, ENS-named flagged **360 → 28**, ring **397/419**, serial relay **840/841**, null-model false linking **0.1%** |

The zero in the third row is the load-bearing result. sybilkit's funding family is *folded onto* the
behavioural clusters — an edge exists only when funder and funded already share a tier-A component
(`vendor/sybilkit/src/sybilkit/signals/funding.py`). So a peel chain between wallets that no amount or
timing rule linked stays invisible no matter how completely it is resolved. Corroboration cannot find
what nothing proposed. The same rows move a rule set that lets funding structure *build* a component a
very long way: the 1.00–1.14 ETH serial relay goes from 450 of 841 wallets to 840 of 841.

## Reproduce

```sh
cd audit/harness
export SYBIL_CACHE=../../data/curator_snapshot.json.gz

# the shipped rules, exactly as published  ->  263 clusters, 11,573 flagged, 57.6% of points
python3 sk_v2.py --only "baseline(shipped)"

# the v2g prototype on complete enrichment  ->  160 clusters, 12,431 flagged, 76.7% of points
python3 sk_v2.py --enrich-extra ../data/enrichment/full_enrich.json \
                 --infra ../data/infra_all.json \
                 --only "v2g (v2f, coverage-stable fan-out)"
```

Python 3 standard library only. Each run takes a few seconds. `run_full.sh` rebuilds every artefact
(funder classification → census → both detector runs → report); `null_model.py` takes ~15 minutes.

## Layout

| path | what it is |
|---|---|
| `harness/sk_diag.py` | reproduces the live run and instruments it — every edge labelled by rule, per-cluster anatomy, single-rule ablations |
| `harness/sk_v2.py` | the v2 prototype: tier A re-implemented with knobs, a `VARIANTS` table, and a metrics table (farm recall, ENS/IDMD/control collateral) |
| `harness/null_model.py` | operator-free synthetic population — the flag rate there *is* the false-linking base rate |
| `harness/fetch_all_enrich.py` | the full-population enrichment: first funder for every contributor, tx fingerprint for every deposit. Keyless, resumable |
| `harness/funder_profile.py` | classifies every funder by what the chain says it is (nonce + code) → exchange / service / contract / contributor / operator / personal |
| `harness/full_census.py` | what the population is made of once every funder is known |
| `harness/verify_enrich.py` | re-resolves samples against the paginated walk that produced the original rows |
| `harness/build_report.py` | renders the report from the logs and JSON here |
| `data/enrichment/full_enrich.json` | **the new dataset**: a first funder for all 19,522 contributors and a transaction fingerprint for all 28,353 deposits |
| `data/funder_profile.json` | all 14,624 distinct funders, classified |
| `data/full_census.json` | funding sources, peel-chain depth, components, freshness |
| `data/v2_diff.json` | exactly which wallets v2g releases and which it adds |
| `data/agents/` | the 34 investigation and skeptic files behind the report's findings |
| `data/runs/` | raw logs of every run quoted above |
| `data/ens_names.json`, `data/hour_saved.json` | the two inputs the snapshot does not carry |

## Provenance

The enrichment was fetched keyless in ~50 minutes: first funders from Blockscout's legacy
`txlist&sort=asc` (oldest-first answers "first funder" in one request, where a newest-first feed has to
be paged up to 80 times), with an internal-transactions fallback for disperse/multisend recipients;
transaction rows from batched `eth_getTransactionByHash` against public nodes. `verify_enrich.py`
checked it against the rows the original paginated walk produced: 60/60 on a uniform sample, 60/60 on
wallets that had already sent ≥100 transactions, 60/60 on transaction rows. 37 wallets have no incoming
transfer at all — recorded as a measurement, never as a gap.

## Limitations — please read before citing any of this

- **v2g is a prototype, not a patch.** It re-implements tier A outside `sybilkit` and reverses a
  documented architectural property of the library (funding as corroboration only). It has not been
  ported, reviewed, or released.
- **Every constant was calibrated on this population alone.** The block windows assume 12-second
  blocks; the near-minimum band is 1.25× *this* game's 0.05 ETH minimum; "≥6 decimals = machine"
  reflects *these* wallets' habits. Nothing here has been evaluated against a second dataset.
- **The null model cannot referee the rule that matters.** Its synthetic funders are never other
  synthetic contributors, so the peel-chain family — v2's dominant new evidence — has zero probability
  of firing there. The 0.1% figure covers the amount and timing rules; it is not evidence that the
  funding builder is safe.
- **The 60 "controls" are not verified-honest wallets**; they were sampled as non-audited, and several
  turn out to be jitter-batch or ring members. Benchmark precision of 1.0 is an artefact of scoring
  220 wallets in isolation.
- **Neither the published clusters nor v2g's output is ground truth about any individual wallet.**
  Both contain false positives. Treat a cluster as a question, not a verdict.

Corrections and counter-evidence are welcome — the evidence files in `data/` exist so that anyone can
check a specific wallet rather than take a verdict on trust.
