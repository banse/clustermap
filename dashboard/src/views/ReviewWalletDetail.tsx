import type {
  EvidenceEdge,
  EvidenceFamily,
  RiskTier,
  WalletDetail,
} from "../models/domain";
import {
  clusterLabel,
  familyLabel,
  formatCount,
  formatEth,
  formatPercent,
  riskLabel,
} from "../models/presentation";
import { AddressLink } from "./AddressLink";
import { WalletRankComparison } from "./WalletRankComparison";

const MAX_GRAPH_RELATIONS = 8;
const MAX_LISTED_EDGES = 16;

interface ReviewWalletDetailProps {
  readonly wallet: ReviewWalletSummary;
  readonly group: ReviewGroupSummary;
  readonly detail: WalletDetail | null;
  readonly loading: boolean;
  readonly embedded?: boolean;
  readonly status?: EvidenceWalletStatus;
}

type EvidenceWalletStatus = "review" | "flagged";

interface ReviewWalletSummary {
  readonly address: string;
  readonly name: string | null;
  readonly rank: number;
  readonly member_families: readonly EvidenceFamily[];
}

interface ReviewGroupSummary {
  readonly id: number;
  readonly risk: RiskTier;
}

interface RelatedWallet {
  readonly address: string;
  readonly edges: readonly EvidenceEdge[];
  readonly primaryFamily: EvidenceFamily;
  readonly hasTransfer: boolean;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function otherAddress(edge: EvidenceEdge, selectedAddress: string): string {
  return edge.source.toLowerCase() === selectedAddress.toLowerCase()
    ? edge.target
    : edge.source;
}

function relatedWallets(detail: WalletDetail): readonly RelatedWallet[] {
  const grouped = new Map<string, EvidenceEdge[]>();
  for (const edge of detail.related_edges) {
    const address = otherAddress(edge, detail.wallet.address);
    grouped.set(address, [...(grouped.get(address) ?? []), edge]);
  }
  return [...grouped.entries()]
    .map(([address, edges]) => ({
      address,
      edges,
      primaryFamily: edges[0].family,
      hasTransfer: edges.some((edge) => edge.is_transfer),
    }))
    .sort((left, right) => (
      Math.max(...right.edges.map((edge) => edge.strength))
      - Math.max(...left.edges.map((edge) => edge.strength))
    ))
    .slice(0, MAX_GRAPH_RELATIONS);
}

function evidenceExplanation(
  wallet: ReviewWalletSummary,
  status: EvidenceWalletStatus,
): string {
  const count = wallet.member_families.length;
  if (status === "flagged") {
    if (count === 0) {
      return "This analysis places the wallet in the flagged tier through its kept group, but no displayed evidence family touches it directly. The group decision depends on links among other members.";
    }
    if (count === 1) {
      return `This analysis places the wallet in the flagged tier through its kept group. ${familyLabel(wallet.member_families[0])} touches it directly; the wider group decision also depends on links among other members.`;
    }
    return `${formatCount(count)} evidence families touch this wallet directly, and this analysis places it in the flagged tier as part of the kept group. The traces below list its exact incident links.`;
  }
  if (count === 0) {
    return "No displayed evidence family touches this wallet directly. It appears only at the edge of a kept group, so it remains visible for review and is not placed in the flagged tier.";
  }
  if (count === 1) {
    return `Only ${familyLabel(wallet.member_families[0]).toLowerCase()} touches this wallet directly. One family is below the two-family presentation gate, so it remains visible for review and is not placed in the flagged tier.`;
  }
  return `${formatCount(count)} evidence families touch this wallet, but it still falls outside the detector's core pattern. The weak peripheral match remains visible for review and is not placed in the flagged tier.`;
}

function DirectEvidenceMap({ detail }: { readonly detail: WalletDetail }) {
  const relations = relatedWallets(detail);
  if (relations.length === 0) {
    return (
      <div className="review-detail__graph-empty">
        No direct displayed edge. The wallet is connected only through the wider group structure.
      </div>
    );
  }

  const centreX = 300;
  const centreY = 155;
  const radiusX = 218;
  const radiusY = 105;

  return (
    <div className="review-evidence-map">
      <svg viewBox="0 0 600 310" role="img" aria-labelledby="review-graph-title review-graph-description">
        <title id="review-graph-title">Direct evidence connections for {detail.wallet.address}</title>
        <desc id="review-graph-description">
          The selected wallet is in the centre. Solid lines are measured transfers; dashed lines are behavioural similarities. Line colour identifies the evidence family.
        </desc>
        <g className="review-evidence-map__grid" aria-hidden="true">
          <line x1="28" y1={centreY} x2="572" y2={centreY} />
          <line x1={centreX} y1="18" x2={centreX} y2="292" />
          <ellipse cx={centreX} cy={centreY} rx={radiusX} ry={radiusY} />
        </g>
        {relations.map((relation, index) => {
          const angle = -Math.PI / 2 + (index * Math.PI * 2) / relations.length;
          const x = centreX + Math.cos(angle) * radiusX;
          const y = centreY + Math.sin(angle) * radiusY;
          return (
            <g key={relation.address}>
              <line
                className={`review-evidence-map__edge review-evidence-map__edge--${relation.primaryFamily}${relation.hasTransfer ? " review-evidence-map__edge--transfer" : ""}`}
                x1={centreX}
                y1={centreY}
                x2={x}
                y2={y}
              >
                <title>{relation.edges.map((edge) => `${familyLabel(edge.family)}: ${edge.reason}`).join("; ")}</title>
              </line>
              <circle className="review-evidence-map__node" cx={x} cy={y} r="8" />
              <text
                className="review-evidence-map__label"
                x={x}
                y={y + (y < centreY ? -14 : 23)}
                textAnchor="middle"
              >
                {shortAddress(relation.address)}
              </text>
            </g>
          );
        })}
        <circle className="review-evidence-map__selected-ring" cx={centreX} cy={centreY} r="27" />
        <circle className="review-evidence-map__selected" cx={centreX} cy={centreY} r="12" />
        <text className="review-evidence-map__selected-label" x={centreX} y={centreY + 44} textAnchor="middle">
          SELECTED · {shortAddress(detail.wallet.address)}
        </text>
      </svg>
      <div className="review-evidence-map__legend">
        <span><i className="review-line review-line--transfer" />Measured transfer</span>
        <span><i className="review-line" />Behavioural match</span>
        {detail.member_families.map((family) => (
          <span key={family}><i className={`family-mark family-mark--${family}`} />{familyLabel(family)}</span>
        ))}
      </div>
    </div>
  );
}

export function ReviewWalletDetail({
  wallet,
  group,
  detail,
  loading,
  embedded = false,
  status = "review",
}: ReviewWalletDetailProps) {
  const resolved = detail?.wallet.address.toLowerCase() === wallet.address.toLowerCase()
    ? detail
    : null;

  return (
    <aside
      className={`review-detail${embedded ? " review-detail--profile" : ""} review-detail--status-${status} review-detail--risk-${resolved?.member_risk ?? "review"}`}
      aria-labelledby="review-detail-title"
      aria-live="polite"
    >
      <header className={`review-detail__header${embedded ? " review-detail__header--profile" : ""}`}>
        <span>{embedded ? `THIS WALLET · ${status === "flagged" ? "FLAGGED" : "UNDER REVIEW"}` : "SELECTED WALLET · UNDER REVIEW"}</span>
        {embedded ? (
          <>
            <h3 id="review-detail-title">
              {status === "flagged" ? "FLAGGED WALLET EVIDENCE" : "UNDER REVIEW EVIDENCE"}
            </h3>
            <p>
              {status === "flagged"
                ? "The direct connections and patterns associated with this wallet inside its kept group."
                : "The direct connections and patterns that placed this wallet at the edge of its group."}
            </p>
          </>
        ) : (
          <>
            <h2 id="review-detail-title">RANK #{formatCount(wallet.rank)}</h2>
            <AddressLink address={wallet.address} name={wallet.name} />
            {resolved === null ? null : (
              <WalletRankComparison
                originalRank={resolved.wallet.rank}
                originalPopulation={resolved.original_population}
                retainedRank={resolved.retained_rank}
                retainedPopulation={resolved.retained_population}
                compact
              />
            )}
          </>
        )}
      </header>

      <section className="review-detail__decision" aria-labelledby="review-decision-title">
        <span>{status === "flagged" ? "WHY IT WAS FLAGGED" : "WHY IT WAS HELD FOR REVIEW"}</span>
        <h3 id="review-decision-title">
          {status === "flagged"
            ? "This analysis places the wallet in the flagged tier."
            : "The group is kept. This wallet is not in its core."}
        </h3>
        <p>{evidenceExplanation(wallet, status)}</p>
        <div>
          <span>
            {formatCount(wallet.member_families.length)} direct {wallet.member_families.length === 1 ? "family" : "families"}
          </span>
          <span>{clusterLabel(group.id)}</span>
          <span>{riskLabel(group.risk)}</span>
        </div>
      </section>

      {loading || resolved === null ? (
        <div className="review-detail__loading">
          <span aria-hidden="true" />
          <p>Reading direct connections and pattern evidence…</p>
        </div>
      ) : (
        <>
          <section className="review-detail__section" aria-labelledby="review-map-title">
            <div className="review-detail__section-title">
              <div><span>VISUAL TRACE</span><h3 id="review-map-title">DIRECT EVIDENCE MAP</h3></div>
              <small>{formatCount(resolved.related_edges.length)} displayed links</small>
            </div>
            <DirectEvidenceMap detail={resolved} />
          </section>

          <section className="review-detail__section" aria-labelledby="review-connections-title">
            <div className="review-detail__section-title">
              <div><span>TEXTUAL TRACE</span><h3 id="review-connections-title">CONNECTIONS &amp; PATTERNS</h3></div>
            </div>
            {resolved.related_edges.length === 0 ? (
              <p className="review-detail__empty">No direct displayed evidence edge for this wallet.</p>
            ) : (
              <div className="review-detail__edge-list">
                {resolved.related_edges.slice(0, MAX_LISTED_EDGES).map((edge, index) => (
                  <article key={`${edge.family}-${edge.source}-${edge.target}-${index}`}>
                    <span className={`family-mark family-mark--${edge.family}`} aria-hidden="true" />
                    <div>
                      <header>
                        <strong>{familyLabel(edge.family)}</strong>
                        <small>{edge.is_transfer ? "ONCHAIN TRANSFER" : `${formatPercent(edge.strength)} BEHAVIOURAL MATCH`}</small>
                      </header>
                      <p>{edge.reason}</p>
                      <span>Linked with <AddressLink address={otherAddress(edge, resolved.wallet.address)} compact /></span>
                    </div>
                  </article>
                ))}
                {resolved.related_edges.length > MAX_LISTED_EDGES ? (
                  <p className="review-detail__truncated">Showing the first {MAX_LISTED_EDGES} of {formatCount(resolved.related_edges.length)} direct evidence links.</p>
                ) : null}
              </div>
            )}
          </section>

          {embedded ? (
            <p className="review-detail__disclaimer review-detail__disclaimer--standalone">
              These reproducible links support this analysis. They do not prove that the wallets share an owner or identity.
            </p>
          ) : (
            <section className="review-detail__section review-detail__context" aria-labelledby="review-context-title">
              <div className="review-detail__section-title">
                <div><span>GROUP CONTEXT</span><h3 id="review-context-title">WHY {clusterLabel(group.id)} EXISTS</h3></div>
              </div>
              <div className="review-detail__group-reasons">
                {resolved.cluster?.reasons.map((reason) => (
                  <article key={`${reason.family}-${reason.text}`}>
                    <span className={`family-mark family-mark--${reason.family}`} aria-hidden="true" />
                    <p><strong>{familyLabel(reason.family)}</strong><span>{reason.text}</span></p>
                    <b>{formatPercent(reason.strength)}</b>
                  </article>
                ))}
              </div>
              <dl className="review-detail__facts">
                <div><dt>Points</dt><dd>{formatCount(resolved.wallet.points)}</dd></div>
                <div><dt>Credit</dt><dd>{formatEth(resolved.wallet.credit_eth, resolved.eth_usd)}</dd></div>
                <div><dt>Transactions</dt><dd>{formatCount(resolved.wallet.tx_count)}</dd></div>
                <div><dt>First seen</dt><dd>Hour {resolved.wallet.first_hour} · #{formatCount(resolved.wallet.first_index)}</dd></div>
                <div><dt>First funder</dt><dd>{resolved.first_funder === null ? "Not measured" : <AddressLink address={resolved.first_funder} compact />}</dd></div>
                <div><dt>Analysis</dt><dd>{resolved.version}</dd></div>
              </dl>
              <p className="review-detail__disclaimer">
                These reproducible links support review. They do not prove that the wallets share an owner or identity.
              </p>
            </section>
          )}
        </>
      )}
    </aside>
  );
}

export function WalletProfileEvidence({ detail }: { readonly detail: WalletDetail }) {
  if (detail.analysis_status === "clean" || detail.cluster === null) return null;
  return (
    <ReviewWalletDetail
      wallet={{
        address: detail.wallet.address,
        name: detail.wallet.name,
        rank: detail.wallet.rank,
        member_families: detail.member_families,
      }}
      group={{ id: detail.cluster.id, risk: detail.cluster.risk }}
      detail={detail}
      loading={false}
      embedded
      status={detail.analysis_status}
    />
  );
}
