import { useEffect, useState } from "react";

import type { ReviewGroup, ReviewPayload, WalletDetail } from "../models/domain";
import {
  clusterLabel,
  familyLabel,
  formatCount,
  formatPercent,
  riskLabel,
} from "../models/presentation";
import { AddressLink } from "./AddressLink";
import { ReviewWalletDetail } from "./ReviewWalletDetail";

const INITIAL_WALLETS = 12;

interface ReviewPageProps {
  readonly review: ReviewPayload | null;
  readonly loading: boolean;
  readonly walletDetail: WalletDetail | null;
  readonly walletLoading: boolean;
  readonly onSelectWallet: (address: string) => void | Promise<unknown>;
}

/**
 * Groups are ordered by the share of themselves under review, not by member
 * count, because that is the difference the tier actually encodes: a group that
 * is 73% review is largely built on thin evidence, while a group that is 0.1%
 * review has a solid core and one wallet at its edge. Same tier, different
 * claim — ordering by count would put the second one first.
 */
function ReviewGroupCard({ group, selectedAddress, onSelectWallet }: {
  readonly group: ReviewGroup;
  readonly selectedAddress: string | null;
  readonly onSelectWallet: (address: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? group.wallets : group.wallets.slice(0, INITIAL_WALLETS);
  const remaining = group.wallets.length - shown.length;

  return (
    <article className="review-group">
      <header>
        <div className="review-group__identity">
          <h3>{clusterLabel(group.id)}</h3>
          <span className="review-group__tier" data-risk={group.risk}>
            {riskLabel(group.risk)}
          </span>
        </div>
        <p className="review-group__ratio">
          <strong>{formatCount(group.review_count)}</strong>
          <span> of {formatCount(group.size)} members under review</span>
        </p>
        <div
          className="review-group__meter"
          role="img"
          aria-label={`${formatPercent(group.review_share)} of this group is under review`}
        >
          <span style={{ inlineSize: `${Math.max(group.review_share * 100, 1)}%` }} />
        </div>
        <p className="review-group__share">{formatPercent(group.review_share)} of the group</p>
        <ul className="review-group__families">
          {group.families.map((family) => (
            <li key={family}>{familyLabel(family)}</li>
          ))}
        </ul>
      </header>

      <table className="review-group__wallets">
        <caption className="visually-hidden">
          Wallets under review in {clusterLabel(group.id)}
        </caption>
        <thead>
          <tr>
            <th scope="col">Wallet</th>
            <th scope="col">Evidence touching this wallet</th>
            <th scope="col">Points</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((wallet) => {
            const selected = wallet.address === selectedAddress;
            return (
              <tr
                key={wallet.address}
                tabIndex={0}
                aria-selected={selected}
                data-selected={selected || undefined}
                onClick={() => onSelectWallet(wallet.address)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  onSelectWallet(wallet.address);
                }}
              >
                <td>
                  <AddressLink address={wallet.address} name={wallet.name} compact />
                </td>
                <td>
                  {wallet.member_families.length === 0
                    ? "No family touches it directly"
                    : wallet.member_families.map(familyLabel).join(" · ")}
                </td>
                <td className="review-group__points">{formatCount(wallet.points)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {remaining > 0 || expanded ? (
        <button type="button" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Show fewer" : `Show ${formatCount(remaining)} more`}
        </button>
      ) : null}
    </article>
  );
}

export function ReviewPage({
  review,
  loading,
  walletDetail,
  walletLoading,
  onSelectWallet,
}: ReviewPageProps) {
  const [requestedAddress, setRequestedAddress] = useState<string | null>(null);
  const groups = review?.groups ?? [];
  const selections = groups.flatMap((group) => (
    group.wallets.map((wallet) => ({ group, wallet }))
  ));
  const selected = selections.find(({ wallet }) => wallet.address === requestedAddress)
    ?? selections[0]
    ?? null;

  useEffect(() => {
    if (selected === null) return;
    void onSelectWallet(selected.wallet.address);
  }, [onSelectWallet, review?.version, selected?.wallet.address]);

  if (loading && review === null) {
    return <p className="review-page__empty">Loading the review tier…</p>;
  }
  if (review === null) {
    return <p className="review-page__empty">The review tier is unavailable.</p>;
  }

  const { totals } = review;

  return (
    <section className="review-page" aria-labelledby="review-title">
      <div className={`review-page__layout${selected === null ? " review-page__layout--empty" : ""}`}>
        <div className="review-page__master">
          <header className="review-page__header">
            <span>SHOWN, NEVER REMOVED</span>
            <h2 id="review-title">UNDER REVIEW</h2>
            {totals.review_wallets === 0 ? (
              <p>
                This analysis has no review tier: everything it flags, it removes. The tier exists
                in SybilKit 0.2.0, where a wallet the evidence barely touches is shown rather than
                taken off the list. Switch versions to see it.
              </p>
            ) : (
              <>
                <p>
                  <strong>{formatCount(totals.review_wallets)} wallets</strong> sit in{" "}
                  {formatCount(totals.groups_with_review)} of {formatCount(totals.groups_total)}{" "}
                  groups. They sit outside their group's core pattern, so they stay visible and
                  are never removed from the list. Select a wallet to inspect why.
                </p>
                <p className="review-page__note">
                  This is where the analysis is least confident, which makes it the part most worth
                  contesting. Groups are ordered by how much of the group is under review — a group
                  that is mostly review rests on thin evidence throughout, while one wallet under
                  review inside a large group is a single member at its edge.
                </p>
              </>
            )}
          </header>

          {groups.length === 0 ? null : (
            <div className="review-page__groups">
              {groups.map((group) => (
                <ReviewGroupCard
                  key={group.id}
                  group={group}
                  selectedAddress={selected?.wallet.address ?? null}
                  onSelectWallet={setRequestedAddress}
                />
              ))}
            </div>
          )}
        </div>

        {selected === null ? null : (
          <ReviewWalletDetail
            wallet={selected.wallet}
            group={selected.group}
            detail={walletDetail}
            loading={walletLoading}
          />
        )}
      </div>
    </section>
  );
}
