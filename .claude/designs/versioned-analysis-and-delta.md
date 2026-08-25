# Versioned analysis, changelog, and delta - Design Document

**Mode**: Standard
**Date**: 2026-08-25
**Status**: Final

## Problem Statement

CLUSTERMAP currently exposes one live analysis as though it were timeless. A
reader cannot tell which rule set a wallet or cluster came from, inspect the
site's assertion history, or see why a wallet changed between the shipped
SybilKit result and the audited v2h candidate. Because the page names public
wallets, an unversioned deep link or unexplained status change is an integrity
failure rather than a missing convenience.

The solution is complete when one immutable version object supplies every
status, cluster, edge, count, export, deep link, changelog entry, and delta.

## Understanding

### Facts

- The population and snapshot are final: 19,522 wallets and 28,353 deposits.
- The shipped result has 263 groups and 11,573 linked wallets.
- The v2h candidate has 160 groups, 12,416 flagged wallets, and 324 review
  members.
- Comparing the shipped core with v2h releases 2,082 wallets and newly flags
  2,925.
- v2h is a prototype harness and must not run inside the web process.
- Cluster ids have meaning only inside one version.
- The selected version must be present in URLs and visible on every page.

### Context

- The backend is an in-memory FastAPI read model.
- The frontend keeps models/API presentation, state controllers, and React
  views separate.
- Existing map layouts depend on points and cluster membership, not risk
  colour, so delta colouring can preserve node positions.
- The audit harness already returns normalized clusters, core/periphery sets,
  and evidence edges for v2h.

### Constraints

- KISS and the existing frontend MVC boundary.
- Read-only, keyless, no signer or broadcast path.
- Published versions are immutable and append-only.
- Exports retain provenance and caveats.
- A cluster tier never becomes an individual-wallet verdict.
- Existing v0.2 presentation safeguards remain in the shipped-version view.

### Unknowns (Resolved)

- [x] Can the existing `v2_diff.json` render v2 clusters? No; it contains set
  differences but not full topology. A build step must normalize `sk_v2.run()`.
- [x] Should v2 run at API startup? No; the handover explicitly requires an
  offline stored result.
- [x] Can delta mode reuse the normal layout? Yes; colour/filter state is
  applied after layout and never feeds node positioning.
- [x] How are dissolved clusters represented? The delta API returns them as
  explicit base-version cluster records alongside head-cluster mixes.

### Unknowns (Open)

- Accepted dispute overrides remain outside this feature until there is an
  accepted dispute to record.

## Solutions Considered

### Option A: Recompute both detectors at runtime

**Approach**: Keep the existing shipped detector call and import the audit
harness into the server for v2h requests.

**Pros**:

- Minimal stored data.
- Detector code is the apparent source of truth.

**Cons**:

- Makes a prototype audit harness production-critical.
- Startup and request behaviour depend on algorithm execution.
- A dependency or iteration-order change can silently rewrite a published
  version.
- Violates the handover's explicit offline-publication decision.

**Sacrifices**: Immutability, predictable startup, and a clear publication act.

### Option B: Deterministic stored analysis artifacts

**Approach**: A build script runs the shipped detector and v2h offline,
normalizes ordering, stores complete version states in a deterministic gzip
artifact, and records exact reproduce commands. The server only validates and
loads that artifact.

**Pros**:

- Published results are append-only data, not mutable runtime behaviour.
- One normalized contract drives every endpoint and view.
- Fast, deterministic startup.
- The artifact can be hashed and reproduced byte-for-byte.
- Adding another version is data work, not another conditional through the UI.

**Cons**:

- Stores topology that can also be derived from source inputs.
- Requires a generator and schema validation.

**Sacrifices**: A small amount of repository size and build simplicity.

## Tradeoffs Matrix

| Criterion | Runtime recompute | Stored artifacts |
|---|---:|---:|
| Simplicity in production | Low | High |
| Reproducibility | Medium | High |
| Immutability | Low | High |
| Startup cost | High | Low |
| Adding a version | Medium | High |
| Repository size | High | Medium |

## Recommendation

Use deterministic stored artifacts.

The server loads `data/analysis_versions.json.gz` into a `VersionStore`. Each
version contains metadata, status counts, one state for every wallet, full
cluster summaries/topologies, and sparse global-map edges. The shipped version
preserves the current per-member display risk while its analysis status remains
the shipped rule set's linked set. The v2h version uses `core = flagged`,
`periphery = review`, and all other wallets as clean.

Changelog entries share the same artifact. Chain entries are generated from
the pinned snapshot; analysis/publication/context entries are authored with a
commit/tag link. Delta is a pure comparison of two stored wallet-state maps.

## Data Contract

`analysis_versions.json.gz` has:

- `schema_version`, `published_version`, `generated_at`, `snapshot_block`;
- `versions[]`, each with immutable metadata, counts, wallet states, cluster
  records, and global spanning edges;
- `changelog[]`, newest-first at the API boundary.

Wallet status is exactly `clean | review | flagged`. Display risk remains the
finer `independent | review | elevated | critical` scale. Keeping both prevents
the delta vocabulary from leaking into evidence-strength wording.

Delta classification is pure and ordered:

1. same status -> `unchanged`;
2. changed and head is review -> `under_review`;
3. head rank lower -> `improved`;
4. otherwise -> `worsened`.

## Implementation Plan

1. Add the deterministic artifact generator and version schema/store.
2. Generate and validate shipped plus v2h artifacts.
3. Refactor the repository to dispatch every read operation by version.
4. Add versions, changelog, delta, and delta-wallet API routes.
5. Extend frontend types/API/controller state with selected version and delta.
6. Pin version/page/view/cluster/wallet/base/head in the URL.
7. Add an always-visible version control, changelog page, delta controls, map
   colouring/filtering, dissolved-cluster summary, and wallet history.
8. Pin invariants with backend/frontend tests and browser flows.
9. Update project memory after verification.

## Open Questions

- No open choice blocks implementation. The published default remains the
  shipped rule set; v2h is selectable but does not become default in this work.
