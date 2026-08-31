# Provenance — what you have to trust, and what you can check

This site says things about named Ethereum addresses. That is only defensible if a stranger can
reconstruct how it arrived at each claim and disagree with a specific one.

This document describes the chain **as it is today**, not as intended. Every hash and commit below is
live in the repository and can be checked with the commands in
[Check it yourself](#check-it-yourself). Where something is still taken on trust, it says so.

Last updated 2026-08-27, at clustermap `v0.4.1`.

---

## The chain at a glance

| layer | what pins it | checkable without trusting us? |
|---|---|---|
| the **population** — who was in the game | `data/curator_snapshot.json.gz`, frozen at block 25,807,057 | **not yet** — see [The population](#1-the-population) |
| the **detector** — which code judged them | git tags `sybilkit-v0.1.1`, `sybilkit-v0.2.0` in `banse/maxpane` | yes, resolvable tags |
| the **rules** — the exact file that ran | `rules_sha256` over `audit/harness/sk_v2.py` | yes, one `shasum` |
| the **analysis** — the resulting per-wallet status | `content_hash` per version, immutable | yes, recomputable |
| the **enrichment** — each wallet's first funder | `audit/data/enrichment/full_enrich.json` | yes, one lookup per row |
| the **site** — what was served, when | git tags `v0.1.0` … `v0.4.1` | yes |

Two analyses exist. Both are published, both stay selectable, and **neither is ever rewritten**:

| analysis | detector | groups | flagged | review |
|---|---|---|---|---|
| `2026-08-22-shipped` | sybilkit **0.1.1** | 263 | 11,573 | 0 |
| `2026-08-25-sybilkit-0.2.0` | sybilkit **0.2.0** | 160 | 12,416 | 324 |

---

## 1. The population

`data/curator_snapshot.json.gz` — 19,522 contributors and 28,353 deposits from
`0xcB0b0531e86A9aC36Fa865cA8e3dbccF047FDA91` on Ethereum mainnet, frozen at block **25,807,057**
(deployment was 25,769,870). The game settled; the population cannot change.

**This is the one input that is still ours rather than the chain's.** The file is honest and pinned by
the `v0.1.0` tag, but you are trusting that we transcribed the contract faithfully.

That is being removed rather than argued about. The contract emits every field the analysis consumes —
`Deposited(contributor, hour, amount, creditedDelta, weightAdded, newWeight, txCount, hourTotal,
earlyBps)`, plus `FirstDeposit`, `HourSaved` and `Settled` — across 37,187 blocks, so the population can
be rebuilt from any Ethereum node. `Settled.totalContributors` is a free self-check: a reconstruction
that does not total 19,522 is wrong before it clusters anything. Design:
[`audit/harness/ONCHAIN_LOADER.md`](audit/harness/ONCHAIN_LOADER.md).

## 2. The detector

sybilkit is a distribution inside [`banse/maxpane`](https://github.com/banse/maxpane), tagged with a
`sybilkit-` prefix to keep its version series separate from maxpane's own `v0.x`. Each analysis records
the release it **is**:

| analysis | `detector_tag` | `detector_commit` |
|---|---|---|
| `2026-08-22-shipped` | [`sybilkit-v0.1.1`](https://github.com/banse/maxpane/tree/sybilkit-v0.1.1) | `200004fbfd05c3c4…` |
| `2026-08-25-sybilkit-0.2.0` | [`sybilkit-v0.2.0`](https://github.com/banse/maxpane/tree/sybilkit-v0.2.0) | `d835b3f063b5eecb…` |

**These are frozen per version, not inherited from whatever is vendored today.** That distinction is
load-bearing: `detector_commit` used to be read from `vendor/sybilkit/UPSTREAM_COMMIT` at build time and
stamped on both versions, so re-vendoring the library would silently restamp the provenance of an
analysis published weeks earlier. A separate `vendored_commit` field records which copy recomputed the
artifact, which is a different fact and is labelled as one.

Three commits carry sybilkit 0.1.1 and all three are recorded somewhere: `61696545…` (the snapshot's
`sybilkit_revision`, what produced the original maxpane run), `200004fb…` (the `sybilkit-v0.1.1` tag,
recorded as `detector_commit`), and `712c4390…` (the vendored copy, recorded as `vendored_commit`).
Their `sybilkit/src/` trees are **byte-identical** — the differences are `KNOWN_LIMITATIONS.md`,
`README.md` and one test file. So the analysis is attributable to the tag without ambiguity, and the
check is a one-line `git diff` rather than a promise.

## 3. The rules

The v2 analysis was not produced by `sybilkit.cluster.detect`. It was produced by
`audit/harness/sk_v2.py`, and **that file is what is pinned** — by content, not by a tag:

```
rules_file    audit/harness/sk_v2.py
rules_sha256  457fac65506d3ce9693f35c154f2f1d635d3cef5673138e43c3d6332bf71b2b3
```

sybilkit 0.2.0 ships that exact file **byte-identical** as `sybilkit.rules_v2`. So the release is
correct only if the file it ships hashes to that digest — which you can verify with `shasum` alone, with
no git checkout and no trust in this repository.

Content-addressing is deliberately stronger than the tag here. A tag can be moved; a digest cannot. The
tag tells you *where* to look, the digest tells you *whether you found the right thing*.

**Both rule sets ship, and neither silently replaces the other.** `detect()` is unchanged in 0.2.0. The
v2 rules reverse a property `detect()` deliberately guarantees — that funding evidence *corroborates* a
group and never *builds* one — so they live beside the library's own rules rather than overwriting them,
and any result stays attributable to the rules that produced it.

## 4. The analysis

A *version* is an immutable, reproducible per-wallet status set over exactly three values
(`clean` < `review` < `flagged`), carrying its own provenance and the command that regenerates it.

Each version records a `content_hash` — sha256 over `{wallets, clusters, global_edges}`:

| analysis | `content_hash` |
|---|---|
| `2026-08-22-shipped` | `9c5a1ef4882e84328bfc13da235b4d7d08f7c9fa3eebd4cf8eaab92ecc4ac616` |
| `2026-08-25-sybilkit-0.2.0` | `486c7787fded341765b11c178916b237b46dc7c09e486931758c179af3bf2f9f` |

The hash covers the **content only** — not the metadata around it. That is what lets a version gain a
`detector_tag`, or be re-labelled `superseded`, without invalidating a digest someone already published,
while still failing loudly if a single wallet's status moves. Both values above are pinned by name in
`tests/test_repository.py`, so an accidental rewrite breaks the build rather than the record.

The rule this enforces: **a published version is never edited.** Corrections are made by adding a
version and moving the `published_version` pointer. Publishing 0.2.0 changed roughly 4,800 wallets'
status — deliberately, and visible in the delta view — but it did not alter one byte of what 0.1.1 said.

## 5. The enrichment

The rules need one fact the contract cannot supply: **each wallet's first funder.** That is a fact about
the wallet's own history, not about the game, so no amount of reading this contract produces it. It
ships as a file: `audit/data/enrichment/full_enrich.json` — a first funder for all 19,522 contributors
and a transaction fingerprint for all 28,353 deposits.

It matters more than its size suggests: it is what the tight peel chain runs on, and it takes the
≈99 ETH operator from 81 of 419 wallets detected to 397 of 419.

The trust surface does not vanish here; it **shrinks to something spot-checkable**. Every row is one
lookup against any block explorer, so disputing one wallet's funder costs one query rather than a
re-audit. Provenance of the file itself: fetched keyless in ~50 minutes from Blockscout's legacy
`txlist&sort=asc`, verified 60/60 on a uniform sample, 60/60 on wallets that had already sent ≥100
transactions, and 60/60 on transaction rows against the independent paginated walk. 37 wallets have no
incoming transfer at all — recorded as a measurement, never quietly filled in.

Each version also records the enrichment **it actually ran on**, because the two analyses did not share
one: 0.1.1 saw 12,203 transaction fingerprints and 12,498 funding rows; 0.2.0 saw 28,353 and 19,522.

## 6. The site

Git tags record what the site asserted, and from when. The commit that is tagged is the commit that is
deployed.

| tag | what it asserted |
|---|---|
| `v0.1.0` | the state served before any correction |
| `v0.2.0` | presentation corrections; clustering untouched |
| `v0.3.0` | version model, change log, delta view |
| `v0.4.0` | SybilKit 0.2.0 becomes the published analysis |
| `v0.4.1` | change-log detector links resolve to the sybilkit releases |

---

## Check it yourself

No API key, no network, no private inputs. Python 3 standard library only.

```sh
git clone https://github.com/banse/clustermap
cd clustermap
```

**The rules are the file that was pinned:**

```sh
shasum -a 256 audit/harness/sk_v2.py
# 457fac65506d3ce9693f35c154f2f1d635d3cef5673138e43c3d6332bf71b2b3
```

**The tagged sybilkit release ships that same file:**

```sh
git clone https://github.com/banse/maxpane
git -C maxpane show sybilkit-v0.2.0:sybilkit/src/sybilkit/rules_v2/sk_v2.py | shasum -a 256
# 457fac65506d3ce9693f35c154f2f1d635d3cef5673138e43c3d6332bf71b2b3
```

**The rules reproduce both analyses:**

```sh
cd audit/harness
export SYBIL_CACHE=../../data/curator_snapshot.json.gz

python3 sk_v2.py --only "baseline(shipped)"
# -> 263 clusters, 11,573 flagged, 57.6% of points

python3 sk_v2.py --enrich-extra ../data/enrichment/full_enrich.json \
                 --infra ../data/infra_all.json \
                 --only "v2h (v2g + aged-weak periphery)"
# -> 160 clusters, 12,416 flagged, 76.7% of points
```

**Reproduction covers cluster membership, not just totals.** A totals match is satisfied by any run that
happens to count the same; a membership match is not. The sorted membership of all 160 groups and the
sorted set of all 12,416 flagged wallets hash identically across machines and processes:

| | sha256 (first 32) |
|---|---|
| cluster membership | `bd986908e33bf6c1c4cda481dae0009f` |
| flagged set | `71e561a2d104bea9f0e36e742ec54ddc` |

The recipe is committed rather than described, so the digests are a check and not an assertion:

```sh
python3 audit/harness/verify_hashes.py               # check the published artifact
python3 audit/harness/verify_hashes.py --from-rules  # re-run the detector, then check
```

So you can reconstruct **which wallet sits in which group** and contest one verdict, rather than accept
an aggregate. That is the difference between a published number and a checkable claim.

**What the live site is serving right now:**

```sh
curl -s https://clustermap.vibingco.de/api/v1/versions | python3 -m json.tool
```

---

## What this does *not* establish

Provenance is not correctness. Everything above proves the analysis is *the one we say it is* — it says
nothing about whether the analysis is *right about a person*.

- **Neither rule set is ground truth about any individual wallet.** Both contain false positives. A
  group is a question, not a verdict.
- **Measured error rates are ceilings, not point estimates.** Against 308 wallets selected by a standard
  fixed before it was applied and scored inside the full population, 0.1.1 removes 84 (27.3%) and 0.2.0
  removes 1 (≤0.3%) — and that one is a member of an audited farm wave. v2 also has a review tier that
  0.1.1 lacks, and 9 further controls land there, so the fraction it *touches* is 3.2%, not 0.3%.
- **Every v2 constant was calibrated on this one population.** Block windows assume 12-second blocks; the
  near-minimum band is 1.25× *this* game's 0.05 ETH floor. It has not been evaluated against a second
  dataset. See [`audit/harness/`](audit/harness/) and sybilkit's `KNOWN_LIMITATIONS.md`.
- **A cluster's tier is not a wallet's verdict.** `risk` is what the wallet's own evidence supports;
  `cluster_risk` is the group's. They are kept distinct everywhere, and no edge is drawn stronger than
  the wallets it joins.
- **Two families are not always two observations.** The v2 tight peel-chain builder
  (`audit/harness/sk_v2.py:424-427`) books one transfer twice: a `funding` edge at strength 0.95 and,
  on the same pair, a `cadence` edge at 0.8 restating the same `≤ 30`-block comparison the funding
  reason already names. `funding` and `cadence` are therefore two *kinds* of evidence there, not two
  witnesses. Measured on the published run: 10,907 peel pairs; **803 flagged wallets hold both of their
  incident families from that single transfer**, and **746 would fall below the per-member two-family
  gate** if the peel booked `funding` alone. The same conjunctive pairing exists in the fresh-hub,
  exchange fan-out and jitter-band builders, though those pair two genuinely different measurements
  rather than restating one. 11,277 of the 12,416 flagged wallets (90.8 %) carry three or more families
  and do not depend on any pairing.
  The binding gate is also not the one the group copy describes: `min_families = 2` is inert on this run
  (`min_families = 1` reproduces it exactly). What binds is the per-member gate `member_gate = local2`
  plus `min_size = 5`.
  Removing the pairing is a rule change, so it cannot be applied to a published version — see *What
  would break the chain* below. The counterfactual is measured and available: booking `funding` alone
  moves 160 → 135 groups and 12,416 → 11,653 flagged (−763 wallets, −10.20 points of flagged share; 412
  to review, 351 to clean), and drops the ≈ 99 ETH ring from 397/419 to 145/419. No ENS-named wallet, no
  verified control and no IDMD holder moves in either direction.

If this analysis is wrong about a wallet, the evidence is published so the claim can be checked rather
than adjudicated privately — see the dispute route on any wallet profile.

## What would break the chain

Stated plainly, so the failure modes are not folklore:

1. **Editing `audit/harness/sk_v2.py`.** The digest stops matching the tagged release, and the analysis
   no longer names the code that produced it. A rule change is a new sybilkit release **and** a new
   analysis version — never an edit in place.
2. **Rewriting a published version.** Corrections are additive: add a version, move the pointer.
3. **Letting `detector_commit` follow whatever is vendored.** It is frozen per version for exactly this
   reason, and `vendored_commit` exists so the other fact still has somewhere honest to live.
4. **Hardcoding a repository URL in the change log.** One link labelled "Detector commit" pointed at a
   *clustermap* commit and survived a metadata rewiring; it was caught only by fetching the live site.
   Detector links are now built from the same constants the metadata is pinned with.

## What is changing next

The snapshot in §1 is the last input that is ours rather than the chain's. `sk_v2_onchain` — planned as
sybilkit 0.3.0 — rebuilds the population directly from the contract's event log, so the file becomes
redundant rather than trusted. It is a second front end producing the same dataset; **the rules file
needs no changes**, which is also what preserves the digest in §3.

The first funder in §5 can never come from the contract, for the reason given there. It stays a file —
but a file in which every row costs one lookup to check.
