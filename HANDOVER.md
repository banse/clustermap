# CLUSTERMAP — handover and functional spec

Written 2026-08-25. **Where the project stands** (read first), then **three features to build**: a change
log, switching between rule-set versions, and a delta view. Functional only — layout, visual design and
component structure are decided inside the clustermap project.

**This document is the specification, not part of the work.** It is committed at the repository root and
is already shipped; nothing about it needs to move. What it specifies is unbuilt.

| | status |
|---|---|
| Everything in Part 1 (the corrections, the audit, the dispute route) | **shipped and live** at `v0.2.0` |
| Feature A — the version model | **built** (`f573232`) |
| Feature B — switching between versions | **built** |
| Feature C — the delta view | **built** |
| All three | tagged `v0.3.0`, **not deployed** — see below |

*(Historical, kept because the reasoning still applies to anything built on top of a version:)*
**Feature A came first, and the change log and delta were resisted until it existed** — they are
the visible ones, so they are the tempting ones. All three are one feature underneath: once a *version*
is a first-class object carrying a status for every wallet, the change log is its history, the switch
renders one of them, and the delta compares two. Start anywhere else and you will end up with three
incompatible notions of what a wallet's status *is*, and find that out late, after each has been wired
into a view.

---

# Part 1 — Where the project stands

## What this repository publishes, and why that is delicate

CLUSTERMAP renders SybilKit's clustering of a settled Ethereum whitelist game (`WhitelistCurator`,
`0xcB0b0531e86A9aC36Fa865cA8e3dbccF047FDA91`, 19,522 wallets, 28,353 deposits, deployment block
25,769,870, last deposit block 25,789,576, snapshot block 25,807,057). The points are final and
immutable — nothing anyone does now can change them.

It is a public page that associates **named Ethereum addresses** with sybil groups. That is the whole
reason the rest of this document is careful: a wallet shown as linked is a claim about a person, made in
public, under a resolvable identity. Treat every rendering decision as a claim, not a visualisation
choice.

## Current state

| | |
|---|---|
| tag `v0.1.0` | archive of the state the site served before any correction. Recomputes the published 263 clusters / 11,573 flagged **exactly** — verified wallet-for-wallet |
| tag `v0.2.0` (`236ac57`) | **deployed and live.** The presentation corrections: per-member evidence gate, group-scoped tier wording, edges capped at their weaker endpoint, export provenance + caveats, the dispute route. Clustering untouched |
| tag `v0.3.0` (`cd01549`) | versioned analysis, change log, delta view. **NOT deployed** |
| `main` | past the `v0.3.0` tag: the provenance fix, the changelog UI, and the v2h publication below |
| `main` also carries | `audit/` — harness, report, evidence and the complete enrichment — reproducing every published number from a clone |

**The live site runs `236ac57`.** Quickest way to tell the builds apart: `/api/v1/health` reports
`analysis: "ready"` on the deployed build and `analysis: "versioned", versions: 2` on the current one.

### Next action

Deploy and tag. This release **does** change what the site asserts about wallets: `published_version`
moved to `2026-08-25-sybilkit-0.2.0`, so the default view is now SybilKit 0.2.0 (160 groups, 12,416
flagged, 324 under review) instead of SybilKit 0.1.1's (263 / 11,573). That is decision 4 being
exercised, on the record — see the amendment in the decisions section.

**Closed 2026-08-27.** `sybilkit-v0.2.0` is tagged and pushed at `d835b3f`; the analysis records
`detector: "sybilkit"`, `detector_version: "0.2.0"`, `detector_tag: "sybilkit-v0.2.0"`,
`detector_commit: d835b3f0…`. What binds the analysis to that release is not the tag but
`rules_sha256` (`457fac65506d3ce9693f35c154f2f1d635d3cef5673138e43c3d6332bf71b2b3` over
`audit/harness/sk_v2.py`) — content-addressed, checkable with `shasum` and no checkout. The file **at
the tag** was verified to hash to exactly that, and stamping the commit left both content hashes
unchanged, so naming the release moved no wallet.

sybilkit 0.2.0 ships that script byte-identical as `sybilkit.rules_v2`; `detect()` is unchanged, so both
rule sets ship and a result stays attributable. **Editing `sk_v2.py` breaks the pin** — a rule change is
a new sybilkit release *and* a new analysis version, never an edit in place.

