# CLUSTERMAP

CLUSTERMAP visualises the original MaxPane `CuratorWhitelist` as an interactive
SybilKit relationship field. The global map shows every wallet, places
high-scoring wallets at the centre and leaves independent wallets green and
unconnected. Detected groups are joined in yellow, orange or red according to
the strength of their evidence. The current interface uses the MaxPane matrix
look exclusively; it is browser-native, responsive and read-only.

The bundled snapshot covers 19,522 wallets and 28,353 deposits. The published
analysis is SybilKit 0.2.0 and contains 160 groups; the superseded
original SybilKit 0.1.1 analysis (263 groups) stays selectable. Both use the
same settled input ending at Ethereum block 25,807,057.

> **Audit — please read before interpreting the map.** The groups shown here come
> from SybilKit 0.2.0, published after SybilKit 0.1.1's own rules were
> measured. Those flagged 11,573 of the 19,522 wallets, but also 45.6% of a
> synthetic population that by construction contains **no** sybils — and they
> missed an operator holding 419 wallets and 15.6% of all points. 0.2.0 flags
> 12,416, links 0.1% of that synthetic population, and reaches 397 of those 419.
> It is our current best rule set, not a final verdict: every constant in it was
> calibrated on this one population, and it still contains false positives. The
> 0.1.1 analysis stays selectable for comparison. How each claim is pinned — the
> population, the detector, the rules, the analysis — is written up in
> [`PROVENANCE.md`](PROVENANCE.md). The full audit report, the
> dataset (a first funder for all
> 19,522 wallets) and the scripts are in [`audit/`](audit/README.md) and are
> reproducible from this repository — down to cluster membership, not just totals, so you can check a
> single wallet's verdict rather than trust an aggregate. A group on the map is a **question**, not a
> verdict about an individual wallet.

## Quick start

Requirements: Python 3.11+, `uv`, Node.js and npm.

```bash
make install
make build
make run
```

The app is then reachable at <http://127.0.0.1:8766>. Port `8766` is chosen
deliberately so the PAWAI reference dashboard can keep running alongside it on
`8765`. The FastAPI documentation lives at <http://127.0.0.1:8766/docs>.

For frontend development, the backend and Vite can be started separately:

```bash
uv run clustermap
npm --prefix dashboard run dev
```

Vite then runs on `5173` and forwards `/api` to the local backend.

## Features

- global canvas map with all 19,522 wallets and 11,310 real, evidence-based
  connections
- cluster evidence atlas by default, switchable to the wallet map: confidence on
  the x-axis, logarithmic share of points on the y-axis, bubble area as wallet
  count
- independent wallets green and unconnected; the highest scores at the centre
- evidence tiers yellow (weak group evidence), orange (moderate) and red
  (strong) — these describe how strongly a *group* is linked, never a verdict
  about an individual wallet
- an additional dashed marking for possible false positives, with a concrete
  reason for review
- cluster drill-down with every projected SybilKit edge, pan, zoom, drag and
  wallet selection
- inline group rationale directly beneath the cluster map, with evidence
  families, confidence, key figures and false-positive notes
- a complete wallet dossier in the same inline area; closing it returns to the
  group rationale without losing context
- typed evidence edges for funding, amount, sequence, cadence and gas
- focused MaxPane matrix look; the existing three-theme switch stays disabled in
  the code for later reactivation
- responsive desktop/mobile interface and reduced-motion support
- a fully usable local snapshot without an API key or a running RPC
- immutable, URL-pinned analysis versions, with SybilKit 0.2.0 published
  and SybilKit 0.1.1 kept selectable
- a public change log combining generated chain history with dated analysis and
  publication entries
- a directional base → head delta on both maps, with wallet histories and
  improved, worsened, under-review and unchanged filters
- a version-pinned Stats page comparing all 19,522 raw wallets with the wallets
  retained after filtering (`clean + under review`), including point retention,
  blue-chip NFT holder retention, minimum-deposit ladders, wallet maturity and
  independent control populations
- a measured SybilKit 0.2.0 counterfactual showing how many wallets cease to be
  flagged when only exact `0.05 → 0.15 → 0.25 → …` amount-pattern edges are
  ignored and every other signal remains active

The earlier MaxPane screens are still in the source but are hidden for now, so
that the clustermap is the central work surface.

## Why not a streamed terminal?

