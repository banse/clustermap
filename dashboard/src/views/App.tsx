import type { ClusterMapController } from "../controllers/useClusterMapController";
import { useMapViewController } from "../controllers/useMapViewController";
import { useThemeController } from "../controllers/useThemeController";
import { clusterLabel, formatCompact, formatCount, riskLabel } from "../models/presentation";
import { THEME_SWITCHER_ENABLED } from "../models/theme";
import { shortWalletAddress } from "../models/walletProfile";
import { ClusterAtlas } from "./ClusterAtlas";
import { ChangelogPage } from "./ChangelogPage";
import { DeltaPanel } from "./DeltaPanel";
import { EvidenceGraph } from "./EvidenceGraph";
import { GlobalViewSwitcher } from "./GlobalViewSwitcher";
import { GlobalWalletMap } from "./GlobalWalletMap";
import { GroupInspectionPanel, WalletInspectionPanel } from "./MapInspectionPanel";
import { MapIntroduction } from "./MapIntroduction";
import { MapSidebar } from "./MapSidebar";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { VersionControls } from "./VersionControls";
import { WelcomePage } from "./WelcomePage";
import { WalletProfilePage } from "./WalletProfilePage";

interface AppProps {
  readonly controller: ClusterMapController;
}

export function App({ controller }: AppProps) {
  const themes = useThemeController();
  const mapView = useMapViewController(controller);
  const overview = controller.overview;
  const globalMap = controller.globalMap;
  const detail = mapView.scope === "cluster" ? controller.cluster : null;
  const showingAtlas = detail === null && mapView.globalView === "clusters";
  const deltaHeadEntry = controller.delta === null
    ? null
    : controller.changelog?.entries.find((entry) => (
      entry.kind === "analysis" && entry.version === controller.delta?.head.id
    )) ?? null;

  return (
    <main className="map-app">
      <header className="map-header">
        <div className="map-header__brand">
          <h1>WhitelistCurator.sol</h1>
          <p>THE LIST · SYBILKIT · CLUSTERMAP</p>
        </div>
        <div className="map-header__tools">
          <div className="map-header__topline">
            <p>READ-ONLY <span>/</span> KEYLESS <span>/</span> ETHEREUM</p>
            <nav className="map-primary-nav" aria-label="Primary views">
              <button type="button" aria-current={mapView.page === "welcome" ? "page" : undefined} onClick={mapView.showWelcome}>WELCOME</button>
              <button type="button" aria-current={mapView.page === "map" ? "page" : undefined} onClick={mapView.showMap}>MAP</button>
              <button type="button" aria-current={mapView.page === "changelog" ? "page" : undefined} onClick={mapView.showChangelog}>CHANGE LOG</button>
              <button type="button" aria-current={mapView.page === "profile" ? "page" : undefined} onClick={mapView.showProfile}>
                {controller.focusedWalletAddress === null ? "SET WALLET" : (
                  <>PROFILE<span className="map-primary-nav__address"> · {shortWalletAddress(controller.focusedWalletAddress)}</span></>
                )}
              </button>
            </nav>
          </div>
          <MapIntroduction analysis={overview?.analysis ?? null} />
          {THEME_SWITCHER_ENABLED ? <ThemeSwitcher theme={themes.theme} onChange={themes.setTheme} /> : null}
        </div>
      </header>

      {controller.error === null ? null : (
        <div className="map-error" role="alert">
          <strong>DATA REQUEST FAILED</strong><span>{controller.error}</span>
          <button type="button" onClick={controller.clearError}>DISMISS</button>
        </div>
      )}

      <VersionControls
        versions={controller.versions}
        selectedId={controller.selectedVersionId}
        deltaEnabled={controller.deltaEnabled}
        baseId={controller.deltaBaseId}
        headId={controller.deltaHeadId}
        onVersion={controller.setVersion}
        onDeltaEnabled={controller.setDeltaEnabled}
        onBase={controller.setDeltaBase}
        onHead={controller.setDeltaHead}
      />

      {overview === null || globalMap === null ? (
        <section className="map-loading" aria-live="polite">
          <span aria-hidden="true" />
          <h2>BUILDING GLOBAL WALLET FIELD</h2>
          <p>Loading 19,522 wallets and the sparse SybilKit evidence graph.</p>
        </section>
      ) : (
        <>
          {mapView.page === "welcome" ? null : <section className="map-status" aria-label="Analysis status">
            <div className="map-status__ready"><span aria-hidden="true" /><p><small>ANALYSIS STATE</small><strong>READY</strong></p></div>
            <div><small>THE LIST · ORIGINAL POPULATION</small><strong>{formatCount(overview.totals.population)} WALLETS</strong></div>
            <div><small>GROUPS</small><strong>{formatCount(overview.totals.groups)}</strong></div>
            <div><small>CONNECTED</small><strong>{formatCompact(globalMap.meta.edge_count)}</strong></div>
            <div><small>CLEAN · REVIEW</small><strong>{formatCount(overview.totals.status_counts.clean)} · {formatCount(overview.totals.status_counts.review)}</strong></div>
            <div><small>FLAGGED</small><strong>{formatCount(overview.totals.status_counts.flagged)}</strong></div>
          </section>}

          {mapView.page === "welcome" ? (
            <WelcomePage overview={overview} onOpenMap={mapView.showMap} onOpenProfile={mapView.showProfile} />
          ) : mapView.page === "changelog" ? (
            <ChangelogPage entries={controller.changelog?.entries ?? []} />
          ) : mapView.page === "profile" ? (
            <WalletProfilePage
              address={controller.focusedWalletAddress}
              detail={controller.focusedWallet}
              status={controller.focusedWalletStatus}
              draft={mapView.walletDraft}
              draftError={mapView.walletDraftError}
              snapshotBlock={overview.provenance.snapshot_block}
              disclaimer={overview.analysis.disclaimer}
              dispute={overview.analysis.dispute}
              onDraftChange={mapView.setWalletDraft}
              onSave={mapView.saveFocusedWallet}
              onClear={mapView.clearFocusedWallet}
              onShowOnMap={() => void mapView.showFocusedWalletOnMap()}
            />
          ) : (
          <>
          {controller.deltaEnabled && controller.delta !== null ? (
            <DeltaPanel delta={controller.delta} filter={mapView.deltaFilter} onFilter={mapView.setDeltaFilter} />
          ) : null}
          <section className="map-workspace">
            <div className="map-stage">
              <header className="map-stage__header">
                <div>
                  <span>{detail === null ? (showingAtlas ? "CLUSTER ANALYSIS" : "GLOBAL POPULATION") : "CLUSTER TOPOLOGY"}</span>
                  <h2>{detail === null ? (showingAtlas ? "Evidence atlas" : "All wallets") : `${clusterLabel(detail.cluster.id)} · ${detail.version}`}</h2>
                  <p>
                    {detail === null
                      ? (showingAtlas ? "Confidence × points share × wallet count" : "Highest-point wallets begin at the centre")
                      : `${formatCount(detail.cluster.size)} wallets · ${riskLabel(detail.cluster.risk).toUpperCase()}`}
                    {detail?.cluster.review_flag ? <strong className="cluster-review-label">POSSIBLE FALSE POSITIVE</strong> : null}
                  </p>
                </div>
                <div>
                  {detail === null ? (
                    <GlobalViewSwitcher view={mapView.globalView} onChange={mapView.setGlobalView} />
                  ) : <button type="button" onClick={mapView.showGlobal}>GLOBAL MAP</button>}
                  <button type="button" onClick={controller.resetView}>RESET VIEW</button>
                </div>
              </header>

              <div className={`map-canvas-frame${detail === null ? "" : " map-canvas-frame--cluster"}`}>
                {detail === null && mapView.globalView === "wallets" ? (
                  <GlobalWalletMap
                    map={globalMap}
                    theme={themes.theme}
                    selectedAddress={controller.wallet?.wallet.address ?? null}
                    focusedAddress={controller.focusedWalletAddress}
                    deltaClasses={controller.deltaEnabled ? controller.delta?.wallet_classes ?? null : null}
                    deltaFilter={mapView.deltaFilter}
                    resetKey={controller.resetViewKey}
                    onSelectWallet={(address, clusterId) => void mapView.selectWallet(address, clusterId)}
                  />
                ) : detail === null ? (
                  <ClusterAtlas
                    overview={overview}
                    theme={themes.theme}
                    resetKey={controller.resetViewKey}
                    focusedClusterId={controller.focusedWallet?.cluster?.id ?? null}
                    clusterDeltas={controller.deltaEnabled ? controller.delta?.head_clusters ?? null : null}
                    deltaFilter={mapView.deltaFilter}
                    onOpenCluster={(id) => void mapView.showCluster(id)}
                  />
                ) : controller.loading.cluster ? (
                  <div className="map-inline-loading">LOADING CLUSTER TOPOLOGY…</div>
                ) : (
                  <EvidenceGraph
                    overview={overview}
                    detail={detail}
                    selectedAddress={controller.wallet?.wallet.address ?? null}
                    focusedAddress={controller.focusedWalletAddress}
                    resetKey={controller.resetViewKey}
                    theme={themes.theme}
                    onOpenCluster={(id) => void mapView.showCluster(id)}
                    onSelectWallet={(address, clusterId) => void mapView.selectWallet(address, clusterId)}
                  />
                )}
                {controller.loading.wallet ? <div className="wallet-selection-loading">READING WALLET…</div> : null}
              </div>

              {controller.wallet !== null ? (
                <WalletInspectionPanel
                  detail={controller.wallet}
                  headEntry={controller.deltaEnabled ? deltaHeadEntry : null}
                  onClose={mapView.closeWallet}
                  onViewCluster={(id) => void mapView.showCluster(id)}
                  onSelectWallet={(address, clusterId) => void mapView.selectWallet(address, clusterId)}
                />
              ) : detail === null ? null : (
                <GroupInspectionPanel detail={detail} disclaimer={overview.analysis.disclaimer} />
              )}
            </div>

            <MapSidebar
              overview={overview}
              globalMap={globalMap}
              detail={detail}
              globalView={mapView.globalView}
              onGlobal={mapView.showGlobal}
              onCluster={(id) => void mapView.showCluster(id)}
            />
          </section>
          </>
          )}

          <footer className="map-footer">
            <div className="map-footer__projects">
              <span>PROJECT LINKS</span>
              <nav aria-label="Project links">
                <a href="https://github.com/banse/maxpane" target="_blank" rel="noreferrer">MAXPANE ↗</a>
                <a href="https://pypi.org/project/sybilkit/" target="_blank" rel="noreferrer">SYBILKIT ↗</a>
                <a href="https://etherscan.io/address/0xcb0b0531e86a9ac36fa865ca8e3dbccf047fda91#code" target="_blank" rel="noreferrer">WHITELISTCURATOR.SOL ↗</a>
              </nav>
            </div>
            <div><span>SNAPSHOT</span><strong>BLOCK {formatCount(overview.provenance.snapshot_block)}</strong></div>
            <div><span>DISCIPLINE</span><strong>NO SIGNER · NO BROADCAST</strong></div>
            <div className="map-footer__signoff">
              <span>SIGNOFF</span>
              <strong><span aria-hidden="true">☮</span> 2026 hisdudeness.eth – The Dude Abides.</strong>
            </div>
          </footer>
        </>
      )}

    </main>
  );
}
