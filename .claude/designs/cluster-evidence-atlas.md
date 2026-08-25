# Cluster evidence atlas

**Mode**: Standard
**Date**: 2026-08-22
**Status**: Implemented and verified

## Problem statement

The global wallet field is good for population context and individual-wallet exploration, but it does not make the 263 SybilKit groups easy to compare. A second global view must expose which clusters are important, how strong their evidence is, how large they are, and which ones need manual review.

## Understanding

### Facts

- The deterministic wallet field remains available as a switchable companion view.
- A later product adjustment makes the Evidence Atlas the default global view.
- The dataset contains 263 clusters, with confidence from 78.6% to almost 100%.
- Points share and cluster size are highly skewed, so linear visual scales would compress most groups.
- Risk color and dashed review outlines already have stable meanings across the application.
- Selecting a cluster should reuse the existing full cluster drill-down.

### Constraints

- KISS and frontend MVC.
- Deterministic and practical on mobile.
- Compatible with Light, Dark, and MaxPane themes.
- No new backend payload is necessary; the overview already contains the required cluster metadata.

## Solutions considered

### Option A: Risk columns

Place groups in three vertical lanes for review, elevated, and critical.

Pros: very easy to scan by verdict and simple to implement.

Cons: confidence differences inside a tier disappear, points relevance needs a second ordering rule, and large groups can dominate a lane.

### Option B: Evidence atlas scatterplot

Use confidence on X, logarithmic points share on Y, bubble area for wallet count, risk for color, and dashed outlines for possible false positives. Apply deterministic collision relaxation while retaining the analytical target coordinates.

Pros: four useful dimensions remain simultaneously visible, the axes explain the ordering, and exact values remain available on hover.

Cons: requires axis literacy and minor collision displacement.

### Option C: Aggregate force constellation

Render one force-directed bubble per cluster, weighted by shared evidence.

Pros: visually organic and familiar from network maps.

Cons: cluster-to-cluster links are not part of the current evidence model, so the layout would imply relationships the data does not establish.

## Recommendation

Implement Option B. It orders clusters by information that actually exists instead of inventing inter-cluster topology. Logarithmic importance scaling keeps both small and dominant groups readable, while collision relaxation prevents bubbles from hiding each other.

## Visual encoding

- X: SybilKit confidence, lower to higher.
- Y: cluster share of all CuratorWhitelist points, logarithmic, higher at the top.
- Bubble area: number of wallets in the cluster.
- Fill: yellow review, orange elevated evidence, red strong signal.
- Dashed outer ring: possible false positive/manual review.
- Hover card: group, wallets, points share, confidence, evidence families, and review state.
- Click: open the existing full cluster topology.

## Implementation plan

1. Add a pure deterministic cluster-atlas layout model with collision relaxation.
2. Add the themed canvas atlas view with axes, hover inspection, and cluster selection.
3. Add global-view state and an accessible Wallets/Clusters switch to the map controller.
4. Make headings and sidebar copy reflect the selected global visualization.
5. Test default behavior, switching, layout invariants, build, themes, desktop, mobile, and cluster drill-down.

## Verification

- The Evidence Atlas is selected on initial load; the wallet field remains one switch away.
- The global switch changes between Wallets and Clusters without changing routes or fetching another payload.
- 17 frontend tests pass, including axis ordering, bubble sizing, plot bounds, default mode, and switching.
- TypeScript and the Vite production build pass.
- Browser QA confirms MaxPane, Light, and Dark contrast, desktop and 390 px mobile layout, exact hover metadata, bubble click into cluster topology, and return to the previously selected atlas view.
