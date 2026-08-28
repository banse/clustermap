# LIST Quality Statistics - Design Document

**Type**: New Feature
**Date**: 2026-08-28
**Status**: Final

## Problem Statement

### User Problem

The map explains why individual wallets are linked, but it does not summarize
whether the retained population looks more established or how sensitive the
filter is to a protocol-native deposit pattern. A reader cannot currently tell
whether SybilKit improves list quality without manually combining the snapshot,
the version artifact, and audit controls.

### Success Metrics

- One version-pinned page compares the 19,522-wallet raw list with the wallets
  that the selected analysis retains (`clean + review`).
- Every number names its denominator, observation point, and interpretation.
- NFT-holder retention, exact minimum-ladder prevalence/counterfactual, and
  wallet maturity are visible without introducing a live RPC or API key.

## Understanding

### User Requirements

- Compare unfiltered and filtered wallet quality.
- Count holders from prominent Ethereum NFT collections.
- Count exact protocol ladders beginning `0.05 → 0.15 → …`.
- Show how many wallets stop being flagged when that exact ladder evidence is
  ignored.
- Compare wallet age/maturity between the raw and retained populations.

### Technical Context

- The frontend uses a small MVC split: types/API in `models`, async state in
  `controllers`, and rendering in `views`.
- The runtime is keyless and reads immutable local artifacts.
- The v2 rule keeps `review` wallets; only `flagged` wallets are removed.
- First-deposit transaction fingerprints cover all 19,522 wallets and include
  the nonce at entry, but no artifact contains a trustworthy first-ever
  activity timestamp for every wallet.

### Constraints

- No live RPC or third-party NFT API in the web request path.
- Never present NFT ownership or an ENS name as proof of a unique human.
- Do not call nonce a calendar age; label it as prior transactions at entry.
- Preserve version pinning and detector provenance.

## Research

### Existing Patterns

- `data/analysis_versions.json.gz` provides wallet status for every analysis.
- `audit/data/enrichment/full_enrich.json` provides complete entry nonces.
- `audit/data/idmd_holders.json`, ENS names, and verified controls already act
  as false-positive controls in the audit.
- SybilKit 0.2.0 emits a named amount edge for identical multi-step ladders.

### External Input

- ERC-721 `balanceOf(address)` is sufficient for a current holder snapshot.
- Collection contracts are verified on Etherscan before inclusion.
- Historical owner reconstruction belongs in an indexer. The page therefore
  uses a fixed-block offline balance crawl and publishes that block explicitly.

## Solutions

### Option A: Live analytics APIs

Query an NFT/indexing provider from the backend or browser on every request.

**Pros**: Always current; collection set can change dynamically.

**Cons**: Requires an API key, creates a private dependency, makes results
non-reproducible across page loads, and can fail or rate-limit in production.

### Option B: Immutable quality snapshot

Build one offline artifact from the frozen list, complete audit enrichment,
fixed collection contracts, and a fixed Ethereum block. The runtime intersects
those facts with the selected immutable analysis version.

**Pros**: Keyless runtime, fast, version-aware, explicit provenance, stable
comparisons, and easy to audit.

**Cons**: NFT ownership is a dated observation and must be refreshed explicitly.

### Option C: Browser-side RPC reads

Call every collection's `balanceOf` from each visitor's browser.

**Pros**: No backend artifact.

**Cons**: Roughly 156,000 reads per refresh, exposes an RPC dependency to every
visitor, leaks browsing intent, and is operationally unacceptable.

## Recommendation

**Chosen**: Option B.

The page is an audit surface. Stable, inspectable inputs matter more than
minute-to-minute ownership changes. The collection set is a fixed Ethereum PFP
benchmark, not a claim that an external ranking is timeless: CryptoPunks, BAYC,
MAYC, Azuki, Pudgy Penguins, Doodles, Moonbirds, and Milady Maker.

## Metric Semantics

- **Raw list**: all 19,522 wallets in the frozen contract snapshot.
- **Retained list**: `clean + review` in the selected analysis; `flagged` is the
  only removed state.
- **NFT holder**: `balanceOf(address) > 0` at the artifact's observation block.
- **Exact natural ladder**: at least three deposits whose complete ordered
  amounts are exactly `0.05 + 0.10 × step` ETH.
- **Counterfactual release**: baseline flagged wallets no longer in the flagged
  core after only the named exact-natural-ladder evidence edges are removed;
  every other signal remains active.
- **Wallet maturity**: transaction nonce on the first deposit. Median and
  distribution are shown as prior outgoing transactions, never calendar age.

## Visual Direction

- Keep the established MaxPane palette and typography.
- Signature element: a two-rail `RAW → RETAINED` audit ruler reused across
  maturity and holder comparisons, so every visual encodes the same filter.
- Use paired horizontal measures instead of generic KPI cards.
- The ladder counterfactual is one compact flow with the exact deposits drawn
  as rungs; it is the page's only decorative risk.

## Implementation Plan

1. Generate a deterministic fixed-block NFT-holder artifact offline.
2. Build version-aware quality statistics in the repository and expose
   `/api/v1/stats`.
3. Add typed API/controller state and a URL-pinned `STATS` page.
4. Render outcome, holder benchmark, ladder counterfactual, maturity, and
   control retention with paired raw/retained measures.
5. Verify backend invariants, frontend behavior, responsive layout, and browser
   console output.

## Open Questions

- A future archive-indexed first-activity timestamp could replace the nonce
  proxy, but only if coverage and the reference block are published.
- The NFT benchmark can be revised only by producing a new named snapshot; it
  must not silently mutate an existing artifact.
