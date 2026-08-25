export type EvidenceFamily = "amount" | "sequence" | "cadence" | "gas" | "funding";
export type EvidenceBand = "high" | "low" | "none";
export type RiskTier = "independent" | "review" | "elevated" | "critical";

export interface Reason {
  readonly family: EvidenceFamily;
  readonly text: string;
  readonly strength: number;
}

export interface ClusterSummary {
  readonly id: number;
  readonly size: number;
  readonly confidence: number;
  readonly band: Exclude<EvidenceBand, "none">;
  readonly points: number;
  readonly points_share: number;
  readonly span_blocks: number | null;
  readonly families: readonly EvidenceFamily[];
  readonly reasons: readonly Reason[];
  readonly edge_count: number;
  readonly risk: Exclude<RiskTier, "independent">;
  readonly review_flag: boolean;
  readonly review_reasons: readonly string[];
}

export interface Provenance {
  readonly chain_id: number;
  readonly chain_name: string;
  readonly contract: string;
  readonly deployment_block: number;
  readonly snapshot_block: number;
  readonly snapshot_at: string;
  readonly sybilkit_version: string;
  readonly sybilkit_revision: string;
}

export interface OverviewTotals {
  readonly population: number;
  readonly deposits: number;
  readonly groups: number;
  readonly linked_wallets: number;
  readonly unlinked_wallets: number;
  readonly points: number;
  readonly linked_points: number;
  readonly tx_fingerprints: number;
  readonly funding_rows: number;
}

export interface AnalysisMeta {
  readonly min_size: number;
  readonly min_families: number;
  readonly points_per_eth: number;
  readonly min_deposit_wei: number;
  readonly eth_usd: number | null;
  readonly disclaimer: string;
  /** How to contest what this page says about a wallet. */
  readonly dispute?: {
    readonly text: string;
    readonly audit_url: string;
    readonly contest_url: string;
  };
}

export interface Overview {
  readonly provenance: Provenance;
  readonly totals: OverviewTotals;
  readonly analysis: AnalysisMeta;
  readonly clusters: readonly ClusterSummary[];
}

export interface WalletRow {
  readonly rank: number;
  readonly address: string;
  readonly points: number;
  readonly credit_eth: number;
  readonly tx_count: number;
  readonly name: string | null;
  readonly weight_eth: number;
  readonly first_hour: number;
  readonly first_index: number;
  readonly cluster_id?: number | null;
  readonly evidence_band?: EvidenceBand;
}

export interface ClusterNode {
  readonly id: string;
  readonly address: string;
  readonly rank: number;
  readonly points: number;
  readonly credit_eth: number;
  readonly weight_eth: number;
  readonly tx_count: number;
  readonly first_hour: number;
  readonly first_index: number;
  readonly name: string | null;
}

export interface EvidenceEdge {
  readonly source: string;
  readonly target: string;
  readonly family: EvidenceFamily;
  readonly strength: number;
  readonly reason: string;
  readonly is_transfer: boolean;
}

export interface ClusterDetail {
  readonly cluster: ClusterSummary;
  readonly nodes: readonly ClusterNode[];
  readonly edges: readonly EvidenceEdge[];
}

export interface WalletDetail {
  readonly wallet: WalletRow;
  readonly status: "linked" | "unlinked";
  readonly cluster: ClusterSummary | null;
  /** Evidence families incident on THIS wallet — not its cluster's families. */
  readonly member_families: readonly EvidenceFamily[];
  /** This wallet's own tier: capped at "review" below two incident families. */
  readonly member_risk: RiskTier;
  readonly related_edges: readonly EvidenceEdge[];
  readonly first_funder: string | null;
  readonly explorer_url: string;
  readonly eth_usd: number | null;
}

export interface ListPage {
  readonly rows: readonly WalletRow[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

export interface ListFilters {
  readonly query: string;
  readonly link: "all" | "linked" | "unlinked";
  readonly evidence: "all" | "high" | "low";
  readonly preset: "none" | "first1000" | "hour0" | "whale";
  readonly offset: number;
  readonly limit: number;
}

export interface GlobalMapNode {
  readonly id: string;
  readonly address: string;
  readonly rank: number;
  readonly points: number;
  readonly name: string | null;
  readonly cluster_id: number | null;
  /** The wallet's own tier (see WalletDetail.member_risk). */
  readonly risk: RiskTier;
  /** The tier of the cluster it belongs to, kept so the two can be told apart. */
  readonly cluster_risk: RiskTier;
  readonly member_families: readonly EvidenceFamily[];
  readonly review_flag: boolean;
}

export interface GlobalMapEdge {
  readonly source: string;
  readonly target: string;
  readonly family: EvidenceFamily;
  readonly strength: number;
  readonly risk: Exclude<RiskTier, "independent">;
}

export interface GlobalMap {
  readonly nodes: readonly GlobalMapNode[];
  readonly edges: readonly GlobalMapEdge[];
  readonly meta: {
    readonly node_count: number;
    readonly edge_count: number;
    readonly risk_counts: Readonly<Record<RiskTier, number>>;
    readonly review_cluster_count: number;
    readonly layout: string;
  };
}
