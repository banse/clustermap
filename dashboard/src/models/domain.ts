export type EvidenceFamily = "amount" | "sequence" | "cadence" | "gas" | "funding";
export type EvidenceBand = "high" | "low" | "none";
export type RiskTier = "independent" | "review" | "elevated" | "critical";
export type WalletStatus = "clean" | "review" | "flagged";
export type DeltaClass = "improved" | "worsened" | "under_review" | "unchanged";

export interface AnalysisVersion {
  readonly id: string;
  readonly label: string;
  readonly at: string;
  readonly stage: "published" | "candidate" | string;
  readonly summary: string;
  readonly detector: string;
  readonly detector_version: string;
  readonly rule_set: string;
  readonly snapshot_block: number;
  readonly commit: string;
  readonly tag: string | null;
  readonly reproduce_command: string;
  readonly content_hash: string;
  readonly published: boolean;
  readonly status_counts: Readonly<Record<WalletStatus, number>>;
  readonly cluster_count: number;
}

export interface VersionsResponse {
  readonly published_version: string;
  readonly versions: readonly AnalysisVersion[];
}

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
  readonly status_counts: Readonly<Record<WalletStatus, number>>;
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
  readonly version: AnalysisVersion;
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
  readonly version?: string;
  readonly status?: WalletStatus;
  readonly risk?: RiskTier;
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
  readonly status: WalletStatus;
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
  readonly version: string;
  readonly cluster: ClusterSummary;
  readonly nodes: readonly ClusterNode[];
  readonly edges: readonly EvidenceEdge[];
}

export interface WalletDetail {
  readonly version: string;
  readonly wallet: WalletRow;
  readonly status: "linked" | "unlinked";
  readonly analysis_status: WalletStatus;
  readonly cluster: ClusterSummary | null;
  /** Evidence families incident on THIS wallet — not its cluster's families. */
  readonly member_families: readonly EvidenceFamily[];
  /** This wallet's own tier: capped at "review" below two incident families. */
  readonly member_risk: RiskTier;
  readonly related_edges: readonly EvidenceEdge[];
  readonly history: readonly WalletVersionHistory[];
  readonly first_funder: string | null;
  readonly explorer_url: string;
  readonly eth_usd: number | null;
}

export interface WalletVersionHistory {
  readonly version: string;
  readonly label: string;
  readonly at: string;
  readonly address: string;
  readonly status: WalletStatus;
  readonly cluster_id: number | null;
  readonly member_families: readonly EvidenceFamily[];
  readonly risk: RiskTier;
  readonly cluster_risk: RiskTier;
}

export interface ListPage {
  readonly version: string;
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
  readonly status: WalletStatus;
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
  readonly cluster_risk: Exclude<RiskTier, "independent">;
}

export interface GlobalMap {
  readonly version: string;
  readonly nodes: readonly GlobalMapNode[];
  readonly edges: readonly GlobalMapEdge[];
  readonly meta: {
    readonly node_count: number;
    readonly edge_count: number;
    readonly risk_counts: Readonly<Record<RiskTier, number>>;
    readonly status_counts: Readonly<Record<WalletStatus, number>>;
    readonly review_cluster_count: number;
    readonly layout: string;
  };
}

export type ChangelogKind = "chain" | "analysis" | "publication" | "context";

export interface ChangelogEntry {
  readonly id: string;
  readonly kind: ChangelogKind;
  readonly at: string;
  readonly block: number | null;
  readonly title: string;
  readonly summary: string;
  readonly version?: string;
  readonly delta?: { readonly base: string; readonly head: string };
  readonly links: readonly { readonly label: string; readonly url: string }[];
}

export interface ChangelogResponse {
  readonly entries: readonly ChangelogEntry[];
  readonly total: number;
  readonly filters: {
    readonly kind: ChangelogKind | null;
    readonly from: string | null;
    readonly to: string | null;
  };
}

export interface ClusterDelta {
  readonly id: number;
  readonly size: number;
  readonly class_counts: Readonly<Record<DeltaClass, number>>;
  readonly base_clusters: readonly { readonly id: number; readonly overlap: number }[];
  readonly is_new: boolean;
}

export interface DeltaPayload {
  readonly base: AnalysisVersion;
  readonly head: AnalysisVersion;
  readonly counts: Readonly<Record<DeltaClass, number>>;
  readonly transitions: Readonly<Record<string, number>>;
  readonly released: number;
  readonly newly_flagged: number;
  /** One class per node, in the exact order returned by the head global map. */
  readonly wallet_classes: readonly DeltaClass[];
  readonly head_clusters: readonly ClusterDelta[];
  readonly dissolved_clusters: readonly {
    readonly id: number;
    readonly size: number;
    readonly points: number;
  }[];
}

export interface ReviewWallet {
  readonly address: string;
  readonly name: string | null;
  readonly points: number;
  readonly rank: number;
  readonly member_families: readonly EvidenceFamily[];
}

export interface ReviewGroup {
  readonly id: number;
  readonly size: number;
  readonly review_count: number;
  readonly review_share: number;
  readonly risk: RiskTier;
  readonly confidence: number;
  readonly families: readonly EvidenceFamily[];
  readonly points_share: number;
  readonly wallets: readonly ReviewWallet[];
}

export interface ReviewPayload {
  readonly version: string;
  readonly totals: {
    readonly review_wallets: number;
    readonly groups_with_review: number;
    readonly groups_total: number;
    readonly population: number;
  };
  readonly groups: readonly ReviewGroup[];
}
