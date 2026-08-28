# Filtered THE LIST Leaderboard - Design Document

**Type**: New Feature
**Date**: 2026-08-28
**Status**: Final

## Problem Statement

### User Problem

The product can explain individual wallets and evidence groups, but it also
needs a ranked, attribute-focused view of the source list and its useful entry
slices. The map and review surfaces naturally foreground SybilKit; THE LIST
leaderboard should foreground wallet attributes and keep analytical fields out.

### Success Metrics

- `THE LIST` is a primary, URL-pinned page.
- Its default `CLEAN LIST` is the retained output: wallets whose selected-version
  status is `clean` or `review`; only `flagged` wallets are excluded.
- Entry presets filter the globally selected list population.
- Group, flag, risk, and evidence fields do not appear in the leaderboard.
- The selected clean/preset population receives a contiguous rank from 1;
  search and attribute sorting never rewrite that rank.
- Search, entry presets, paging, export, and wallet-profile navigation work
  without rendering all clean wallets into the DOM at once.
- Every data-column header sorts the full filtered population in either
  direction before server pagination.

## Understanding

### User Requirements

- Add a separate page for THE LIST.
- Default to a clean-wallet leaderboard, not an analysis ledger.
- Allow entry presets to slice the selected list without showing analysis columns.
- Focus on wallet attributes, not groups or flags.
- Include the retained under-review wallets without exposing analysis columns.

### Technical Context

- `/api/v1/list?link=selected` resolves to `status=clean|review` for a SybilKit
  version and the full population for the immutable raw version.
- `useClusterMapController` owns list state, filters, paging, and export.
- Views do not fetch directly; page/profile navigation belongs to
  `useMapViewController`.
- The shared address component preserves explorer/copy actions. THE LIST uses
  an ETH-only amount formatter and places a recorded ENS name beside it.
- Frozen event rows provide exact deposit counts, amounts, and contract hours.
- The current API paginates on the server, so correct cross-page sorting must
  also happen in the repository rather than inside the React view.

### Constraints

- Preserve KISS and the frontend MVC boundary.
- Keep the application read-only, keyless, and secret-free.
- Keep the existing MaxPane visual language.
- Render a bounded page of rows for performance and accessibility.

## Solutions Considered

### Option A: Full analysis ledger with status filters

Show clean, review, and flagged wallets together, including groups and evidence.

**Pros**: One surface for every analytical state.

**Cons**: Duplicates the map/review surfaces and makes flags the focus of THE
LIST instead of showing the clean output.

### Option B: Selected-population attribute leaderboard

Default the list model to `link=selected`, refine that population with entry
presets, remove analytical columns, compute a gapless population rank, and show
source wallet and deposit attributes. The first-1,000 preset is raw-only.

**Pros**: Matches the page's purpose, has a clear denominator, remains simple,
and keeps Sybil analysis in the views built to explain it.

**Cons**: Comparing preset counts across versions requires changing the global
analysis selection, which is also the honest provenance boundary for the data.

### Sorting Option A: Sort the visible 50 rows in React

**Pros**: Minimal backend work and immediate interaction.

**Cons**: Produces a different partial ordering on every page, makes export
disagree with the screen, and cannot answer the actual leaderboard question.

### Sorting Option B: Sort the complete result in the repository

Assign clean/filter rank before search, then apply search and the requested
stable sort before slicing the page. Carry sort and direction through the
existing controller/API filter contract and export.

**Pros**: Rank remains canonical, every page belongs to one global ordering,
and export matches the selected view.

**Cons**: Each request sorts up to 19,522 in-memory rows, which is acceptable
for the frozen dataset but would need indexing for a much larger population.

## Recommendation

**Chosen**: Option B.

The leaderboard opens on the globally selected population: the full contract
list for the raw version, or clean wallets plus wallets retained under review
for a SybilKit version. Entry presets refine that same population. Original
contract order remains auditable, while the first column always numbers the
selected retained/preset population 1…N without gaps.

For sorting, choose server-side Option B. Rank is a property of membership in
the retained list or active entry preset; search is only a locator and sorting is
only a presentation order. Neither may mutate that identity.

## Visual Direction

- **Palette**: existing MaxPane canvas `#1c1c1c`, ledger `#0b0b0b`, ink
  `#00dd33`, and active signal `#00ff41` through theme tokens.
- **Type**: Saira Condensed for the page thesis, Atkinson Hyperlegible for
  explanation, and Fragment Mono for controls/data.
- **Layout**: retained-list thesis and active-version docket → search/preset rail →
  sticky-header attribute ledger → paging/export rail.
- **Signature**: a two-position rank ticket with a large `CLEAN` or `FILTER`
  rank and smaller original rank. It communicates transformation without
  showing group/flag information.
- **Sort interaction**: each compact header becomes a full-width button with a
  quiet bidirectional marker; only the active key uses the brighter ink and a
  directional arrow. The ledger remains the visual object, not a toolbar.

```text
┌ THE LIST / WALLET ATTRIBUTE LEDGER ─── ACTIVE RULE SET ┐
├ SEARCH ─────────── ENTRY PRESET ───────────── EXPORT ──┤
│ CLEAN / ORIGINAL │ WALLET + ENS │ POINTS │ DEPOSITS…  │
│ #1               │ 0x… name.eth │ 651    │ 3 / H7–8  │
│ ORIGINAL #11,004 │        │        │        │        │
└ 1–50 / 7,106 ───────────────────────── PREV / NEXT ───┘
```

The deliberate risk is the wide, instrument-like ledger. It fits a frozen
onchain registry and preserves every requested attribute instead of hiding data
in expandable cards. No gradients, charts, or unrelated animation are added.

## Implementation Plan

1. Compute a current-filter rank in original contract order.
2. Default the list controller and THE LIST navigation to the selected version
   population; keep first-1,000 available only on raw.
3. Aggregate frozen deposit range, gross amount, and hour window per wallet.
4. Build the attribute leaderboard as a pure view.
5. Assign canonical rank before search; add repository-level stable sorting and
   carry the sort contract through list/export requests.
6. Cover API invariants, sortable header actions, routing, and browser QA.

## Open Questions

- None for the frozen 19,522-wallet population. Revisit repository-side sorting
  only if the dataset becomes large enough to require a persistent index.
