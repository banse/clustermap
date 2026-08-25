# Focus wallet profile

**Mode**: Standard
**Date**: 2026-08-23
**Status**: Implemented and verified

## Problem statement

People can inspect any wallet they happen to find in a graph, but they cannot keep one wallet as a stable point of reference. They need to type an address without connecting or signing, see whether it belongs to the frozen THE LIST snapshot and how SybilKit classifies it, and retain that visual reference while moving between graphs.

## Understanding

### Facts

- The existing wallet endpoint already returns original-list facts, linked/unlinked state, cluster assessment, evidence reasons, related edges, and ETH/USD context.
- The global wallet field and selected-group topology draw individual wallet nodes; the Evidence Atlas draws group aggregates.
- A wallet outside the frozen snapshot has no analytical data or graph node, and the existing endpoint reports that state with a 404.
- The product is read-only, keyless, and deliberately has no signer or broadcast path.

### Constraints

- KISS and the existing frontend MVC boundary.
- Store only a public address in local browser storage. No wallet connection, provider, API key, secret, signing, or transaction path.
- Preserve explorer and copy affordances for displayed addresses.
- Describe SybilKit output as evidence, never proof of ownership or identity.
- Keep the MaxPane Matrix visual language and mobile usability.

### Unknowns resolved

- A valid address absent from THE LIST should still be saveable: its profile explains that it is outside the snapshot and therefore has no graph or cluster data.
- The group atlas cannot show an individual wallet node, so it should mark the containing group when the focused wallet is linked.

## Solutions considered

### Option A: URL query parameter only

Put the wallet in the URL and derive profile/map state from it.

Pros: shareable and stateless.

Cons: exposes a personal viewing preference in copied URLs, complicates navigation, and does not meet the expectation that the wallet remains set on return.

### Option B: Browser-local focus wallet

Validate and normalize one typed address, persist it in local storage, and resolve its existing wallet dossier independently from temporary map selection.

Pros: keyless, private to the browser, simple, durable across visits, and cleanly separates persistent focus from transient inspection.

Cons: not synchronized across devices and not automatically shareable.

### Option C: Connected wallet account

Use a wallet provider and track the connected account.

Pros: automatic account selection.

Cons: directly conflicts with the requested no-connect interaction and the product's keyless discipline; adds dependencies and permission friction.

## Tradeoffs matrix

| Criterion | URL only | Browser-local | Connected account |
|---|---:|---:|---:|
| Simplicity | Medium | High | Low |
| Persists across visits | Low | High | Medium |
| No permissions | High | High | Low |
| Fits current product | Medium | High | Low |

## Recommendation

Use Option B. Keep the focus wallet as a small frontend preference and reuse the existing read-only dossier endpoint. Treat a 404 as the meaningful profile state “not in the original list,” not as an application failure.

## Visual plan

Existing MaxPane tokens remain authoritative:

- Void `#0b0b0b`: instrument wells and status fields.
- Carbon `#262626`: panels.
- Phosphor `#00dd33`: primary text and rules.
- Signal `#00ff41`: active controls.
- Focus white `#e8fff0`: saved-wallet reticle.
- Breach `#ff0040`: critical evidence only.

Typography stays with Fragment Mono for the active MaxPane theme. The profile is an instrument readout, not a generic account card.

```text
+ CLUSTERMAP -------------------------------- [MAP] [PROFILE · 0x…]
| analysis status strip
+--------------------------------------------------------------+
| YOUR WALLET PROFILE               | LOCAL / NO CONNECT        |
| [ 0x address input                              ] [SET]       |
+---------------------------+----------------------------------+
| THE LIST                  | CLUSTERING                        |
| rank / points / credit    | tier / confidence / families     |
| first seen / tx count     | why this group exists            |
+---------------------------+----------------------------------+
```

The signature is a four-corner reticle labeled `YOU` around the saved wallet.
It is drawn after the graph nodes so the label stays visible in dense groups. A
plain glow or second colored circle would look generic and could be confused
with evidence risk encoding. The reticle reads like a diagnostic target and
does not consume another risk color.

## State model

- No focus: profile page shows the address entry and local-only explanation.
- Loading: the address remains visible while its snapshot profile resolves.
- In THE LIST, grouped: show list metrics and group assessment; mark the wallet in population/topology graphs and its containing group in the atlas.
- In THE LIST, unlinked: show list metrics and independent status; mark it in the population graph only.
- Not in THE LIST: keep the valid address saved and explain that the frozen snapshot has no node or cluster data.
- Temporary graph selection remains independent from the persistent focus reticle.

## Implementation plan

1. Add pure address normalization and focus-profile state types to the frontend model layer.
2. Extend the data controller with browser-local persistence and dossier resolution that handles not-listed as a normal state.
3. Extend the view controller with map/profile navigation and controlled address-form state.
4. Add the profile view and header navigation.
5. Add the persistent reticle to the global map, group topology, and containing cluster atlas bubble.
6. Add tests, responsive styles, browser QA, and update project memory.

## Verification

- A typed address is normalized, stored locally, restored after reload, and
  resolved without any wallet provider or permission flow.
- Listed, unlinked, not-listed, loading, error, and empty profile states are
  represented; displayed addresses preserve explorer and copy affordances.
- The `YOU` reticle is visible in the global wallet field and group topology;
  the Evidence Atlas marks the saved wallet's containing group.
- Desktop and 390 px mobile browser QA pass against the real local API.
- 13 backend tests and 27 frontend tests pass; Ruff, TypeScript, and the Vite
  production build pass.
