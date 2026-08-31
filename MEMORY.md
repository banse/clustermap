# CLUSTERMAP Project Memory

Last updated: 2026-08-28

## Product

CLUSTERMAP is a read-only web visualization of MaxPane's original Ethereum
`CuratorWhitelist` / THE LIST population. Its single job is to show which
wallets SybilKit links and the evidence behind each link without presenting a
cluster as proof of common ownership.

THE LIST was a zero-custody allowlist game: escalating ETH sends were refunded
in the same transaction, a square-root curve awarded points, and an hourly
threshold closed entry. The final population is frozen.

The public, crypto-native framing is a three-step handoff:

1. WhitelistCurator.sol made an onchain allowlist for mints, drops, and
   reputation: ETH went in, ETH came back, and the participation record stayed.
2. Refunded capital made wallet fan-out cheap, so Sybil resistance was left
   offchain; SybilKit was built to cluster the resulting patterns.
3. CLUSTERMAP makes that analysis transparent: paste a public address, inspect
   its cluster, and see exactly which evidence linked the wallets. A link is an
   analytical signal, not an identity or ownership verdict.

## Current data and provenance

- Ethereum mainnet contract: `0xcB0b0531e86A9aC36Fa865cA8e3dbccF047FDA91`
- Deployment block: `25,769,870`
- Snapshot block: `25,807,057`
- Snapshot: `data/curator_snapshot.json.gz`
- Population: 19,522 wallets from 28,353 deposits
- Source version `2026-08-22-whitelistcurator-raw`: the original 19,522-wallet
  WhitelistCurator.sol list, represented as independent/unclustered before any
  SybilKit filtering
- Superseded analysis `2026-08-22-shipped`: 263 kept groups, 7,949 clean,
  0 review, 11,573 flagged
- Published v2h analysis `2026-08-25-sybilkit-0.2.0`: 160 kept groups, 6,782 clean,
  324 review, 12,416 flagged
- Immutable version artifact: `data/analysis_versions.json.gz`, generated
  deterministically by `scripts/build_versions.py`
- SybilKit: version 0.1.1, revision
  `61696545dd93f52daedd87e37a648e10fdfc8da5`
- Pinned source: `vendor/sybilkit`; upstream revision is recorded in
  `vendor/sybilkit/UPSTREAM_COMMIT`
- A group is kept only at 5+ wallets and 2+ evidence families. A family is a
  kind of evidence, not a separate observation: the 0.2.0 tight peel-chain
  builder books one transfer as both a funding and a cadence family (803
  flagged wallets hold both families from one transfer; 746 depend on it).
  The binding gate is the per-member `member_gate=local2` plus `min_size=5`;
  the group-level `min_families=2` is inert on the published run.
- Evidence families are funding, amount, sequence, cadence, and gas. Only
  funding edges are actual transfers; other edges are behavioral patterns.
- A reproducible independent audit lives under `audit/`. It documents that the
  shipped rules flag 11,573 wallets, link 45.8% of an operator-free synthetic
  population, and miss most wallets in a known 419-wallet operator pattern.
  The audit includes its harness, evidence data, raw run logs, and HTML report.

## Current product decisions

- The active visual language is MaxPane Matrix only.
- Light and Dark implementations are not deleted. The dormant three-theme
  switcher is controlled by `THEME_SWITCHER_ENABLED = false` in
  `dashboard/src/models/theme.ts`. While disabled, MaxPane is forced even when
  a browser has an older Light/Dark preference in local storage.
- The app opens on `WELCOME`; the primary navigation order is `THE LIST`,
  `MAP`, `STATS`, `UNDER REVIEW`, `CHANGE LOG`, then `PROFILE`/`SET WALLET`.
  The welcome page derives its claims from the WhitelistCurator contract notice
  and clearly separates historical onchain presence from offchain evidence
  review. Its hero shows two responsive, code-comment-style source excerpts in
  screenshot order: the newer `@title` / `@notice` introduction first, then the
  older `FOR BUILDERS CONSUMING THIS LIST` warning. These source panes replace
  the earlier `"I was here."` / `"I count."` slogan cards.
- The global masthead reads `WhitelistCurator.sol` with the subline
  `THE LIST · SYBILKIT · CLUSTERMAP`. The three ORIGIN / FILTER / READ context
  boxes appear on WELCOME, MAP, and PROFILE. In MaxPane, the title uses
  `clamp(28px, 3vw, 40px)` so it does not overlap the first context box at wide
  desktop viewport/device-scale combinations.
