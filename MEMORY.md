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
- Published analysis `2026-08-22-shipped`: 263 kept groups, 7,949 clean,
  0 review, 11,573 flagged
- Selectable v2h candidate `2026-08-25-v2h`: 160 kept groups, 6,782 clean,
  324 review, 12,416 flagged
- Immutable version artifact: `data/analysis_versions.json.gz`, generated
  deterministically by `scripts/build_versions.py`
- SybilKit: version 0.1.1, revision
  `61696545dd93f52daedd87e37a648e10fdfc8da5`
- Pinned source: `vendor/sybilkit`; upstream revision is recorded in
  `vendor/sybilkit/UPSTREAM_COMMIT`
- A group is kept only at 5+ wallets and 2+ independent evidence families.
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
- The app opens on `WELCOME`; `MAP`, `CHANGE LOG`, and `PROFILE` remain primary
  peer views.
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
- The frontend opens on the audited v2h analysis by default. It remains marked
  as a candidate; the shipped SybilKit analysis remains the published archive
  and is still selectable or directly URL-pinnable.
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
- `dashboard/src/views/drawFocusReticle.ts`: shared canvas focus marker
- `dashboard/src/controllers/useThemeController.ts`: forced/dormant theme state
- `dashboard/src/styles/app.css`: all theme and responsive presentation

Detailed decisions live under `.claude/designs/`.

The version-store design is recorded in
`.claude/designs/versioned-analysis-and-delta.md`. Runtime code only reads and
validates the stored artifact; detector recomputation is an explicit offline
build step, never a web request.

## Operational notes

- App: `http://127.0.0.1:8766`
- FastAPI docs: `http://127.0.0.1:8766/docs`
- Install: `make install`
- Production build: `make build`
- Run: `make run`
- Rebuild immutable analysis versions: `make versions`
- Full verification: `UV_CACHE_DIR=/tmp/clustermap-uv-cache make test`
- The FastAPI server serves `dashboard/dist`. After frontend edits, run
  `npm --prefix dashboard run build`; if a browser still shows the old bundle,
  perform a hard refresh.
- Last verified state: 29 backend tests and 42 frontend tests pass; Ruff,
  TypeScript, and the Vite production build pass.
- Browser QA additionally covers published→candidate switching (263→160),
  directional comparison totals and atlas mixes, version-qualified cluster
  drill-down, wallet deep links/history, change-log filters, URL pinning, and
  zero console warnings/errors.
- Expected non-blocking test warnings: Starlette's `httpx` deprecation and the
  Vitest environment's invalid `--localstorage-file` warning.

## Non-negotiable guardrails

- KISS.
- Frontend MVC.
- Never commit API keys or secrets.
- Read-only, keyless, no signer, no broadcast.
- Preserve address explorer/copy affordances.
- ETH values need USD context or the explicit `USD unavailable` fallback.
- Never describe analytical evidence as proof of identity or ownership.
- Preserve unrelated user work in the repository.