To publish the complete Textual app unchanged, `textual-serve` would be the
shortest route. The relationship map, however, needs performant canvas rendering
for 19,522 wallets, touch operation and browser-native overlays. The map
therefore runs as a React application on top of the FastAPI/SybilKit read model.
No shell emulator or per-browser TUI process is required.

For performance reasons the global view uses a deterministic point and group
layout algorithm together with a strongest-evidence spanning forest. Once a
group is opened, the cluster view still shows every projected SybilKit edge. The
default cluster atlas invents no connections between groups; it arranges every
group in the selected version by confidence, share of points and size.

Funding edges are actual transfers and are drawn as solid lines. Dashed edges
are behavioural similarities. A grouping is an analysis signal and **not proof
of common ownership**.

## Data and provenance

- Contract: `0xcB0b0531e86A9aC36Fa865cA8e3dbccF047FDA91`
- Chain: Ethereum mainnet
- Deployment block: `25,769,870`
- Snapshot: `data/curator_snapshot.json.gz`
- Analysis: SybilKit, cloned from `github.com/banse/maxpane` and pinned in
  `vendor/sybilkit`

The app loads immutable analysis output from
`data/analysis_versions.json.gz`; it never runs the v2 prototype in the web
process. The artifact stores the status, cluster and incident evidence families
for every wallet in every version, validates each version's content hash at
startup, and is rebuilt deterministically from the snapshot and audit harness:

```bash
make versions
```

The published analysis is `2026-08-25-sybilkit-0.2.0`; the superseded
`2026-08-22-shipped` version remains selectable and is not overwritten. Each
version records the detector release it *is* — `sybilkit-v0.1.1` and
`sybilkit-v0.2.0` — frozen per version rather than inherited from whatever is
vendored, plus the enrichment it ran on, which differs between them. The v2 rules
are additionally pinned by content (`rules_sha256` over `audit/harness/sk_v2.py`),
so the tagged release is verifiably the script that produced the analysis. The
exact detector inputs and rule identifiers are stored with each version. The
vendored SybilKit commit remains recorded in `vendor/sybilkit/UPSTREAM_COMMIT`.

The Stats page loads aggregate results from `data/list_quality_stats.json.gz`.
Its NFT benchmark uses a fixed, offline ERC-721 ownership snapshot at Ethereum
block 25,853,521 for CryptoPunks, BAYC, MAYC, Azuki, Pudgy Penguins, Doodles,
Moonbirds, and Milady Maker. No RPC is called at runtime. Rebuild the aggregate
artifact with:

```bash
make quality-stats
```

The NFT snapshot itself is normally treated as an immutable observation. To
make a new observation, provide an RPC URL only through the process environment:

```bash
CLUSTERMAP_NFT_RPC_URL=https://your-rpc.example make nft-holder-snapshot
```

The URL is never stored in the generated artifact or committed to Git. Wallet
"maturity" on the page is explicitly the first-deposit transaction nonce—the
number of prior outgoing transactions—because the frozen dataset does not
contain true wallet-creation timestamps.

A current local MaxPane state can be exported like this:

```bash
make snapshot
```

By default the export expects `~/.maxpane/curator_cache.json` and
`~/.maxpane/curator_raw_list.json`. Different paths can be passed directly to
`scripts/export_snapshot.py`. The export stores no API keys.

## Architecture

Frontend and backend keep the MVC boundaries deliberately small:

- `src/clustermap/models`: snapshot, SybilKit analysis and graph projection
- `src/clustermap/controllers`: HTTP validation and API routes
- `dashboard/src/models`: types, API client and pure presentation helpers
- `dashboard/src/controllers`: UI state and asynchronous flows
- `dashboard/src/views`: React views with no direct API access

The original data and graph derivation is written up in
`.claude/designs/clustermap.md`. The decision between `textual-serve`, xterm.js
and the browser-native MaxPane rebuild is documented in
`.claude/designs/maxpane-the-list-web.md`. Layout, risk tiers and the current map
focus are in `.claude/designs/global-wallet-map-and-themes.md`. The immutable
version store and directional comparison are documented in
`.claude/designs/versioned-analysis-and-delta.md`.

## Quality assurance

```bash
make test
```

The command runs the Python tests, Ruff, the frontend tests, the TypeScript
check and the production build.

Configuration happens through environment variables; `.env.example` serves as a
template. A local `.env` can be loaded before startup with
`set -a; source .env; set +a` and is not checked in. An optional
`CLUSTERMAP_ETH_USD` value is for display only; without it the app deliberately
shows “USD unavailable”.