- The welcome outlook mentions a possible future NFT collection for
  WhitelistCurator participants not linked into a kept SybilKit group. It is
  deliberately not an announcement: no collection, mint, snapshot, or
  eligibility rule exists here, and current unlinked state is neither a
  promise nor proof of a unique human.
- Within `MAP`, the default global view is `CLUSTERS`, the Evidence Atlas.
  `WALLETS` remains available through the global-view switch.
- The frontend opens on the published audited v2h analysis by default. The raw
  WhitelistCurator list and superseded shipped SybilKit analysis are also
  globally selectable or directly URL-pinnable.
- The selected version is always visible and URL-pinned. It controls every
  count, map, cluster drill-down, wallet dossier, list row, and export. Cluster
  ids are qualified by their version because ids are not stable across runs.
- The public change log combines chain entries generated from the frozen
  snapshot with dated analysis, publication, and context entries. Historical
  entries are append-only and filterable by kind and date.
- The change-log view is split 1:1: an audited shipped→v2h summary ledger on
  the left and the immutable filtered timeline on the right. The summary covers
  wallet transitions, the new jitter/peel-chain groups, false-positive controls,
  recall gains, full enrichment, and the ownership disclaimer. Its primary
  figure renders `19,522 → 6,782` for wallets with no kept v2h group. A two-box
  row beneath it shows −1,167 versus shipped SybilKit 0.1.1 and −12,740 versus
  the full original wallet population before the newly-flagged/released metrics.
- The analysis-version controls sit immediately above the shared footer on every
  loaded primary view instead of directly below the masthead.
- `STATS` is a version-pinned population quality audit. It defines raw as all
  19,522 frozen wallets and retained/filtered as `clean + review`; only flagged
  wallets count as removed. The page compares wallet and point retention, a
  fixed eight-collection Ethereum NFT holder benchmark, exact natural minimum-
  deposit ladders, entry-nonce maturity, and ENS/IDMD/verified control retention.
- `THE LIST` is a version-pinned wallet-attribute leaderboard. The raw source
  version is titled `THE LIST (RAW)` and defaults to all 19,522 wallets. A
  SybilKit version is titled `THE LIST (RETAINED)` when it has no review tier,
  or `THE LIST (RETAINED + UNDER REVIEW)` when review wallets are retained.
  `CLEAN LIST` contains the selected SybilKit version's `clean + review`
  population; only `flagged` wallets are excluded. Group, flag, risk, and
  evidence fields are deliberately absent.
  `HOUR ZERO`, `25+ ETH DEPOSIT`, and `ENS NAME SET` refine whichever global
  list version is selected. `FIRST 1,000 ENTRIES` exists only for the raw list
  and is reset when the user switches to a SybilKit version. The first column
  is labelled `CLEAN`/`RAW` for the default or `FILTER` for a preset and ranks
  the selected population contiguously from 1; search and attribute sorting
  never rewrite that rank.
  Every data header sorts the complete selected population on the server before
  pagination, and JSON export preserves the same ordering. Original rank remains
  visible as provenance. Recorded ENS names sit beside addresses. Credit,
  weight, gross deposited amount, min→max deposit range, deposit count, and
  first→last contract-hour window are shown in ETH without USD fallback copy.
  Non-rank body cells use a prominent 15px data size for scanability, with 11px
  secondary values.
  The summary docket labels its result `RAW / FILTERED` or `CLEAN / FILTERED`
  and shows either the selected-list population or active preset result count.
  Search, JSON export, wallet-profile handoff, and 50-row server pagination
  remain available. Published v2 has 7,106 retained wallets: 6,782 clean + 324
  under review. The frozen source records eight ENS names.
- NFT ownership is an immutable offline ERC-721 `balanceOf` snapshot at Ethereum
  block 25,853,521, stored in `data/nft_holder_snapshot.json.gz`; no RPC or API
  runs in the web process. The fixed benchmark is CryptoPunks, BAYC, MAYC,
  Azuki, Pudgy Penguins, Doodles, Moonbirds, and Milady Maker. An RPC URL is
  supplied only through `CLUSTERMAP_NFT_RPC_URL` when rebuilding and is never
  written to Git. In the frozen list, 38 unique wallets held at least one
  benchmark collection at observation time; published v2 retains all 38.
- An exact natural ladder means at least three deposits whose entire ordered
  amount sequence starts at 0.05 ETH and adds 0.10 ETH per step. There are 564
  such wallets. The published v2 classifies 304 clean, 116 review, and 144
  flagged. Its measured counterfactual removes only those exact amount-pattern
  edges while leaving every other signal active: 37 wallets cease to be
  flagged (36 exact-pattern wallets), from 12,416 to 12,379 flagged.
