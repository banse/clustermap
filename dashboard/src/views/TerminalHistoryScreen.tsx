import type { ClusterMapController } from "../controllers/useClusterMapController";
import type { TerminalController } from "../controllers/useTerminalController";
import type { EvidenceFamily, Overview } from "../models/domain";
import { clusterLabel, familyLabel, formatCount, formatPercent } from "../models/presentation";
import { AddressLink } from "./AddressLink";
import { EvidenceGraph } from "./EvidenceGraph";

interface HistoryScreenProps {
  readonly data: ClusterMapController;
  readonly terminal: TerminalController;
  readonly overview: Overview;
}

const families: readonly EvidenceFamily[] = ["funding", "sequence", "amount", "cadence", "gas"];

export function HistoryScreen({ data, terminal, overview }: HistoryScreenProps) {
  const detail = data.cluster;
  return (
    <section className="screen-stack" aria-labelledby="history-screen-title">
      <div className="terminal-hero">
        <div>
          <span>THE LIST / HISTORY / {terminal.historyView.toUpperCase()}</span>
          <h1 id="history-screen-title">SYBILKIT EVIDENCE</h1>
        </div>
        <dl>
          <div><dt>DEPOSITS</dt><dd>{formatCount(overview.totals.deposits)}</dd></div>
          <div><dt>GROUPS</dt><dd>{formatCount(overview.totals.groups)}</dd></div>
          <div><dt>LINKED</dt><dd>{formatCount(overview.totals.linked_wallets)}</dd></div>
          <div><dt>CLEAN</dt><dd>{formatCount(overview.totals.unlinked_wallets)}</dd></div>
        </dl>
      </div>

      {terminal.historyView === "map" ? (
        <div className="history-layout">
          <div className="terminal-panel cluster-ledger">
            <div className="panel-title"><span>GROUP LEDGER</span><small>BY POINT SHARE</small></div>
            <div className="cluster-list">
              {overview.clusters.slice(0, 18).map((cluster) => (
                <button
                  type="button"
                  key={cluster.id}
                  className={detail?.cluster.id === cluster.id ? "is-active" : ""}
                  onClick={() => void data.openCluster(cluster.id)}
                >
                  <span>{clusterLabel(cluster.id)} · {overview.version.id}</span>
                  <strong>{formatPercent(cluster.points_share)}</strong>
                  <small>{formatCount(cluster.size)}W · {cluster.band.toUpperCase()}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="terminal-panel graph-terminal">
            <div className="panel-title">
              <span>{detail === null ? "POPULATION MAP" : `${clusterLabel(detail.cluster.id)} · ${detail.version} TOPOLOGY`}</span>
              <div>
                {detail === null ? null : <button type="button" onClick={data.backToOverview}>ALL GROUPS</button>}
                <button type="button" onClick={data.resetView}>RESET VIEW</button>
              </div>
            </div>
            {data.loading.cluster ? <p className="terminal-empty">LOADING GROUP TOPOLOGY…</p> : (
              <EvidenceGraph
                overview={overview}
                detail={detail}
                selectedAddress={data.wallet?.wallet.address ?? null}
                focusedAddress={data.focusedWalletAddress}
                resetKey={data.resetViewKey}
                onOpenCluster={(id) => void data.openCluster(id)}
                onSelectWallet={(address) => void terminal.submitWallet(address)}
              />
            )}
          </div>

          <div className="terminal-panel signal-inspector">
            <div className="panel-title"><span>{detail === null ? "SIGNAL INDEX" : "GROUP DETAIL"}</span><small>[C] SIGNALS</small></div>
            {detail === null ? (
              <>
                <p className="terminal-copy">SELECT A GROUP OR BUBBLE TO INSPECT ITS EVIDENCE FAMILIES. BUBBLE AREA TRACKS CONTRACT POINT SHARE.</p>
                <div className="signal-list">
                  {families.map((family) => {
                    const groups = overview.clusters.filter((cluster) => cluster.families.includes(family));
                    return <div key={family}><span className={`family-mark family-mark--${family}`} /><strong>{familyLabel(family)}</strong><span>{formatCount(groups.length)} GROUPS</span></div>;
                  })}
                </div>
              </>
            ) : (
              <>
                <div className={`terminal-evidence terminal-evidence--${detail.cluster.band}`}>
                  <strong>{detail.cluster.band.toUpperCase()} EVIDENCE</strong>
                  <span>{formatCount(detail.cluster.edge_count)} EDGES · {formatPercent(detail.cluster.confidence)} CONF.</span>
                </div>
                <div className="reason-list">
                  {detail.cluster.reasons.map((reason) => (
                    <div key={`${reason.family}-${reason.text}`}><span className={`family-mark family-mark--${reason.family}`} /><p><strong>{familyLabel(reason.family)}</strong><span>{reason.text}</span></p></div>
                  ))}
                </div>
                <div className="mini-wallet-list">
                  {detail.nodes.slice(0, 7).map((node) => (
                    <div key={node.address}>
                      <span>#{formatCount(node.rank)}</span>
                      <AddressLink address={node.address} compact />
                      <button type="button" onClick={() => void terminal.submitWallet(node.address)}>OPEN</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="signals-layout">
          <div className="terminal-panel">
            <div className="panel-title"><span>EVIDENCE FAMILY MATRIX</span><small>CLUSTER-LEVEL SIGNALS</small></div>
            <table className="terminal-table signals-table">
              <thead><tr><th>FAMILY</th><th>TYPE</th><th>GROUPS</th><th>EDGES</th></tr></thead>
              <tbody>{families.map((family) => {
                const groups = overview.clusters.filter((cluster) => cluster.families.includes(family));
                return <tr key={family}><td>{familyLabel(family)}</td><td>{family === "funding" ? "MEASURED TRANSFER" : "BEHAVIOURAL LINK"}</td><td>{formatCount(groups.length)}</td><td>{formatCount(groups.reduce((sum, cluster) => sum + cluster.edge_count, 0))}</td></tr>;
              })}</tbody>
            </table>
          </div>
          <div className="terminal-panel">
            <div className="panel-title"><span>LARGEST GROUPS</span><small>PRESS [C] FOR MAP</small></div>
            <table className="terminal-table signals-table">
              <thead><tr><th>GROUP</th><th>WALLETS</th><th>POINTS</th><th>SHARE</th><th>FAMILIES</th></tr></thead>
              <tbody>{overview.clusters.slice(0, 20).map((cluster) => <tr key={cluster.id} onDoubleClick={() => void data.openCluster(cluster.id).then(() => terminal.cycleView())}><td>{clusterLabel(cluster.id)} · {overview.version.id}</td><td>{formatCount(cluster.size)}</td><td>{formatCount(cluster.points)}</td><td>{formatPercent(cluster.points_share)}</td><td>{cluster.families.join(" / ").toUpperCase()}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
      <p className="terminal-disclaimer">[EVIDENCE NOTE] {overview.analysis.disclaimer}</p>
    </section>
  );
}
