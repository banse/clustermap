# Raw WhitelistCurator Version and Scoped List Filters - Design Document

**Mode**: Standard
**Date**: 2026-08-28
**Status**: Final

## Problem Statement

The app can compare two SybilKit outputs but cannot select the original
WhitelistCurator population as a first-class global state. THE LIST also treats
entry presets as escapes to the raw population, so a preset changes both the
population and the attribute constraint. Users cannot reliably answer the same
filtered question across raw, SybilKit 0.1.1, and SybilKit 0.2.0.

The feature is complete when the original 19,522-wallet snapshot is globally
selectable, every ordinary preset refines the selected version's list, the
first-1,000 slice exists only for the raw version, and the list title clearly
names RAW, RETAINED, or RETAINED + UNDER REVIEW.

## Understanding

### Facts

- `data/analysis_versions.json.gz` is the immutable source for every global
  version, map, wallet dossier, comparison, export, and history row.
- SybilKit 0.1.1 retains 7,949 clean wallets and has no review tier.
- SybilKit 0.2.0 retains 6,782 clean plus 324 under-review wallets.
- The raw snapshot contains 19,522 wallets, including 8 rows with a recorded
  ENS name in the frozen list data.
- Search and attribute sorting must never rewrite the selected-population rank.

### Constraints

- Preserve the KISS and frontend MVC boundaries.
- Runtime remains read-only, keyless, and offline; no RPC request is added.
- Existing analysis versions and their content hashes remain immutable.
- A preset is one attribute constraint, not an implicit population switch.

### Unknowns (Resolved)

- [x] Can raw be a frontend-only mode? No. It would not control maps, wallet
  history, stats, exports, or directional comparisons globally.
- [x] How should raw wallet states fit the existing schema? Store every wallet
  as `clean`, independent, and unclustered. The raw version has zero clusters
  and zero evidence edges.
- [x] How should list scope travel through the API? Add a `selected` link scope
  resolved by version metadata to `all` for raw and `retained` for analyses.

## Solutions Considered

### Option A: Frontend-only raw toggle

Keep two analysis versions and make THE LIST ignore the selected version when a
raw toggle is active.

**Pros**: Smallest artifact change.

**Cons**: Not global, creates two incompatible version concepts, and makes
exports/profile/map disagree with THE LIST.

### Option B: Immutable raw version with selected-list scope

Generate a third version from the same frozen snapshot, mark its list scope as
raw, and mark both SybilKit versions as retained. Resolve `link=selected` in the
repository before applying presets, search, sorting, and pagination.

**Pros**: One version model controls every surface; filters mean the same thing
everywhere; raw participates honestly in history and delta comparison.

**Cons**: The stored version and quality-stat artifacts grow, and raw maps have
no evidence clusters by definition.

## Tradeoffs Matrix

| Criterion | Frontend toggle | Stored raw version |
|---|---:|---:|
| Global consistency | Low | High |
| Runtime simplicity | Medium | High |
| Artifact size | High | Medium |
| Export/history integrity | Low | High |

## Recommendation

Choose Option B. `list_scope` is explicit version metadata. The list controller
always requests `link=selected`; presets never mutate that scope. The backend
applies the selected population first and then applies `hour0`, `whale`, or
`ens`. `first1000` is rendered only for the raw version and is reset when the
user switches from raw to an analysis version.

Title derivation remains factual:

- raw scope: `THE LIST (RAW)`;
- retained scope with no review wallets: `THE LIST (RETAINED)`;
- retained scope with review wallets: `THE LIST (RETAINED + UNDER REVIEW)`.

## Implementation Plan

1. Generate and validate the immutable raw version and its quality statistics.
2. Add selected-scope and ENS preset support to list/export APIs.
3. Keep presets inside the selected population and reset raw-only presets when
   the global version changes.
4. Render version-aware titles, base labels, explanatory copy, and options.
5. Pin raw, v1, and v2 counts and browser interactions with tests.

## Open Questions

- None for the frozen snapshot. A future ENS refresh would be a new immutable
  observation artifact, not a runtime lookup.