**What did not change: any earlier version.** Both `content_hash` values are byte-identical across the
promotion (`9c5a1ef4…`, `486c7787…`) and are now pinned by value in
`tests/test_repository.py::test_publishing_v2h_moved_the_pointer_and_rewrote_no_version`. `v0.1.0`
stays selectable, re-labelled `superseded`, with its clustering untouched.

**Non-issue, corrected:** an earlier note here claimed `/api/v1/versions` returns `published: None`.
It does not. The top-level payload carries `published_version`; `published` is a per-version boolean and
is correct. The earlier reading looked for `published` at the top level, where it was never meant to be.

### Provenance — closed 2026-08-27 (`911b05d`)

`vendor/sybilkit` is re-vendored at `712c439`, so the copy this site runs carries the library's own
`KNOWN_LIMITATIONS.md` and its fold/coverage invariant tests. Every analysis version records
`detector_commit`; the v2h analysis additionally records `rules_file` and `rules_sha256` (`457fac65…`),
because its detector is the audit harness rather than the library — pinned **by content**, so a reader
holding `sk_v2.py` can verify it with `sha256sum` and no git checkout. Nothing moved: both content
hashes, the membership hash, the flagged set and the 2,082 / 2,925 delta are unchanged. `content_hash`
covers `{wallets, clusters, global_edges}` only, so metadata can gain fields later without invalidating
anything already published.

### After the deploy

`audit/harness/ONCHAIN_LOADER.md` — rebuild the population directly from the contract's event log, which
removes the snapshot file from the trust surface. Feasibility is verified and the acceptance test is a
hash comparison, not a judgement.

Verified live after deploy: the wallet the audit opened with (`0x3195c3f9…`) returns
`member_families: ['amount']` and `member_risk: review` against a cluster still at `critical` 0.9706, and
the old verdict string is absent from the served bundle. A tag here means "this is what the site
asserted, from this date" — so deploy the commit you tag, and tag the commit you deployed.

## What the audit found (the reason the corrections exist)

Full evidence in [`audit/`](audit/README.md), reproducible from a clone. Headlines:

- The published rules remove **84 of 308 wallets (27.3%)** that carry a verifiable independent history,
  measured against a standard fixed before it was applied. Under the v2 rules that is **1 (0.3%)**,
  plus 9 shown for review.
- They flag **45.6%** of a synthetic population containing no operators at all.
- They miss an operator of 419 wallets holding 15.6% of all points (81 flagged).
- Complete enrichment changes their output by **zero wallets** — the funding family only corroborates
  clusters the behavioural rules already built.

## Invariants — do not regress these

1. **A cluster's tier is not a wallet's verdict.** A member held by fewer than two evidence families
   renders as *review*, never at its group's tier. `repository.py` computes `member_families` and
   `_member_risk`; `risk` is the wallet's own tier and `cluster_risk` is the group's. Keep both.
2. **Tier wording is group-scoped**, and lives only in `riskLabel()` / `walletGroupLabel()`
   (`dashboard/src/models/presentation.ts`). No view invents its own string.
3. **The export carries its own provenance and known defects.** It gets forked and cited long after its
   context is gone.
4. **A published version is immutable.** Correct by adding a version, never by rewriting one.

## Gotchas that have already cost time

- `sk_v2.py --infra` applies to **every** variant in `--only`, including `baseline(shipped)` — which
  silently turns the baseline into a hybrid (233 clusters instead of 263). Always run the shipped
  baseline in its own invocation without it.
- The released-wallet diff rows carry no `nonce` field; counting aged wallets from them returns 0.
- `null_model.py` was non-deterministic because priors were built by iterating a `set`. Sorted now —
  keep prior inputs sorted or seeds mean nothing.

## How the proof works — do not weaken this

The project's claim is not "our numbers are right", it is "check them". That rests on four inputs
shipped in this repository, and on what each of them costs a stranger to verify:

| input | verifiable how |
|---|---|
| the detector | vendored by commit under `vendor/sybilkit` |
| the rules | `audit/harness/sk_v2.py`, readable, stdlib only |
| the enrichment | `audit/data/enrichment/full_enrich.json` — one lookup per row |
| the population | `data/curator_snapshot.json.gz` — **currently ours**; see below |

Reproduction covers **cluster membership, not totals**. From a clean clone the sorted membership of
all v2 clusters hashes to `bd986908e33bf6c1c4cda481dae0009f` and the flagged set to
`71e561a2d104bea9f0e36e742ec54ddc`, identically across machines and processes. Anything that makes
those hashes unstable — unsorted iteration over a set, a timestamp in an artefact, a dict ordering
dependency — breaks the proof without breaking a single test. Guard it: the null model already had
exactly this bug and produced different answers for identical seeds.