- Calendar wallet age is not available in the frozen data. `STATS` therefore
  labels entry transaction nonce precisely as prior outgoing transactions and
  a maturity proxy. Coverage is 100%; the published v2 median moves from 0 in
  the raw population to 47 in the retained population.
- Directional delta mode compares any base/head pair on the head layout. Wallet
  states use the closed order `clean < review < flagged`; visual classes are
  improved, worsened, under review, and unchanged. Atlas bubbles render the
  full member mix as coloured wedges, while dissolved base clusters and new
  head clusters remain representable.
- The shipped → v2h comparison is pinned at 2,082 released wallets and 2,925
  newly flagged wallets. Its four visual classes cover all 19,522 wallets;
  comparing a version with itself yields 19,522 unchanged.
- A wallet dossier shows status, version-qualified cluster, and incident
  evidence families for every version. In delta mode it also names the analysis
  change that produced the head.
- Wallet profiles, map dossiers, under-review details, and per-version history
  show `ORIGINAL LIST RANK → CLEANED LIST RANK`. The cleaned rank compacts the
  original rank order over wallets retained by that analysis (`clean + review`).
  Flagged wallets have no cleaned rank and are labelled `NOT RETAINED`.
- Evidence Atlas encoding: X = confidence, Y = logarithmic points share,
  bubble area = wallet count, yellow/orange/red = evidence tier, dashed ring =
  possible false positive.
- Evidence tiers are described as weak, moderate, or strong *group evidence*.
  Wallet views describe membership in such a group rather than assigning a
  Sybil label to an individual wallet. A group is a question, not a verdict.
- Wallet detail and global-map records also expose the evidence families that
  touch that wallet directly. A linked wallet with fewer than two incident
  families is capped at the review tier instead of inheriting its cluster's
  stronger tier; the cluster tier remains available separately.
- `UNDER REVIEW` is a master-detail evidence desk. The existing group-ranked
  wallet ledger remains on the left and every wallet row is selectable. A
  dedicated controller state loads the selected wallet dossier on the right,
  where the review decision, direct edge reasons, transfer-versus-behavioural
  distinction, group context, wallet facts, and a compact radial evidence map
  are shown together. On narrow screens the dossier moves directly below the
  page introduction and before the long group ledger.
- Clicking a group opens its topology. `WHY THIS GROUP EXISTS` is rendered
  inline below the map.
- Clicking a wallet replaces that inline group explanation with the complete
  wallet dossier. Closing the wallet restores the group explanation.
- The old wallet popup and maximize modal were removed.
- Earlier MaxPane list/history/you screens remain in source but are hidden so
  the cluster maps stay the product surface.
- Header context blocks currently read:
  - `ORIGIN // THE LIST — "I was here."`
  - `FILTER // SYBILKIT — "I count."`
  - `READ // EVIDENCE`
- The context copy explains the original contract idea, the live SybilKit
  thresholds, evidence families, how to inspect a group/wallet, and the
  ownership disclaimer.
- Users can set one public focus wallet by typing an Ethereum address. This is
  deliberately not a wallet connection: the normalized address is stored only
  in browser local storage under `clustermap.focus-wallet`; there is no provider,
  signer, secret, permission request, or broadcast path.
- CSV/JSON exports carry detector/version/timestamp provenance, the audit's
  known caveats, and per-wallet evidence-family/review fields so exported data
  does not lose the interpretation safeguards shown in the UI.
- The `PROFILE` page is titled `YOUR WALLET PROFILE` and shows the saved
  wallet's original-list record and SybilKit clustering state. A valid address
  outside the frozen population remains saveable and is shown as
  `NOT IN THE ORIGINAL LIST`, without treating the API 404 as a product error.
- When the saved profile wallet is under review or flagged, the profile reuses
  the wallet-specific evidence desk below its existing list and group facts:
  the status-aware decision explanation, radial direct-link map, textual edge
  reasons, transfer-versus-behavioural labels, and ownership disclaimer. The
  block is absent only for clean wallets; its accent and wording follow the
  wallet's own analysis and risk tier rather than only the stronger group tier.
- A persistent white `YOU` reticle marks the saved wallet in the global wallet
  field and selected-group topology. It is drawn above all graph nodes so the
  label remains readable. The Evidence Atlas marks the containing group when
  the wallet is linked. Temporary wallet selection remains separate.
