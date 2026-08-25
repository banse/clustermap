# Global wallet map and three themes

**Mode**: Standard
**Date**: 2026-08-22
**Status**: Implemented and verified

> Follow-up: the popup/maximize interaction documented here was later replaced
> by the single inline inspection rail in `inline-map-inspection.md`. The three
> theme implementations remain in source, but the current release hides their
> switcher and forces MaxPane behind one reversible feature flag.

## Problem statement

The MaxPane terminal rebuild made the application visually specific, but it moved the actual relationship map behind a navigation mode and opened wallet details as a separate destination. The main job of this product is to explore wallet relationships. The map therefore needs to be the product surface again, while preserving MaxPane as one of three selectable visual themes.

## Understanding

### Facts

- The source population contains 19,522 wallets.
- SybilKit keeps 263 groups containing 11,573 wallets and projects 34,236 typed evidence edges.
- All linked wallets are covered by at least one projected evidence edge.
- Wallet clicks must open a lightweight, closable preview over the map.
- The existing full wallet detail experience remains available through a maximize action.
- Light, dark, and MaxPane themes must all be selectable.

### Constraints

- Read-only and keyless; no signer and no broadcasts.
- KISS and frontend MVC.
- A red tier must still be described as an analytical signal, never as proof of common ownership.
- 19,522 force-simulated nodes and 34,236 animated edges would be unnecessarily expensive, especially on mobile.
- Theme colors must reach the canvas renderer as well as semantic HTML.

### Unknowns resolved

- All 11,573 linked wallets can be connected with a real-evidence maximum spanning forest of 11,310 edges.
- The global layout can be deterministic: units are ordered by their highest wallet points, placed on a golden-angle ring field, and cluster members are locally packed around their unit anchor.
- Possible false positives can be marked without inventing a verdict by using review heuristics derived from evidence structure: behavioural-only evidence, confidence below 80%, or a broad group with below 90% confidence.

## Solutions considered

### Option A: Full global force simulation

Send every wallet and every evidence edge to the existing D3 force graph.

Pros: organic Bubblemaps-like motion and direct reuse of the cluster renderer.

Cons: long settling time, unstable layout, substantial CPU/battery cost, overlap changes between sessions, and poor mobile behaviour.

### Option B: Aggregate global groups, expand on demand

Keep the 263 group bubbles and only reveal member wallets after selecting a group.

Pros: cheapest and already close to the previous implementation.

Cons: does not satisfy the requirement for a global map containing all wallets, and independent wallets remain invisible.

### Option C: Deterministic global wallet field

Render all wallets on canvas without a running simulation. Place the highest-point units first, pack cluster members locally, show independent wallets as disconnected green nodes, and connect clusters with a strongest real-evidence spanning tree.

Pros: deterministic, complete, fast to reset, practical on mobile, and every displayed connection remains traceable to SybilKit evidence.

Cons: less organic motion than a force simulation and not every redundant evidence edge is visible globally. Full cluster maps still expose all projected edges.

## Tradeoffs matrix

| Criterion | Full force | Aggregate groups | Deterministic field |
|---|---:|---:|---:|
| All wallets visible | High | Low | High |
| Runtime cost | Low | High | High |
| Deterministic | Low | High | High |
| Evidence completeness | High | Medium | High in cluster map, sparse globally |
| Mobile viability | Low | High | High |

## Recommendation

Use the deterministic global wallet field and retain the full D3 force renderer for a selected cluster. This separates two jobs cleanly: global orientation needs stability and completeness, while local cluster inspection benefits from dynamic topology.

## Evidence tiers

- Green — independent: no kept SybilKit group and no displayed connection.
- Yellow — review: weaker or structurally uncertain evidence.
- Orange — elevated: confidence at least 80% with funding evidence or three evidence families.
- Red — strong signal: confidence at least 95%, measured funding evidence, and at least three evidence families.
- Dashed outline — possible false positive: behavioural-only evidence, confidence below 80%, or a group of at least 500 wallets with confidence below 90%.

These labels are review aids. None proves common control or ownership.

## Frontend MVC

- Models: theme identifiers, global API types, deterministic layout.
- Controllers: theme persistence, data fetching, map scope, popup/maximize state, Escape handling.
- Views: canvas maps, theme switcher, quick popup, full detail overlay, legend and group rail.

## Implementation plan

1. Add cluster assessment metadata and sparse global evidence tree to the backend read model.
2. Add `/api/v1/map/global` and typed frontend API support.
3. Restore Light, Dark, and MaxPane semantic token sets.
4. Replace visible MaxPane view navigation with the global clustermap workspace.
5. Add quick wallet popup, maximize overlay, close/return flow, cluster drill-down, and false-positive marks.
6. Verify counts, layout invariants, themes, popup behaviour, downloads, desktop/mobile rendering, and browser performance.

## Verification

- Backend: 13 repository/API tests pass; the global endpoint returns 19,522 nodes and 11,310 evidence links.
- Frontend: 13 component/model tests pass, including global ordering and popup/maximize/close behaviour.
- Static checks: Ruff and TypeScript pass.
- Production: Vite production build succeeds.
- Browser QA: Light, Dark, and MaxPane render correctly at desktop size; the global node popup, maximized details, close/return flow, cluster drill-down, member popup, review note, dashed false-positive rings, and mobile layout were exercised against the real local API.
