import type { ChangelogEntry, ClusterDetail, ClusterSummary, WalletDetail } from "../models/domain";
import { clusterLabel, familyLabel, formatCount, formatEth, formatPercent, riskLabel } from "../models/presentation";
import { AddressLink } from "./AddressLink";
import { WalletVersionHistory } from "./WalletVersionHistory";
import { WalletRankComparison } from "./WalletRankComparison";

function riskTitle(cluster: ClusterSummary | null): string {
  if (cluster === null) return "NO GROUP LINK";
  return riskLabel(cluster.risk).toUpperCase();
}

export function GroupInspectionPanel({ detail, disclaimer }: {
  readonly detail: ClusterDetail;
  readonly disclaimer: string;
}) {
  const cluster = detail.cluster;
  return (
    <section className="map-inspection-panel group-inspection" aria-labelledby="group-inspection-title">
      <header className="inspection-header">
        <div>
          <span>GROUP EVIDENCE REVIEW · {clusterLabel(cluster.id)} · {detail.version}</span>
          <h2 id="group-inspection-title">WHY THIS GROUP EXISTS</h2>
        </div>
        <strong className={`inspection-risk inspection-risk--${cluster.risk}`}>{riskTitle(cluster)}</strong>
      </header>

      <div className="inspection-metrics">
        <div><span>Wallets</span><strong>{formatCount(cluster.size)}</strong></div>
        <div><span>Points share</span><strong>{formatPercent(cluster.points_share)}</strong></div>
        <div><span>Confidence</span><strong>{formatPercent(cluster.confidence)}</strong></div>
        <div><span>Evidence links</span><strong>{formatCount(cluster.edge_count)}</strong></div>
      </div>

      {cluster.review_flag ? (
        <div className="false-positive-panel"><strong>POSSIBLE FALSE POSITIVE — REVIEW RECOMMENDED</strong>{cluster.review_reasons.map((reason) => <p key={reason}>{reason}</p>)}</div>
      ) : null}

      <div className="group-inspection-grid">
        <div>
          <h3>EVIDENCE FAMILIES</h3>
          <p className="inspection-copy">SybilKit kept this group because multiple evidence families crossed the configured threshold. A family is a kind of evidence, not a separate witness: the tight peel-chain rule books one transfer as both a funding and a cadence family.</p>
          <div className="inspection-family-strip">
            {cluster.families.map((family) => <span key={family}><i className={`family-mark family-mark--${family}`} />{familyLabel(family)}</span>)}
          </div>
        </div>
        <div>
          <h3>GROUP REASONS</h3>
          <div className="detail-reasons">
            {cluster.reasons.map((reason) => (
              <div key={`${reason.family}-${reason.text}`}>
                <span className={`family-mark family-mark--${reason.family}`} />
                <p><strong>{familyLabel(reason.family)}</strong><span>{reason.text}</span></p>
                <b>{formatPercent(reason.strength)}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="inspection-disclaimer">{disclaimer}</p>
    </section>
  );
}

export function WalletInspectionPanel({ detail, headEntry = null, onClose, onViewCluster, onSelectWallet }: {
  readonly detail: WalletDetail;
  readonly headEntry?: ChangelogEntry | null;
  readonly onClose: () => void;
  readonly onViewCluster: (clusterId: number) => void;
  readonly onSelectWallet: (address: string, clusterId?: number | null) => void;
}) {
  return (
    <section className="map-inspection-panel wallet-inspection" aria-labelledby="wallet-inspection-title">
      <header className="inspection-header">
        <div>
          <span>FULL WALLET DETAILS</span>
          <h2 id="wallet-inspection-title">WALLET DETAILS</h2>
          <AddressLink address={detail.wallet.address} name={detail.wallet.name} />
          <WalletRankComparison
            originalRank={detail.wallet.rank}
            originalPopulation={detail.original_population}
            retainedRank={detail.retained_rank}
            retainedPopulation={detail.retained_population}
            compact
          />
        </div>
        <button type="button" onClick={onClose} aria-label="Close wallet details">CLOSE WALLET ×</button>
      </header>

      <div className="inspection-wallet-grid">
        <div className="wallet-detail-main">
          <div className={`risk-banner risk-banner--${detail.cluster?.risk ?? "independent"}`}>
            <strong>{riskTitle(detail.cluster)}</strong>
            <span>{detail.cluster === null ? "No SybilKit group met the configured threshold" : `${formatPercent(detail.cluster.confidence)} model confidence · ${detail.cluster.families.length} evidence families`}</span>
          </div>
          {detail.cluster?.review_flag ? (
            <div className="false-positive-panel"><strong>POSSIBLE FALSE POSITIVE — REVIEW RECOMMENDED</strong>{detail.cluster.review_reasons.map((reason) => <p key={reason}>{reason}</p>)}</div>
          ) : null}

          <h3>RELATED EVIDENCE</h3>
          {detail.related_edges.length === 0 ? <p className="detail-empty">No direct displayed evidence edge for this wallet.</p> : (
            <div className="detail-edge-list">
              {detail.related_edges.slice(0, 24).map((edge, index) => {
                const other = edge.source === detail.wallet.address ? edge.target : edge.source;
                return (
                  <div key={`${edge.family}-${edge.source}-${edge.target}-${index}`}>
                    <span className={`family-mark family-mark--${edge.family}`} aria-hidden="true" />
                    <span><strong>{familyLabel(edge.family)}</strong><small>{edge.is_transfer ? "Measured transfer" : `${Math.round(edge.strength * 100)}% behavioural signal`}</small></span>
                    <AddressLink address={other} compact />
                    <button type="button" onClick={() => onSelectWallet(other, detail.cluster?.id)}>OPEN</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <aside className="wallet-detail-facts">
          <h3>WALLET FACTS</h3>
          <dl>
            <div><dt>Original rank</dt><dd>#{formatCount(detail.wallet.rank)}</dd></div>
            <div><dt>Cleaned rank</dt><dd>{detail.retained_rank === null ? "Not retained" : `#${formatCount(detail.retained_rank)} of ${formatCount(detail.retained_population)}`}</dd></div>
            <div><dt>Points</dt><dd>{formatCount(detail.wallet.points)}</dd></div>
            <div><dt>Credit</dt><dd>{formatEth(detail.wallet.credit_eth, detail.eth_usd)}</dd></div>
            <div><dt>Weight</dt><dd>{formatEth(detail.wallet.weight_eth, detail.eth_usd)}</dd></div>
            <div><dt>Transactions</dt><dd>{formatCount(detail.wallet.tx_count)}</dd></div>
            <div><dt>First seen</dt><dd>Hour {detail.wallet.first_hour} · #{formatCount(detail.wallet.first_index)}</dd></div>
            <div><dt>First funder</dt><dd>{detail.first_funder === null ? "Not measured" : <AddressLink address={detail.first_funder} compact />}</dd></div>
            <div><dt>Version</dt><dd>{detail.version}</dd></div>
            <div><dt>Group</dt><dd>{detail.cluster === null ? "—" : `${clusterLabel(detail.cluster.id)} · ${detail.version}`}</dd></div>
          </dl>
          {detail.cluster === null ? null : (
            <>
              <h3>WHY THIS GROUP EXISTS</h3>
              <div className="detail-reasons">{detail.cluster.reasons.map((reason) => <div key={`${reason.family}-${reason.text}`}><span className={`family-mark family-mark--${reason.family}`} /><p><strong>{familyLabel(reason.family)}</strong><span>{reason.text}</span></p></div>)}</div>
              <button type="button" className="detail-cluster-action" onClick={() => onViewCluster(detail.cluster!.id)}>VIEW {clusterLabel(detail.cluster.id)} · {detail.version} MAP</button>
            </>
          )}
        </aside>
      </div>
      <WalletVersionHistory history={detail.history} selectedVersion={detail.version} headEntry={headEntry} />
    </section>
  );
}
