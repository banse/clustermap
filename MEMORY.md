# CLUSTERMAP Project Memory

Last updated: 2026-08-24

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
- SybilKit result: 263 kept groups
- SybilKit: version 0.1.1, revision
  `61696545dd93f52daedd87e37a648e10fdfc8da5`
- Pinned source: `vendor/sybilkit`; upstream revision is recorded in
  `vendor/sybilkit/UPSTREAM_COMMIT`
- A group is kept only at 5+ wallets and 2+ independent evidence families.
- Evidence families are funding, amount, sequence, cadence, and gas. Only
  funding edges are actual transfers; other edges are behavioral patterns.

## Current product decisions

- The active visual language is MaxPane Matrix only.
- Light and Dark implementations are not deleted. The dormant three-theme
  switcher is controlled by `THEME_SWITCHER_ENABLED = false` in
  `dashboard/src/models/theme.ts`. While disabled, MaxPane is forced even when
  a browser has an older Light/Dark preference in local storage.
- The app opens on `WELCOME`; `MAP` and `PROFILE` remain primary peer views.
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
- Evidence Atlas encoding: X = confidence, Y = logarithmic points share,
  bubble area = wallet count, yellow/orange/red = evidence tier, dashed ring =
  possible false positive.
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
- The `PROFILE` page is titled `YOUR WALLET PROFILE` and shows the saved
  wallet's original-list record and SybilKit clustering state. A valid address
  outside the frozen population remains saveable and is shown as
  `NOT IN THE ORIGINAL LIST`, without treating the API 404 as a product error.
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

Important current frontend files:

- `dashboard/src/views/App.tsx`: main map composition
- `dashboard/src/views/WelcomePage.tsx`: product history, use case, and outlook
- `dashboard/src/views/MapIntroduction.tsx`: header context copy
- `dashboard/src/views/ClusterAtlas.tsx`: default cluster atlas
- `dashboard/src/views/EvidenceGraph.tsx`: selected group topology
- `dashboard/src/views/MapInspectionPanel.tsx`: inline group/wallet details
- `dashboard/src/controllers/useMapViewController.ts`: map selection state
- `dashboard/src/models/walletProfile.ts`: focus-address validation/presentation
- `dashboard/src/views/WalletProfilePage.tsx`: local focus-wallet profile
- `dashboard/src/views/drawFocusReticle.ts`: shared canvas focus marker
- `dashboard/src/controllers/useThemeController.ts`: forced/dormant theme state
- `dashboard/src/styles/app.css`: all theme and responsive presentation

Detailed decisions live under `.claude/designs/`.

## Operational notes

- App: `http://127.0.0.1:8766`
- FastAPI docs: `http://127.0.0.1:8766/docs`
- Install: `make install`
- Production build: `make build`
- Run: `make run`
- Full verification: `UV_CACHE_DIR=/tmp/clustermap-uv-cache make test`
- The FastAPI server serves `dashboard/dist`. After frontend edits, run
  `npm --prefix dashboard run build`; if a browser still shows the old bundle,
  perform a hard refresh.
- Last verified state: 13 backend tests and 27 frontend tests pass; Ruff,
  TypeScript, and the Vite production build pass.
- Browser QA covers the welcome page at desktop and 390 px, welcome-to-map and
  welcome-to-profile navigation, the focus profile and all three focus-marker
  contexts, and persistence across reload. Welcome-page captures are under
  `output/playwright/welcome-page/`; contract-notice replacement captures are
  under `output/playwright/contract-notice/`; final masthead, footer, mobile,
  and `YOU`-reticle captures are under `output/playwright/masthead-footer/`.
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