- The shared footer links to MAXPANE, SYBILKIT, and the verified
  WhitelistCurator.sol source. The MaxPane signoff
  `☮ 2026 hisdudeness.eth – The Dude Abides.` is integrated as a normal themed
  footer field rather than a separate strip.

## Architecture and important files

Keep the existing small MVC boundary:

- Backend models: `src/clustermap/models`
- Backend HTTP controllers: `src/clustermap/controllers`
- Frontend models/API/presentation: `dashboard/src/models`
- Frontend state and async flows: `dashboard/src/controllers`
- React views without direct network access: `dashboard/src/views`
- Audit harness and evidence: `audit/harness`, `audit/data`, and `audit/report`

Important current frontend files:

- `dashboard/src/views/App.tsx`: main map composition
- `dashboard/src/views/WelcomePage.tsx`: product history, use case, and outlook
- `dashboard/src/views/MapIntroduction.tsx`: header context copy
- `dashboard/src/views/ClusterAtlas.tsx`: default cluster atlas
- `dashboard/src/views/VersionControls.tsx`: visible version and base/head controls
- `dashboard/src/views/ChangelogPage.tsx`: immutable public timeline
- `dashboard/src/views/DeltaPanel.tsx`: directional counts and map filter
- `dashboard/src/views/WalletVersionHistory.tsx`: per-wallet explanations
- `dashboard/src/views/EvidenceGraph.tsx`: selected group topology
- `dashboard/src/views/MapInspectionPanel.tsx`: inline group/wallet details
- `dashboard/src/controllers/useMapViewController.ts`: map selection state
- `dashboard/src/controllers/useClusterMapController.ts`: version-pinned API state
- `dashboard/src/models/delta.ts`: frontend delta-count validation
- `dashboard/src/models/walletProfile.ts`: focus-address validation/presentation
- `dashboard/src/views/WalletProfilePage.tsx`: local focus-wallet profile
- `dashboard/src/views/StatsPage.tsx`: version-pinned population/filter audit
- `dashboard/src/views/ListLeaderboardPage.tsx`: clean-default/raw-preset attribute leaderboard
- `dashboard/src/views/drawFocusReticle.ts`: shared canvas focus marker
- `dashboard/src/controllers/useThemeController.ts`: forced/dormant theme state
- `dashboard/src/styles/app.css`: all theme and responsive presentation

Detailed decisions live under `.claude/designs/`.

The version-store design is recorded in
`.claude/designs/versioned-analysis-and-delta.md`. Runtime code only reads and
validates the stored artifact; detector recomputation is an explicit offline
build step, never a web request. Raw-version and selected-list semantics are in
`.claude/designs/raw-list-analysis-version.md`.

## Operational notes

- App: `http://127.0.0.1:8766`
- FastAPI docs: `http://127.0.0.1:8766/docs`
- Install: `make install`
- Production build: `make build`
- Run: `make run`
- Rebuild immutable analysis versions: `make versions`
- Rebuild aggregate quality statistics: `make quality-stats`
- Rebuild the NFT observation snapshot (requires a temporary RPC URL in the
  process environment): `CLUSTERMAP_NFT_RPC_URL=… make nft-holder-snapshot`
- Full verification: `UV_CACHE_DIR=/tmp/clustermap-uv-cache make test`
- The FastAPI server serves `dashboard/dist`. After frontend edits, run
  `npm --prefix dashboard run build`; if a browser still shows the old bundle,
  perform a hard refresh.
- Last verified state: 38 backend tests and 54 frontend tests pass; Ruff,
  TypeScript, and the Vite production build pass.
- Browser QA additionally covers published→candidate switching (263→160),
  directional comparison totals and atlas mixes, version-qualified cluster
  drill-down, wallet deep links/history, retained-list search/rank stability,
  full-result attribute sorting, paging/profile handoff, raw/retained title
  switching, raw-only first-1,000 reset, version-scoped HOUR ZERO counts,
  ENS-name filtering, change-log filters, URL pinning, and zero console
  warnings/errors.
- Expected non-blocking test warnings: Starlette's `httpx` deprecation and the
  Vitest environment's invalid `--localstorage-file` warning.

## Non-negotiable guardrails

- KISS.
- Frontend MVC.
- Never commit API keys or secrets.
- Read-only, keyless, no signer, no broadcast.
- Preserve address explorer/copy affordances.
- ETH values normally need USD context or the explicit `USD unavailable`
  fallback; THE LIST ledger is the deliberate ETH-only exception.
- Never describe analytical evidence as proof of identity or ownership.
- Preserve unrelated user work in the repository.
