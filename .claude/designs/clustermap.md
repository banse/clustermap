# CLUSTERMAP — Project Design

**Type**: New Project  
**Mode**: Deep  
**Date**: 2026-08-22  
**Status**: Implemented and Verified

## Vision

### Problem Statement

THE LIST exists as a ranked contract-derived table in MaxPane, while SybilKit's linked-wallet evidence is hard to inspect spatially. Analysts need to move from a population-level overview to one wallet and understand why addresses were grouped without mistaking correlation for identity or ownership.

### Target Users

Curators and onchain analysts who already understand wallet addresses and need a fast, read-only investigation surface.

### Success Looks Like

- The complete 19,522-address original list is searchable and inspectable.
- All SybilKit clusters can be compared as weighted bubbles.
- Opening a cluster reveals individual wallets and typed evidence links.
- Every wallet detail retains provenance back to the CuratorWhitelist contract.
- The app never signs, broadcasts, or needs an API key to render its bundled snapshot.

### Non-Goals

- No wallet connection or state-changing transaction.
- No claim that a linked group proves common ownership.
- No new smart contract, indexer database, or generic multi-chain explorer.
- No attempt to draw all 19,522 wallets at once.

## Discovery

### Facts

- Contract: `0xcB0b0531e86A9aC36Fa865cA8e3dbccF047FDA91` on Ethereum mainnet.
- Deployment block: `25,769,870`.
- Final MaxPane cache: 28,353 deposits, 19,522 first deposits, 19,522 ranked wallets.
- SybilKit 0.1.1 reproduces 263 groups over the final population in under one second locally.
- The largest group has 1,104 wallets; rendering a selected group is tractable, rendering the full population is not.
- SybilKit requires at least five wallets and two evidence families before keeping a cluster. A family is a
  kind of evidence, not a separate observation: under the 0.2.0 rules the tight peel-chain builder books one
  transfer as both a funding and a cadence family.

### Context

- Source access and decoded data already exist in `/Library/Vibes/autopull` and `~/.maxpane`.
- SybilKit is published from the `sybilkit/` subdirectory of `https://github.com/banse/maxpane`.
- PAWAI uses React/Vite with strict model/controller/view boundaries, FastAPI, Saira Condensed, Atkinson Hyperlegible, Fragment Mono, and a field-paper instrument aesthetic.

### Constraints

- KISS and MVC, especially in frontend code.
- No secrets or API keys in Git.
- Read-only network behavior; offline snapshot must remain useful.
- Exact integer handling for wei and points in Python; presentation conversion only at the boundary.
- Accessible keyboard focus, reduced-motion support, responsive layout.

### Unknowns (Resolved)

- [x] Is the local research fixture complete? No; it contains 15,576 wallets. The current MaxPane cache/export contains the final 19,522-wallet population.
- [x] Does SybilKit need a new contract or database? No; it is pure analysis over decoded events and optional enrichment.
- [x] Can the final dataset be recomputed at startup? Yes; dataset normalization plus detection takes under one second locally.
- [x] Are cluster edges literal transfers? Only funding-family links are. Other links are behavioural evidence and must be labelled accordingly.

### Unknowns (Open)

- A production hostname is not known, so production-only OpenGraph absolute URLs remain deferred.
- A live ETH/USD source is intentionally optional; the app must not fail when price context is unavailable.

## Solutions Considered

### Option A: One giant wallet graph

Render every wallet and every inferred link in a single force simulation.

**Pros**: Literal interpretation of a global bubble map; no mode switch.  
**Cons**: 19,522 nodes are visually illegible, expensive on mobile, and make clean wallets dominate the surface.  
**Sacrifices**: Investigation clarity and accessibility.

### Option B: Progressive cluster map

Render groups as weighted bubbles, then drill into a selected group to render its wallets and typed evidence links. Keep the full original list in a virtualized/paginated side panel.

**Pros**: Fast, legible, Bubblemaps-like exploration; preserves the full population without pretending every clean wallet has a relationship.  
**Cons**: Requires an explicit overview/detail transition.  
**Sacrifices**: No simultaneous view of every individual wallet.

### Option C: Precomputed static graph only

Export a single JSON graph from MaxPane and serve it with a static frontend.

**Pros**: Simplest deployment and fastest startup.  
**Cons**: SybilKit is no longer an active dependency, provenance is harder to validate, and refreshed data requires a manual rebuild.  
**Sacrifices**: Reproducibility and API-level inspection.

## Tradeoff Matrix

| Criterion | Giant graph | Progressive map | Static graph |
|---|---:|---:|---:|
| Visual clarity | Low | High | High |
| Runtime simplicity | Medium | Medium | High |
| Complete-list access | Low | High | Medium |
| Reproducible analysis | High | High | Low |
| Mobile usability | Low | High | Medium |

## Recommendation

