import type { GlobalVisualView } from "../controllers/useMapViewController";
import type { ClusterDetail, GlobalMap, Overview, RiskTier } from "../models/domain";
import { clusterLabel, formatCount, formatPercent } from "../models/presentation";

interface MapSidebarProps {
  readonly overview: Overview;
  readonly globalMap: GlobalMap;
  readonly detail: ClusterDetail | null;
  readonly globalView: GlobalVisualView;
  readonly onGlobal: () => void;
  readonly onCluster: (clusterId: number) => void;
}

const riskLegend: readonly { risk: RiskTier; label: string; detail: string }[] = [
  { risk: "independent", label: "No group link", detail: "Disconnected wallet" },
  { risk: "review", label: "Weak group evidence", detail: "Yellow · manual review" },
  { risk: "elevated", label: "Moderate group evidence", detail: "Orange · more families agree" },
  { risk: "critical", label: "Strong group evidence", detail: "Red · highest evidence tier · not proof of ownership" },
];

export function MapSidebar({ overview, globalMap, detail, globalView, onGlobal, onCluster }: MapSidebarProps) {
  const showingAtlas = detail === null && globalView === "clusters";
  return (
    <aside className="map-sidebar" aria-label="Map legend and groups">
      <div className="sidebar-heading">
        <div>
          <span>EVIDENCE FIELD</span>
          <h2>{detail === null ? (showingAtlas ? "Cluster atlas" : "All wallets") : `${clusterLabel(detail.cluster.id)} · ${detail.version}`}</h2>
        </div>
        <strong>{detail === null ? formatCount(showingAtlas ? overview.totals.groups : globalMap.meta.node_count) : formatCount(detail.cluster.size)}</strong>
      </div>
      <p className="sidebar-copy">
        {showingAtlas
          ? "Each bubble is one SybilKit group. Move right for higher confidence and upward for a larger share of all points; bubble area represents wallet count."
          : "Wallets with the highest points sit closest to the centre. Independent wallets stay green and disconnected; cluster links use the evidence tier of their group."}
      </p>

      {detail?.cluster.review_flag ? (
        <div className="cluster-review-note">
          <strong>POSSIBLE FALSE POSITIVE · REVIEW</strong>
          <span>{detail.cluster.review_reasons.join(" · ")}</span>
        </div>
      ) : null}

      <div className="risk-legend" aria-label="Evidence color legend">
        {riskLegend.filter((item) => !showingAtlas || item.risk !== "independent").map((item) => (
          <div key={item.risk}>
            <span className={`risk-dot risk-dot--${item.risk}`} aria-hidden="true" />
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
          </div>
        ))}
        <div>
          <span className="risk-dot risk-dot--false-positive" aria-hidden="true" />
          <strong>Possible false positive</strong>
          <small>Dashed ring · weaker evidence structure</small>
        </div>
      </div>

      <div className="map-facts">
        <div><span>{showingAtlas ? "Groups" : "Evidence links"}</span><strong>{formatCount(showingAtlas ? overview.totals.groups : globalMap.meta.edge_count)}</strong></div>
        <div><span>Review groups</span><strong>{formatCount(globalMap.meta.review_cluster_count)}</strong></div>
        <div><span>{showingAtlas ? "Linked wallets" : "Independent"}</span><strong>{formatCount(showingAtlas ? overview.totals.linked_wallets : globalMap.meta.risk_counts.independent)}</strong></div>
      </div>

      <div className="top-clusters">
        <div className="top-clusters__title"><span>{showingAtlas ? "HIGHEST IMPACT" : "LARGEST GROUPS"}</span>{detail === null ? null : <button type="button" onClick={onGlobal}>GLOBAL MAP</button>}</div>
        {overview.clusters.slice(0, 8).map((cluster) => (
          <button type="button" key={cluster.id} className={detail?.cluster.id === cluster.id ? "is-active" : ""} onClick={() => onCluster(cluster.id)}>
            <span className={`risk-dot risk-dot--${cluster.risk}`} aria-hidden="true" />
            <span><strong>{clusterLabel(cluster.id)} · {overview.version.id}</strong><small>{formatCount(cluster.size)} wallets{cluster.review_flag ? " · review" : ""}</small></span>
            <b>{formatPercent(cluster.points_share)}</b>
          </button>
        ))}
      </div>
      <p className="evidence-disclaimer">{overview.analysis.disclaimer}</p>
    </aside>
  );
}
