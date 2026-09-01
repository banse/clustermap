# Wallet rule map and algorithm page

**Mode:** Standard Hammock
**Date:** 2026-09-01
**Status:** Final

## Problem statement

Selecting a wallet inside a group still renders the complete group topology. In
large groups this leaves the selected wallet buried among hundreds of nodes and
makes a reader decode prose to learn which SybilKit behavior touched it.

The product also lacks one version-aware place that explains how the frozen list,
rule edges, grouping, per-wallet gate, confidence, and review semantics fit
together. A reader can inspect evidence, but cannot yet build a correct mental
model of the algorithm from the interface alone.

Success means:

- a selected grouped wallet immediately becomes the centre of a direct evidence
  map rather than leaving all group members visible;
- concrete SybilKit rules are visible as graph objects and selectors;
- selecting one rule leaves only the selected wallet, that rule, its incident
  evidence, and the directly connected wallets;
- closing the wallet restores the previous group/global context;
- a `HOW THE ALGO WORKS` page explains the selected analysis version from input
  through output without presenting evidence as ownership proof;
- desktop, keyboard, reduced-motion, and narrow layouts remain usable.

## Understanding

### Facts

- `App.tsx` currently keeps passing the full `ClusterDetail` into
  `EvidenceGraph` after wallet selection. Selection changes highlighting only.
- `WalletDetail.related_edges` already contains the selected wallet's incident
  published edges and is capped at 120. No new wallet endpoint is required.
- The screenshot wallet `0xf996…d8e7` belongs to a 1,151-wallet group but has
  11 incident edges to six distinct neighbours.
- Stored edges contain family, strength, human reason, and transfer semantics,
  but no stable conceptual rule id.
- The immutable analysis artifact must not be rewritten just to add presentation
  metadata.
- Several conceptual rules emit two evidence families from one observation. A
  tight peel, for example, emits a funding transfer and cadence timing evidence.
- Frontend MVC boundaries require rule projection in models/controllers and
  network-free React views.

### Constraints

- KISS and existing React/FastAPI MVC boundaries.
- Test-first implementation for every behavior change.
- Preserve version pinning, cluster ids, content hashes, and stored edges.
- Funding is the only family representing an actual transfer. Other lines are
  behavioral matches.
- A group is a review question, never proof of common identity or ownership.
- Existing address copy/explorer controls and wallet deep links remain intact.

### Resolved unknowns

- **What is a rule?** A stable conceptual detector such as near-same-block,
  jitter engine, tight peel, or consecutive joins. Family-only filtering would
  not explain what fired.
- **Is the trace exhaustive?** It visualizes the rules represented by the
  published incident edges. The build intentionally keeps the strongest edge per
  source/target/family, so discarded raw candidates are not claimed as visible.
- **Where does focused mode apply?** Whenever a wallet dossier is selected on the
  map, whether entered from a group, global wallet map, or saved profile handoff.
- **What happens for an unlinked wallet?** The focused map shows one isolated
  wallet with a no-direct-rule state.
- **Is a selected rule shareable?** Yes. `rule=<stable-id>` is URL-pinned beside
  the existing page/version/cluster/wallet state and is removed when invalid.

## Solutions considered

### A. Family-only frontend filter

Filter `related_edges` by amount, cadence, funding, sequence, or gas.

Pros: smallest implementation and no API change.

Cons: near-identical amounts and a jitter engine both collapse into `amount`;
paired outputs from one rule look like independent triggers. It does not meet the
request to visualize the rules that fired.

### B. Parse human reason strings in React

Infer a rule from each edge's human sentence inside the view.

Pros: avoids a backend change and can display concrete labels.

Cons: brittle, unsuitable for URLs, duplicates detector semantics in a view, and
violates the frontend MVC boundary.

### C. Stable API annotation plus pure frontend projection

Classify existing immutable edges at the API boundary. Return a stable `rule_id`
and display label without changing the stored artifact. A pure frontend model
builds the focused rule graph and filters it. The same rule vocabulary powers the
algorithm page.

Pros: stable deep links, explicit semantics, no artifact/content-hash mutation,
testable boundaries, and one vocabulary across map and explanation.

Cons: the classifier must cover every published reason pattern and be updated
when a new detector version introduces a rule.

### D. New exhaustive rule-trace artifact

Persist every raw trigger before strongest-edge reduction.

Pros: complete forensic trace.

Cons: changes the data product, version schema, payload size, provenance, and QA
surface. It exceeds the visual comprehension goal.

## Recommendation

Use option C. It is the smallest architecture that truthfully exposes concrete
rules while preserving immutable analysis results.

The classifier must fail closed in tests: every edge in every committed version
must map to a named rule rather than silently falling back to a family. Paired
outputs from one conceptual builder share one rule id.

## Visual and interaction design

The selected wallet becomes the centre of a deterministic rule-orbit diagram:

```text
                      [related wallet]
                             |
        [related] --- < RULE NODE > --- [related]
                             |
                       (( SELECTED ))
                             |
        [related] --- < RULE NODE > --- [related]
```