Choose **Option B, Progressive cluster map**, backed by a small FastAPI service and a bundled, contract-derived snapshot. Clone SybilKit from its GitHub monorepo and pin the fetched revision. The backend owns exact analysis and graph projection; the React frontend owns interaction and presentation only.

The product's single job is to answer: **Which wallets are linked, and what evidence creates that link?**

## Technical Design

### Architecture

```text
CuratorWhitelist events + MaxPane enrichment
                    │
                    ▼
        bundled snapshot (read-only)
                    │
                    ▼
      SybilKit dataset + detection model
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
 cluster/evidence graph   original-list index
          └─────────┬─────────┘
                    ▼
             FastAPI controllers
                    ▼
        React controller/store layer
                    ▼
       PAWAI-style graph + detail views
```

### Backend MVC Boundary

- **Models**: immutable domain records, SybilKit adapter, graph projection, list repository.
- **Controllers**: FastAPI routes, input validation, HTTP errors.
- **Views**: JSON response schemas and the compiled static frontend.

### Frontend MVC Boundary

- **Models**: API/domain types and pure presentation functions; no React imports.
- **Controllers**: API client, selection/filter state, async lifecycle.
- **Views**: React components; no direct fetch calls or analytical calculations.

### API

- `GET /api/v1/overview` — provenance, totals, group bubbles, evidence legend.
- `GET /api/v1/clusters/{id}` — member nodes, typed evidence edges, reasons.
- `GET /api/v1/wallets/{address}` — list metrics, cluster membership, evidence.
- `GET /api/v1/list` — paginated/searchable original list.
- `GET /api/v1/health` — snapshot and analysis readiness.

### Data Model

- `Wallet`: address, rank, points, credit, weight, first hour/index, transaction count.
- `Cluster`: id, size, confidence, points/share, evidence families, reasons.
- `EvidenceEdge`: source, target, family, strength, `is_transfer`.
- `Provenance`: chain, contract, deployment block, cache block, analysis engine revision.

### Design Plan

**Palette**

- Bog ink `#10251F`
- Field paper `#E5DFC5`
- Signal lime `#B8D44A`
- Caution amber `#DF9C3D`
- Breach red `#C84B45`
- Chain blue `#45738B`

**Typography**

- Display: Saira Condensed, restrained to titles and measured totals.
- Body: Atkinson Hyperlegible for explanatory and navigation text.
- Data: Fragment Mono for addresses, filters, statuses, and graph labels.

**Layout**

```text
┌─ CLUSTERMAP ─ contract provenance ─────────────────────────────┐
├─ ANALYSIS READY ─ population / groups / evidence coverage ─────┤
├───────────────────────────────────────────────┬─────────────────┤
│                                               │ INSPECTOR       │
│         force-directed evidence field         │ reasons         │
│         overview ↔ selected cluster           │ wallet metrics  │
│                                               │ related wallets │
├───────────────────────────────────────────────┴─────────────────┤
│ ORIGINAL LIST · search · filters · paginated rows              │
└─────────────────────────────────────────────────────────────────┘
```

**Signature**

The graph is an **evidence field**: overview bubbles become wallet nodes in place, while the status rail changes from population coverage to the selected group's evidence families. Funding edges are solid; behavioural edges use distinct dashes and a visible legend.

### Design Critique

An early concept used generic dashboard stat cards around the graph. Those were removed because they did not encode anything specific to wallet analysis. Counts now live in one PAWAI-style instrument rail, leaving visual emphasis for the evidence field. The PAWAI palette and type remain, but the memorable element is domain-specific rather than decorative.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Behavioural links mistaken for transfers | High | Typed legend, dashed links, explicit evidence copy, `is_transfer` field |
| Full graph overwhelms browser | High | Aggregate overview; load one cluster at a time; canvas rendering |
| Upstream SybilKit changes | Medium | Record/pin Git revision and test result counts |
| Snapshot becomes stale | Medium | Provenance timestamp/block and an explicit snapshot refresh script |
| Public endpoints fail | Low | Bundled snapshot is the default and requires no network |

## Implementation Plan

1. Clone the upstream monorepo sparsely and expose its `sybilkit` package through the project environment.
2. Export only the final Curator events, first-deposit rows, tx fingerprints, funding rows, raw list, and provenance into compressed project data.
3. Implement the pure analysis repository and typed evidence projection.
4. Add FastAPI controllers and static frontend serving.
5. Build the React MVC frontend with canvas pan/zoom/drag, cluster drill-down, address search, filters, and details.
6. Add backend/frontend tests, production builds, desktop/mobile browser checks, and startup documentation.

## Assumptions That Might Be Wrong

- **The final MaxPane cache is the intended baseline**: if a newer contract snapshot appears, regenerate the bundled snapshot and expect count-based tests to change deliberately.
- **Cluster membership is the primary dependency view**: if literal transfer-only topology becomes the product goal, keep only funding edges and add a dedicated transaction-history indexer rather than re-labelling behavioural evidence.
