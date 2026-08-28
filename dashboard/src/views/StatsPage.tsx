import type { QualityStats } from "../models/domain";
import type { ReactNode } from "react";
import {
  formatCount,
  formatPercent,
  formatTimelineDate,
} from "../models/presentation";

interface StatsPageProps {
  readonly stats: QualityStats | null;
  readonly loading: boolean;
}

function PairBar({ raw, retained, max, label }: {
  readonly raw: number;
  readonly retained: number;
  readonly max: number;
  readonly label: string;
}) {
  const width = (value: number) => `${max === 0 ? 0 : Math.max((value / max) * 100, value > 0 ? 2 : 0)}%`;
  return (
    <div className="stats-pair-bar" role="img" aria-label={`${label}: ${formatCount(raw)} raw, ${formatCount(retained)} retained`}>
      <span className="stats-pair-bar__raw" style={{ inlineSize: width(raw) }} />
      <span className="stats-pair-bar__retained" style={{ inlineSize: width(retained) }} />
    </div>
  );
}

function StatSectionHeader({ index, eyebrow, title, children }: {
  readonly index: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <header className="stats-section__header">
      <span>{index} / {eyebrow}</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </header>
  );
}

export function StatsPage({ stats, loading }: StatsPageProps) {
  if (loading && stats === null) {
    return <p className="stats-page__empty">Calculating list quality…</p>;
  }
  if (stats === null) {
    return <p className="stats-page__empty">List quality statistics are unavailable.</p>;
  }

  const { outcome, nft, ladder, maturity } = stats;
  const nftMax = Math.max(1, ...nft.collections.map((collection) => collection.raw_holders));
  const maturityBuckets = ["0", "1-4", "5-19", "20-99", "100+"] as const;
  const ablation = ladder.counterfactual;

  return (
    <section className="stats-page" aria-labelledby="stats-title">
      <header className="stats-page__header">
        <div>
          <span>LIST QUALITY / FILTER AUDIT</span>
          <h2 id="stats-title">WHAT SURVIVES THE FILTER?</h2>
          <p>
            Raw means every wallet in the frozen list. Filtered means wallets that remain:
            clean plus under review. Every measure below follows the selected analysis version.
          </p>
        </div>
        <div className="stats-page__version">
          <span>ACTIVE RULE SET</span>
          <strong>{stats.version.label}</strong>
          <code>{stats.version.rule_set}</code>
        </div>
      </header>

      <section className="stats-outcome" aria-label="Filter outcome">
        <StatSectionHeader index="01" eyebrow="FILTER OUTCOME" title="RAW → RETAINED">
          The filter removes only the flagged tier. Under-review wallets stay visible and stay in the list.
        </StatSectionHeader>
        <div className="stats-outcome__rail" aria-label="Filter outcome">
          <div>
            <span>RAW LIST</span>
            <strong>{formatCount(outcome.raw_wallets)}</strong>
            <small>100% of wallets</small>
          </div>
          <i aria-hidden="true">→</i>
          <div className="stats-outcome__kept">
            <span>RETAINED / FILTERED</span>
            <strong>{formatCount(outcome.retained_wallets)}</strong>
            <small>{formatPercent(outcome.retention_rate)} of wallets</small>
          </div>
          <i aria-hidden="true">+</i>
          <div className="stats-outcome__removed">
            <span>FLAGGED / REMOVED</span>
            <strong>{formatCount(outcome.removed_wallets)}</strong>
            <small>{formatPercent(1 - outcome.retention_rate)} of wallets</small>
          </div>
        </div>
        <dl className="stats-outcome__facts">
          <div><dt>CLEAN RETAINED</dt><dd>{formatCount(outcome.status_counts.clean)}</dd></div>
          <div><dt>UNDER REVIEW RETAINED</dt><dd>{formatCount(outcome.status_counts.review)}</dd></div>
          <div><dt>POINTS RETAINED</dt><dd>{formatPercent(outcome.retained_points_share)}</dd></div>
          <div><dt>POINTS</dt><dd>{formatCount(outcome.raw_points)} → {formatCount(outcome.retained_points)}</dd></div>
        </dl>
      </section>

      <div className="stats-grid">
        <section className="stats-section stats-nft" aria-label="Blue-chip NFT benchmark">
          <StatSectionHeader index="02" eyebrow="BLUE-CHIP NFT BENCHMARK" title="HOLDER RETENTION">
            Current ERC-721 ownership across a fixed eight-collection benchmark. This is a quality cross-check, not identity proof.
          </StatSectionHeader>
          <div className="stats-callout">
            <div><span>UNIQUE RAW HOLDERS</span><strong>{formatCount(nft.raw_unique_holders)}</strong></div>
            <i aria-hidden="true">→</i>
            <div><span>UNIQUE RETAINED</span><strong>{formatCount(nft.retained_unique_holders)}</strong></div>
            <div><span>RETENTION</span><strong>{formatPercent(nft.retention_rate)}</strong></div>
          </div>
          <div className="stats-legend" aria-hidden="true"><span>RAW</span><span>RETAINED</span></div>
          <ul className="stats-nft__rows">
            {nft.collections.map((collection) => (
              <li key={collection.id}>
                <div className="stats-nft__identity">
                  <a href={collection.explorer_url} target="_blank" rel="noreferrer">{collection.name} ↗</a>
                  <code>{collection.contract.slice(0, 8)}…{collection.contract.slice(-6)}</code>
                </div>
                <PairBar raw={collection.raw_holders} retained={collection.retained_holders} max={nftMax} label={`${collection.name} holders`} />
                <p><strong>{formatCount(collection.raw_holders)}</strong><span>→</span><strong>{formatCount(collection.retained_holders)}</strong></p>
              </li>
            ))}
          </ul>
          <p className="stats-provenance">
            OBSERVED AT ETHEREUM BLOCK {formatCount(nft.observed_block)} · {formatTimelineDate(nft.observed_at)} · BALANCEOF SNAPSHOT
          </p>
        </section>

        <section className="stats-section stats-ladder" aria-label="Natural deposit ladder">
          <StatSectionHeader index="03" eyebrow="NATURAL DEPOSIT LADDER" title="0.05 → 0.15 → 0.25 → …">
            {ladder.definition} The counterfactual removes only matching amount edges; every other signal stays active.
          </StatSectionHeader>
          <div className="stats-ladder__rungs" role="img" aria-label="Natural minimum deposit ladder: 0.05, 0.15, 0.25, 0.35 Ether and onward">
            {["0.05", "0.15", "0.25", "0.35", "…"].map((amount, index) => (
              <span key={amount} style={{ inlineSize: `${54 + index * 10}%` }}>{amount}{amount === "…" ? "" : " ETH"}</span>
            ))}
          </div>
          <div className="stats-ladder__total">
            <span>WALLETS WITH EXACT PATTERN</span><strong>{formatCount(ladder.pattern_wallets)}</strong>
          </div>
          <dl className="stats-status-split">
            <div><dt>CLEAN</dt><dd>{formatCount(ladder.status_counts.clean)}</dd></div>
            <div><dt>UNDER REVIEW</dt><dd>{formatCount(ladder.status_counts.review)}</dd></div>
            <div><dt>FLAGGED</dt><dd>{formatCount(ladder.status_counts.flagged)}</dd></div>
          </dl>
          {ablation === null ? (
            <div className="stats-ablation stats-ablation--empty">
              <span>COUNTERFACTUAL</span>
              <strong>NOT AVAILABLE FOR THIS HISTORICAL RULE SET</strong>
              <p>Switch to the SybilKit 0.2.0 version for the measured ladder ablation.</p>
            </div>
          ) : (
            <div className="stats-ablation">
              <span>IF EXACT NATURAL-LADDER AMOUNT EDGES ARE IGNORED</span>
              <strong>{formatCount(ablation.no_longer_flagged)} wallets would no longer be flagged</strong>
              <p>
                {formatCount(ablation.pattern_wallets_no_longer_flagged)} have the exact pattern ·
                {" "}{formatCount(ablation.removed_edges)} matching edges removed ·
                {" "}{formatCount(ablation.newly_flagged)} newly flagged
              </p>
              <div><span>FLAGGED NOW</span><b>{formatCount(outcome.removed_wallets)}</b><i>→</i><span>WITHOUT THIS PATTERN</span><b>{formatCount(ablation.flagged_wallets)}</b></div>
            </div>
          )}
        </section>

        <section className="stats-section stats-maturity" aria-label="Wallet maturity">
          <StatSectionHeader index="04" eyebrow="WALLET MATURITY" title="PRIOR TRANSACTIONS AT ENTRY">
            True first-ever wallet timestamps are not present in the frozen data. Nonce measures prior outgoing transactions instead.
          </StatSectionHeader>
          <div className="stats-maturity__median">
            <div><span>RAW MEDIAN</span><strong>{formatCount(maturity.raw.median_prior_transactions)}</strong><small>prior transactions</small></div>
            <i aria-hidden="true">→</i>
            <div><span>RETAINED MEDIAN</span><strong>{formatCount(maturity.retained.median_prior_transactions)}</strong><small>prior transactions</small></div>
          </div>
          <div className="stats-legend" aria-hidden="true"><span>RAW SHARE</span><span>RETAINED SHARE</span></div>
          <ul className="stats-maturity__buckets">
            {maturityBuckets.map((bucket) => {
              const raw = maturity.raw.buckets[bucket];
              const retained = maturity.retained.buckets[bucket];
              const rawShare = raw / maturity.raw.wallets;
              const retainedShare = retained / maturity.retained.wallets;
              return (
                <li key={bucket}>
                  <span>{bucket} TX</span>
                  <PairBar raw={rawShare} retained={retainedShare} max={1} label={`${bucket} prior transactions: ${formatPercent(rawShare)} raw share, ${formatPercent(retainedShare)} retained share`} />
                  <p><strong>{formatPercent(rawShare)}</strong><span>→</span><strong>{formatPercent(retainedShare)}</strong></p>
                </li>
              );
            })}
          </ul>
          <p className="stats-provenance">ENTRY NONCE COVERAGE · {formatPercent(maturity.coverage)} · {maturity.interpretation}</p>
        </section>

        <section className="stats-section stats-controls" aria-label="Known signal retention">
          <StatSectionHeader index="05" eyebrow="COLLATERAL CHECKS" title="KNOWN-SIGNAL RETENTION">
            Independent quality controls show what share of named or separately verified wallets the selected filter keeps.
          </StatSectionHeader>
          <div className="stats-controls__table" role="table" aria-label="Known signal retention">
            <div role="row" className="stats-controls__head"><span role="columnheader">CONTROL</span><span role="columnheader">RAW</span><span role="columnheader">RETAINED</span><span role="columnheader">RATE</span></div>
            {stats.controls.map((control) => (
              <div role="row" key={control.id}>
                <span role="cell"><strong>{control.label}</strong><small>{control.meaning}</small></span>
                <span role="cell">{formatCount(control.raw_wallets)}</span>
                <span role="cell">{formatCount(control.retained_wallets)}</span>
                <span role="cell">{formatPercent(control.retention_rate)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <footer className="stats-page__footnote">
        <strong>READ THIS AS A FILTER AUDIT, NOT A PERSONHOOD SCORE.</strong>
        <span>{stats.disclaimer}</span>
      </footer>
    </section>
  );
}