**Planned, and the last file to remove from the trust surface:** rebuilding the population directly
from the contract's event log. `Deposited`, `FirstDeposit`, `HourSaved` and `Settled` carry every
field the analysis consumes over 37,187 blocks, and `Settled.totalContributors` gives a free
self-check. Spec: `tools/sybil/ONCHAIN_LOADER.md` in the aidude workspace. The first funder per
wallet can never come from the contract — it is a fact about the wallet, not the game — so it stays a
file whose rows are individually checkable.

## Running it

```sh
make install && make build && make run     # http://127.0.0.1:8766
make test                                  # pytest, ruff, vitest, tsc, production build — all must pass
cd audit/harness && SYBIL_CACHE=../../data/curator_snapshot.json.gz python3 bench_insitu.py
```

Deploy is a separate rsync to the VPS (`deploy.conf`); pushing to GitHub does **not** deploy. Tag the
commit you actually deploy — a tag here means "this is what the site asserted, from this date".

---

# Part 2 — Feature A: the change log

## Purpose

One timeline covering the whole life of the list, from contract deployment to the current standing,
answering two different questions that are easy to conflate:

- **what happened on-chain** — immutable, derivable from the snapshot, identical for everyone;
- **what this site asserted about it, and when** — mutable, versioned, and the thing an appeal or a
  dispute is actually about.

Both belong on one timeline because the second only makes sense against the first.

## Entry model

Every entry has: `id`, `kind`, `at` (ISO timestamp), `block` (nullable), `title`, `summary`, and
`links[]` (commit, tag, release, artifact, external URL).

| `kind` | source | examples |
|---|---|---|
| `chain` | derived from `data/curator_snapshot.json.gz` — never hand-written | contract deployed (25,769,870); first deposit; each hour the game was extended; the largest deposit waves; settlement (25,789,576); snapshot taken (25,807,057) |
| `analysis` | one detector run that produced a version (see below) | the published clustering; the v2 rule set |
| `publication` | a change to what the site asserts | evidence-tier language replacing verdict language; the per-member gate; export provenance |
| `context` | hand-written, dated | the operator announcement at hour 32.7 that triggered the hour 34–35 rally; the audit; anything said publicly about the list |

`chain` entries are generated, not authored: a build step reads the snapshot and emits them, so they
cannot drift from the data. `analysis` and `publication` entries are authored but must reference a
commit or tag.

## Versions

An `analysis` entry points at a **version**, which is the unit the delta view diffs.

A version records:

- `id` (stable, sortable, e.g. `2026-08-22-shipped`, `2026-08-25-sybilkit-0.2.0`), `label`, `at`
- provenance: detector name + version, rule-set identifier, snapshot block, commit/tag, and **the exact
  command that reproduces it**
- a **status for every one of the 19,522 contributors**, from a closed vocabulary of exactly three:

| status | meaning |
|---|---|
| `clean` | not linked into any kept group |
| `review` | linked, but its own evidence is too thin to convict (fewer than two incident families) |
| `flagged` | linked, and its own evidence supports it |

Three values, not four — the delta is only well defined over a closed, ordered vocabulary
(`clean` < `review` < `flagged`). The existing four-tier risk scale (`independent`/`review`/`elevated`/
`critical`) maps onto it: `independent` → `clean`; a member below the family gate → `review`; otherwise
→ `flagged`. Record the finer tier alongside if useful, but the delta uses the three.

Each version also stores, per wallet: its `cluster_id` in that version and the evidence families
incident on it. The delta view needs this to explain *why* a status changed; without it a status change
is an unexplained accusation or an unexplained pardon.

**Versions are immutable and append-only.** Re-running the same rules on the same inputs must reproduce
a version byte-for-byte; if the output differs, that is a new version and the changelog says what
changed. Two versions exist today and seed the timeline: the state under tag `v0.1.0`, and the current
v2 rule set from `audit/`.

## Requirements

1. The timeline is readable without a wallet: it is the project's public record.
2. Filterable by `kind`, and by time range.
3. Every `analysis` entry states its effect in wallet counts — how many wallets moved between which
   statuses versus the preceding version — and links straight into the delta view for that pair.
4. Every `publication` entry states plainly what changed about the site's claims, including changes that
   moved no wallet (wording, caveats).