- The centre node is the selected wallet and remains visually dominant.
- Concrete rules form the first orbit as labelled, keyboard-focusable nodes.
- Directly connected wallets form the outer orbit.
- Rule/family colour answers "what matched"; solid versus dashed answers
  "transfer or behavior".
- Parallel outputs of one rule are offset/curved so funding and cadence do not
  hide each other.
- The default `ALL TRIGGERED RULES` state shows every incident published edge.
- Clicking or keyboard-activating a rule filters both graph and trace count to
  that rule. Activating it again, or choosing `ALL`, restores the full wallet
  trace.
- The stage header changes from `CLUSTER TOPOLOGY` to `WALLET EVIDENCE` and
  reports direct neighbours, rules, and displayed links.
- The existing wallet facts panel remains below the primary visual. Closing it
  restores the complete group topology.

The visual language stays MaxPane Matrix. The deliberate signature is the rule
node as an inline "logic gate" between the selected wallet and counterpart
wallets; decoration elsewhere stays restrained.

## Algorithm page

`HOW THE ALGO WORKS` is a version-aware primary page. It renders:

1. **Frozen input** — WhitelistCurator deposits, refunds, final weights, snapshot
   block, and enrichment coverage.
2. **Points** — the exact integer square-root points curve and why points affect
   map prominence rather than proving uniqueness.
3. **Rule atlas** — each active concrete rule, its evidence family, threshold,
   transfer/behavior meaning, and paired-family caveat.
4. **Graph construction** — rule edges form components; the selected version's
   minimum group-size and family gates are shown.
5. **Wallet gate** — v2's local two-family core, review periphery, and the
   aged-weak exception; group evidence is separated from member evidence.
6. **Confidence and presentation tiers** — noisy-OR over the strongest reason per
   family, freshness adjustment, and the UI's review/elevated/critical display
   thresholds.
7. **Version differences** — raw list, shipped 0.1.1, and published 0.2.0 are not
   treated as interchangeable analyses.
8. **Limits and reproducibility** — paired families are not independent
   witnesses, published edges are not ownership proof, known audit limits,
   content hashes, source/rules provenance, reproduction command, audit, and
   dispute route.

Raw-list selection shows an explicit `NO DETECTOR APPLIED` state rather than
inventing rules. Static claims come from the pinned harness, `PROVENANCE.md`, and
the committed audit; selected-version counts and thresholds come from the API.

## MVC and data flow

```text
immutable version edge
  -> backend rule classifier (presentation annotation only)
  -> wallet API edge { family, reason, rule_id, rule_label, ... }
  -> controller-selected WalletDetail
  -> pure wallet evidence projection
  -> focused graph + rule selector

selected Overview + rule vocabulary
  -> algorithm presentation model
  -> HowAlgorithmWorksPage
```

## Work packages and dependencies

### WP1 — Rule semantics and API contract

Owner: backend/data.

- Add a production rule classifier/catalog.
- Annotate public cluster and wallet edges without changing stored data.
- Test paired-rule ids, screenshot-wallet rules, full-artifact coverage, transfer
  semantics, and unchanged version content hashes.

Depends on this design only.

### WP2 — Focused graph model and renderer

Owner: frontend graph.

- Extend edge types with stable rule identity.
- Add a pure projection/filter model and tests.
- Add the wallet evidence renderer and accessible rule controls.

Depends on the WP1 interface names, but can be built in parallel with fixtures.

### WP3 — Algorithm explanation page

Owner: frontend content/UI.

- Add a version-aware algorithm presentation model and page tests.
- Render the end-to-end pipeline, active rule atlas, gates, confidence, limits,
  provenance, audit, and dispute controls.

Can run in parallel with WP1 and WP2.

### WP4 — Integration and navigation

Owner: frontend integration; sole owner of shared controller/App/CSS files.

- Add `algorithm` page routing and primary navigation.
- Add URL-pinned rule selection with invalidation on wallet/version changes.
- Swap full topology for focused evidence when a wallet is selected.
- Preserve close/restore and responsive behavior.

Depends on WP1-WP3.

### WP5 — Documentation and verification

Owner: QA/release.

- Update `MEMORY.md` and public documentation where behavior changed.
- Run backend/frontend tests, MVC boundary, typecheck, production build, and
  full verification.
- Browser-check the screenshot wallet, each-rule reduction, paired peel output,
  unlinked wallet, close/restore, version changes, deep links, keyboard focus,
  reduced motion, narrow layout, and console.

Depends on WP4.

## Test strategy

Every work package follows red-green-refactor:

- backend tests first for classification and API shape;
- pure model tests first for node/edge filtering and empty cases;
- view tests first for controls, accessible names, and page content;
- integration tests first for page/rule routing and topology replacement;
- full suites and real-browser QA only after focused tests are green.

## Reconsideration triggers

- A future requirement to expose every discarded raw trigger requires option D,
  a separately versioned trace artifact.
- A new SybilKit release with new reason patterns must add catalog entries before
  it can pass the full-artifact classifier test.
- If a wallet's direct trace regularly exceeds the 120-edge API cap, the focused
  endpoint must expose explicit truncation metadata before claiming completeness.
