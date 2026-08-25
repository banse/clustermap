# Welcome page

**Mode**: Standard
**Date**: 2026-08-23
**Status**: Implemented and verified

## Problem statement

CLUSTERMAP currently opens at the evidence atlas. It explains how to read the
visualization, but it does not tell the short product story that makes the map
matter: WhitelistCurator made historical onchain presence durable, while
SybilKit was built to review the wallet-splitting incentive that the contract
intentionally left to offchain consumers.

## Source facts

- WhitelistCurator refunded each ETH deposit in the same transaction and kept
  the participation record onchain.
- Escalating high-water deposits and an hourly settlement rule turned the list
  into a time-bound game. Once settled, the list became immutable.
- Only code-less EOAs could deposit. The contract therefore supports a narrow
  capital claim: the recorded high-water balance existed at deposit time. It
  does not establish one-person-one-wallet.
- The contract notice explicitly warns that refunded capital plus the
  square-root curve rewards wallet fan-out and tells builders to filter the
  event history offchain.
- SybilKit fills that gap. It groups wallets only when at least five wallets
  share at least two independent evidence families. It exposes reasons and
  confidence for review, never an identity verdict.
- The current snapshot contains 19,522 wallets, 28,353 deposits, and 263 kept
  groups.

## Constraints

- Keep the surrounding narrative concise enough to function as an entrance,
  even when the selected contract excerpts are shown in full.
- Use the existing MaxPane Matrix language and frontend MVC boundaries.
- Preserve the analytical caveat: linked patterns are evidence, and unlinked
  wallets are not proven human or independent.
- Describe the NFT direction as a possibility. Do not announce a collection,
  snapshot, eligibility rule, or mint.

## Solutions considered

### Option A: one long manifesto

A text-led page reproduces most of the contract notice before linking to the
map.

Pros: complete context and direct fidelity to the source.

Cons: too dense for an entry page and duplicates reference documentation.

### Option B: two-record handoff

Lead with two durable statements — WhitelistCurator: “I was here.” and
SybilKit: “I count.” — then explain the original game, the reason for the
filter, and the tentative future in three compact sections.

Pros: makes the relationship memorable, keeps the source logic intact, and
provides direct actions into the map and wallet profile.

Cons: necessarily omits contract mechanics that are not essential to the
product story.

### Option C: timeline only

Show contract deployment, settlement, analysis, and future collection as four
chronological milestones.

Pros: clear historical sequence.

Cons: visually promotes an unannounced NFT direction to the same certainty as
completed events and weakens the core presence-to-review handoff.

### Option D: responsive source artifact

Replace the two slogan panels with the two supplied contract-notice excerpts,
reconstructed as responsive text rather than fixed-resolution images.

Pros: preserves the screenshots' editor palette, monospace rhythm, `///`
gutter, and source wrapping while remaining legible and accessible on mobile.

Cons: the full builder warning makes the hero taller than the original slogan
pair.

## Recommendation

Use Option D and keep the welcome page as the initial page. This supersedes the
initial Option B implementation after the two source screenshots were added.
The contract notice itself is now the memorable unit:

```text
/// @title WhitelistCurator
/// @notice Curates a permissionless onchain allowlist...

/// FOR BUILDERS CONSUMING THIS LIST
/// This contract does not pretend to solve sybil resistance...
```

The navigation keeps WELCOME, MAP, and PROFILE as peer views. The page remains
a pure view fed by the existing overview model; navigation stays in the map
view controller.

## Content structure

1. **Hero / source record** — “Presence was the product.” Pair the thesis and
   actions with the introduction notice followed by the builder warning.
2. **The original record** — Summarize zero-custody refunds, escalation,
   settlement, immutability, and the limited EOA balance claim.
3. **Why SybilKit exists** — Explain fan-out incentive, compound evidence,
   kept-group thresholds, and the non-verdict caveat.
4. **Possible next record** — Mention a possible NFT collection for
   WhitelistCurator participants not linked into a kept group under a future
   stated analysis. Explicitly say that no collection or eligibility is
   announced and current unlinked state is not a guarantee.

## Visual direction

- Existing carbon grid, phosphor text, square rules, and Fragment Mono remain
  authoritative.
- The global masthead names the source contract directly as
  `WhitelistCurator.sol`, with `THE LIST · SYBILKIT · CLUSTERMAP` beneath it.
  The existing ORIGIN / FILTER / READ context boxes remain visible on the
  Welcome page as well as Map and Profile.
- The signature element is a pair of literal contract-source panes: navy
  editor surface, muted periwinkle type, Fragment Mono, per-line `///` gutter,
  and the screenshots' deliberate source breaks. At collapsed widths, lines
  reflow within the code gutter instead of shrinking the PNGs into thumbnails.
- Source facts sit in bordered editorial columns instead of generic cards.
- Current snapshot figures are presented as a ledger strip, not vanity stats.
- The speculative future is outlined/dashed to distinguish it from recorded
  history.
- The shared footer provides direct MAXPANE, SYBILKIT, and verified-contract
  links. The MaxPane signoff is integrated as another normal green system field
  in that footer, without a separate strip below it.

## Verification

- Welcome is the default page and all three primary views remain reachable.
- The two slogan cards are absent; the newer introduction excerpt precedes the
  older builder-guidance excerpt.
- The SybilKit explanation includes the live minimum group/family thresholds
  and the evidence-not-proof limitation.
- Future NFT copy is visibly and semantically tentative.
- The layout works at desktop and 390 px widths without nav overflow.
- The three context boxes and all three footer links are present on Welcome.
- Frontend tests, typecheck, build, and browser QA pass.

Verified with 13 backend tests and 27 frontend tests, Ruff, TypeScript, and a
Vite production build. Real-browser QA passed at 1440 px and 390 px, including
the complete wrapped builder notice and zero horizontal overflow.