5. An entry may be corrected only by appending a dated correction that references it. Never edit history.
6. `chain` entries must regenerate identically from the snapshot on every build.

## API

- `GET /api/v1/changelog` → entries, newest first, `kind` and time-range filters
- `GET /api/v1/versions` → all versions with metadata and status counts
- `GET /api/v1/versions/{id}` → one version's metadata, counts, provenance and reproduce command

---

# Part 3 — Feature B: switching between versions

## Purpose

Both maps render **one selected version**. The rule set is no longer a property of the deployment — it
is a property of the view. A reader can look at the published clustering (v1) and the corrected one (v2)
and see two different pictures of the same 19,522 wallets, rather than being told about the difference.

## Requirements

1. A version selector applies to the global wallet map, the cluster atlas, the cluster drill-down and
   the wallet profile. Everything downstream of a version reads that version: statuses, cluster
   membership, cluster reasons, evidence tiers, counts.
2. Cluster membership genuinely differs between versions (263 groups against 160), so switching version
   is **not a recolouring** — it re-clusters. The atlas, the drill-down and every count change with it.
   Cluster ids are only meaningful within a version and must always be shown qualified by it.
3. The selected version is part of the URL. A link to a wallet or a cluster must pin the version it
   shows. This page makes public claims about named addresses; a citation that silently changes meaning
   when the rules change is worse than no citation.
4. The version currently shown must be visible on screen at all times, not buried in a control. A reader
   who arrives on a deep link should never have to work out which analysis they are looking at.
5. The default version is the published one — whatever the deployment currently asserts. A prototype
   rule set must never be the default merely because it is better; that is a publication decision, made
   deliberately and recorded in the change log.
6. The list export names the version it reflects, alongside the provenance block it already carries.

## API

- every read endpoint that returns a status, a cluster or a count accepts an optional `version` (default:
  the published version) and echoes the version it answered with in its payload.

---

# Part 4 — Feature C: the delta view

## Purpose

A mode on **both** maps — the global wallet map and the cluster atlas — that shows what changed between
two versions, so a change to the rules is visible as its effect on wallets rather than as a number in a
release note.

## Selection

- The view takes `base` and `head` version ids. Default: the previous published version as `base`, the
  current as `head`.
- Any two versions may be compared, in either direction. The UI must state which is which — the whole
  point is a directional claim.

## Per-wallet delta classes

Given `base_status` and `head_status` over the ordered vocabulary `clean < review < flagged`:

| class | rule | colour |
|---|---|---|
| `under_review` | `head_status == review` **and** status changed | **yellow** |
| `improved` | changed, and `head_status` is better than `base_status` | **green** |
| `worsened` | changed, and `head_status` is worse than `base_status` | **red** |
| `unchanged` | `head_status == base_status` | neutral / de-emphasised |

`under_review` takes precedence: a wallet arriving at *review* is neither a clean pardon nor a
conviction, and must not be coloured as either. A wallet whose status is unchanged is never coloured,
including one that was already `review` in both versions.

## Global wallet map

- Every wallet node takes its delta class. Delta mode renders on **`head`'s layout**: it answers "here is
  the current picture, coloured by what changed to produce it". Toggling delta on and off at a fixed
  `head` must not move a single node — status never feeds layout. Switching `head` may relayout, because
  a different version is a different clustering.
- Counts for all four classes are shown, and each is a filter.
- Selecting a wallet shows: its status in both versions, its cluster in both, the evidence families
  incident on it in both, and the changelog entry for `head`.

## Cluster atlas

Cluster ids are **not stable across versions** (263 groups in one version, 160 in another), so the atlas
delta must not join on cluster id.

- Each `head` cluster is coloured by the delta mix of its members, and exposes the counts of members
  improved / worsened / under review / unchanged.
- Clusters that exist in `base` but have no counterpart in `head` (dissolved) and clusters new in `head`
  must both be representable — a dissolved cluster is the most consequential kind of change and must not
  simply disappear from the view.
- Optional, if it proves useful: join clusters across versions by membership overlap so a cluster can be
  followed through versions. Not required.

## Explaining a change

Every delta must be explicable at wallet level. For a selected wallet the view must be able to state
which evidence families held it in `base` and which hold it in `head`. A status change with no available
explanation is a defect, not a display state.

## API

- `GET /api/v1/delta?base={id}&head={id}` → summary counts per class, plus a per-wallet class aligned to
  the map's node ordering
- `GET /api/v1/delta/wallets?base=&head=&class=` → the wallet list for one class, paginated
- `GET /api/v1/wallets/{address}` gains `history[]`: status, cluster and incident families per version

