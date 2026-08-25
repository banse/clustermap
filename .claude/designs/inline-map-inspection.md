# Inline map inspection

**Mode**: Standard
**Date**: 2026-08-23
**Status**: Implemented and verified

## Problem statement

Cluster and wallet evidence currently leaves the map context: a wallet first opens a floating preview and then a modal, while a selected group leaves unused space below its topology. The analyst needs evidence and entity details adjacent to the graph so the visual context remains stable.

## Understanding

### Facts

- A selected cluster already exposes reasons, evidence families, confidence, edge count, risk, and review metadata.
- The maximized wallet view already contains the complete required wallet facts, related evidence, group reasons, address links, and ETH/USD formatting.
- The cluster topology canvas has a natural inspection area below it on desktop.
- The Evidence Atlas must become the initial global view; the wallet field remains selectable.

### Constraints

- KISS and frontend MVC.
- No popup or modal state after the change.
- Addresses keep explorer/copy affordances; ETH values keep USD context or explicitly say that USD is unavailable.
- The full inspection content must remain usable on mobile and must not be clipped inside a modal scroller.

## Solutions considered

### Option A: Keep modal, add group summary below map

Pros: smallest code change.

Cons: two different detail locations remain, wallet inspection still obscures the graph, and the popup/maximize state stays unnecessarily complex.

### Option B: Put all details in the right sidebar

Pros: always visible beside the graph.

Cons: too narrow for evidence edges and addresses, displaces the stable legend, and becomes a long cramped column.

### Option C: One inline inspection rail below the map

Pros: one predictable detail location, full available width, preserves the graph and sidebar, removes popup/modal state, and naturally stacks on mobile.

Cons: increases page height when a large wallet evidence list is open.

## Recommendation

Use Option C. The inspection rail behaves like a diagnostic printout attached to the selected graph: group selection shows why the group exists; wallet selection replaces it with the complete wallet dossier; closing the wallet returns to the group explanation.

## State model

- Global default: Cluster Atlas, no inspection rail.
- Selected group, no wallet: group explanation rail.
- Selected wallet: complete wallet rail.
- Close wallet: return to group explanation when inside a group, otherwise remove the rail.
- Escape: close the selected wallet only.
- Global view switch or new group: clear the selected wallet.

## Implementation plan

1. Create inline group and wallet inspection views from existing domain data.
2. Mount the inspection rail below the canvas and remove popup/modal rendering.
3. Simplify the map controller by removing maximize state and make Clusters the default global view.
4. Update responsive styling, tests, documentation, and browser QA.

## Verification

- Cluster selection keeps the topology visible and renders its complete group rationale directly below the map.
- Wallet selection replaces that rationale with the full wallet dossier; closing the dossier restores the same group rationale.
- No quick-popup, maximize action, modal, or dialog remains in the interaction or component tree.
- The Evidence Atlas is selected on initial load and the Wallets view remains available through the global switch.
- 17 frontend tests pass; TypeScript and the Vite production build pass.
- Browser QA confirms desktop and 390 px mobile layouts, wallet close/return behavior, and the MaxPane presentation against the real local API.
