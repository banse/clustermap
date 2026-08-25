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
| …and on an operator-free synthetic population | **45.6%** — every wallet linked there is a false positive by construction |
| Complete enrichment changes the shipped output by | **zero wallets** — same 263 clusters, same 11,573 |
| Wallets funded by another wallet on the list | **66%** (78.4% of points); 7,511 sit >100 funding hops deep |
| Deposits sent at nonce 0 (wallet's first ever transaction) | **57.9%** |
| The ≈99 ETH peel-chain operator | 419 wallets, 15.6% of all points, **81 flagged** by the shipped rules |
| v2 prototype (v2h) | 12,416 flagged, 76.7% of points, ENS-named flagged **360 → 23**, ring **397/419**, serial relay **840/841**, null-model false linking **0.1%** |
| **Wallets with a verifiable independent history that the published list removes** | **84 of 308 (27.3%)** — under v2, **1 (≤0.3%)**, and that one is a farm member |

The zero in the third row is the load-bearing result. sybilkit's funding family is *folded onto* the
behavioural clusters — an edge exists only when funder and funded already share a tier-A component
(`vendor/sybilkit/src/sybilkit/signals/funding.py`). So a peel chain between wallets that no amount or
timing rule linked stays invisible no matter how completely it is resolved. Corroboration cannot find
what nothing proposed. The same rows move a rule set that lets funding structure *build* a component a
very long way: the 1.00–1.14 ETH serial relay goes from 450 of 841 wallets to 840 of 841.

## The measurement that matters

Rule sets can always be compared to each other. The question worth answering is what they do to *people*.
Controls were rebuilt against [`harness/CONTROL_STANDARD.md`](harness/CONTROL_STANDARD.md), **written
before it was applied**, using only facts about a wallet and no detector output: 50+ transactions sent
before this game existed, a first funder outside the population, an ENS name, a funder that funded nobody
else, funded nobody itself, and no sweep to a shared collector after settlement. Applied blind, that
yields **308 controls, none of them members of the independently audited farm waves**. Every wallet is
scored *inside* one run over the whole population — never in isolation, which is the flaw that makes the
shipped benchmark's precision 1.0 meaningless.

Every row below is scored on **identical complete data**, and the shipped rules are also run with the
same 612-funder exchange list v2 uses — which separates "v2 has better data" from "v2 has better rules".

| rule set · identical data | removed | of the 308 controls | shown for review | farms caught |
|---|---|---|---|---|
| shipped, its own 12 exchange addresses *(published)* | 11,573 | **84 (27.3%)** | — | 78.5% |
| shipped, given v2's 612-funder list | 11,076 | 71 (23.1%) | — | 75.4% |
| **v2h** | 12,416 | **1 (0.3%)** | 9 | **97.6%** |

Both error directions improve together. wmp.eth had sent 4,907 transactions before it joined; ilnico.eth
2,004; teamhodl.eth 1,491. All are removed by the list that is live.

Two things are stated that a favourable reading would omit. **v2 has a periphery tier** — shown as under
review, never removed — and 9 further controls land there, so the fraction v2 *touches* is 3.2%, not
0.3%; the shipped rules have no such tier, so everything they flag is removed. And **a better exchange
list alone**, changing no rule, clears 13 of the 84 — the other 70 need the rules. Roughly one part
missing data, five parts rules.

The shipped baseline used here is not an approximation: it reproduces the published cluster set
**wallet-for-wallet** (symmetric difference 0 against the live groups), and it returns the identical
result on partial and on complete enrichment, so neither side is given data the other lacks.

The standard has a demonstrated ceiling and was amended once, on the record — see its own file. It
identifies wallets carrying a costly independent history, not wallets certainly controlled by one human:
the audited 2.067 ETH wave is 324 wallets sharing one priority-fee value with none at nonce 0, and its
operator named one of them. So these rates are **ceilings, not point estimates**.

## Reproduce

```sh
cd audit/harness
export SYBIL_CACHE=../../data/curator_snapshot.json.gz

# the shipped rules, exactly as published  ->  263 clusters, 11,573 flagged, 57.6% of points
python3 sk_v2.py --only "baseline(shipped)"

# the v2 prototype on complete enrichment   ->  160 clusters, 12,416 flagged, 76.7% of points
python3 sk_v2.py --enrich-extra ../data/enrichment/full_enrich.json \
                 --infra ../data/infra_all.json \
                 --only "v2h (v2g + aged-weak periphery)"

# the honest-wallet measurement           ->  shipped 84/308, v2h 1/308
python3 bench_insitu.py
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
| `harness/CONTROL_STANDARD.md` | the pre-registered definition of a verifiably honest wallet, its C6 amendment, and its demonstrated ceiling |
| `harness/bench_insitu.py` | scores rule sets against those controls inside the full population |
| `harness/fetch_post_game.py` | the post-settlement behaviour the standard's last criterion needs |
| `data/controls_verified.json` | the 308 controls (and `controls_verified_pre_c6.json`, the pre-amendment set) |
| `data/bench_insitu.json` | the measurement, including every control the detector flags |
| `data/enrichment/full_enrich.json` | **the new dataset**: a first funder for all 19,522 contributors and a transaction fingerprint for all 28,353 deposits |
| `data/funder_profile.json` | all 14,624 distinct funders, classified |
| `data/full_census.json` | funding sources, peel-chain depth, components, freshness |
| `data/v2_diff.json` | exactly which wallets v2h releases and which it adds |
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

- **v2h is a prototype, not a patch.** It re-implements tier A outside `sybilkit` and reverses a
  documented architectural property of the library (funding as corroboration only). It has not been
  ported, reviewed, or released.
- **Every constant was calibrated on this population alone.** The block windows assume 12-second
  blocks; the near-minimum band is 1.25× *this* game's 0.05 ETH minimum; "≥6 decimals = machine"
  reflects *these* wallets' habits. Nothing here has been evaluated against a second dataset.
- **The null model's priors were rebuilt** after an earlier version could not referee the rule that
  matters: its synthetic funders were never other synthetic contributors, so the peel-chain family had
  zero probability of firing, and its fee pool was 27 values drawn uniformly where the real population
  puts 12.5% of its mass on one value. Both now come from measurement, the peel family does fire in the
  null, and v2 still links 0.1% of it.
- **Control rates are ceilings**, for the reason given above.
- **The null model is seeded and now deterministic**: its priors were being built by iterating a Python
  set, so hash randomisation moved the result between runs (45.6% and 46.1% for identical seeds). Fixed
  by sorting the prior inputs; two consecutive runs now agree exactly. Any earlier figure quoted from it
  carries that variance.
- **Neither the published clusters nor v2g's output is ground truth about any individual wallet.**
  Both contain false positives. Treat a cluster as a question, not a verdict.

Corrections and counter-evidence are welcome — the evidence files in `data/` exist so that anyone can
check a specific wallet rather than take a verdict on trust.