## Acceptance criteria

1. Comparing a version with itself yields 100% `unchanged` and no colour.
2. `improved + worsened + under_review + unchanged` equals 19,522 for any pair.
3. Delta classes computed in the frontend match the API's summary counts exactly.
4. Comparing `v0.1.0` with the current v2 version reproduces the audited figures: **2,082 wallets
   released** (flagged → clean or review) and **2,925 newly flagged**, with the periphery appearing as
   `under_review` rather than as either colour.
5. Node positions are identical between normal and delta mode for the same `head` version.
6. A deep link to a wallet or cluster resolves to the same content later, because it pins its version.
7. Switching version re-clusters: the atlas, drill-down and all counts change, and no cluster id is ever
   shown without its version.
8. Every version referenced by the timeline is reproducible from its recorded command, and re-running it
   produces an identical status set.
9. `make test` passes, including the three existing tests that pin the per-member gate and the export
   contract.

---

# Part 5 — Decisions taken 2026-08-25

All four were open when this document was drafted. They are settled; the reasoning is kept so a later
reader can tell what was decided from what was merely done.

**1. Deploy and tag now, as `v0.2.0`, scoped to presentation.** The corrections do not touch clustering:
still 263 clusters and 11,573 wallets linked under SybilKit 0.1.1's rules, with 1,107 of them re-tiered
to *review* by their own evidence and the labels no longer reading as verdicts. Release notes must say
so — if they imply the detector changed, the next person to diff it will think something was hidden.
Deploying ahead of the version model is safe because every version is reproducible, so the change log
and delta can be back-filled at full fidelity.

**2. Edges are capped at their weaker endpoint.** Implemented: `_weakest()` in `repository.py` takes the
minimum of the cluster's tier and both endpoints' tiers, and an edge now carries `cluster_risk` alongside
`risk` so the two are never conflated. 1,178 of 11,310 spanning edges (10.4%) now draw below their
cluster's tier, and none exceeds either endpoint — pinned by
`test_no_edge_is_drawn_stronger_than_the_wallets_it_joins`. This visibly thins the red web; it thins it
to what the per-member evidence supports.

**3. A minimal dispute route ships now**, rather than waiting for versioning. The read model carries a
`dispute` block (text, audit URL, contest URL), the wallet profile renders it where someone looks up
their own address, and `.github/ISSUE_TEMPLATE/dispute.md` gives the filing shape. Nothing is
adjudicated privately: the evidence is published and recomputable, so a claim can be checked by anyone
including the person filing it. **What this deliberately does not yet have** is the thing that makes an
appeal binding — a public, dated overrides file recording every accepted contest and its reasoning, and
a version for a contest to reference. Both arrive with Feature A; until then a dispute references a
release tag. A signed message from the address remains the only proof of holdership, and the template
says so without requiring it.

**4. v2 ships as a selectable version first; the default flips later, in its own tagged release.** It is
better on both error directions (honest wallets removed 27.3% → 0.3%, farms caught 78.5% → 97.6%, false
linking 45.6% → 0.1%), but adopting it removes 2,925 more wallets on the strength of one audit by one
party, so people get a window to inspect it against the delta before that happens. Note what this
avoids: because a version is a stored, reproducible status set generated offline by the harness, **the
site never has to run v2 live** — publishing it does not require porting a prototype into the vendored
library, which is the deeper change (it would touch `detect()`'s union loop, not just the funding
family).

> **Amended 2026-08-27 — the flip happened.** `published_version` is now `2026-08-25-sybilkit-0.2.0`, so 0.2.0 is
> the default view and SybilKit 0.1.1 is `superseded` but still selectable. The window this decision
> asked for was the interval in which v2h shipped selectable alongside the delta view; the audit it
> rests on is public and reproducible from a clone, down to cluster membership. What the decision was
> protecting against is unchanged and still true: this is one audit by one party, v2h is a prototype
> re-implementation living in `audit/harness/sk_v2.py` rather than in the library, and 2,925 wallets are
> removed that 0.1.1 did not remove. Both versions stay comparable at any URL, which is the mitigation
> that actually matters. The next rule set arrives as another version, never as an edit to this one.

## Still genuinely open

- Whether the overrides file is public from the first accepted dispute, or only once there is a version
  model to anchor it to.
- What happens to a contested wallet in the meantime: the current answer is that nothing changes until a
  new version is published, because versions are immutable.
