import { formatCount } from "../models/presentation";

interface WalletRankComparisonProps {
  readonly originalRank: number;
  readonly originalPopulation: number;
  readonly retainedRank: number | null;
  readonly retainedPopulation: number;
  readonly compact?: boolean;
}

export function WalletRankComparison({
  originalRank,
  originalPopulation,
  retainedRank,
  retainedPopulation,
  compact = false,
}: WalletRankComparisonProps) {
  const retained = retainedRank !== null;
  return (
    <div
      className={`wallet-rank-comparison${compact ? " wallet-rank-comparison--compact" : ""}`}
      data-retained={retained ? "true" : "false"}
      role="group"
      aria-label={retained
        ? `Original list rank ${originalRank} of ${originalPopulation}; cleaned list rank ${retainedRank} of ${retainedPopulation}`
        : `Original list rank ${originalRank} of ${originalPopulation}; not retained in the cleaned list`}
    >
      <div>
        <span>ORIGINAL LIST RANK</span>
        <strong>#{formatCount(originalRank)}</strong>
        <small>OF {formatCount(originalPopulation)} WALLETS</small>
      </div>
      <i aria-hidden="true">→</i>
      <div>
        <span>CLEANED LIST RANK</span>
        <strong>{retained ? `#${formatCount(retainedRank)}` : "NOT RETAINED"}</strong>
        <small>{retained
          ? `OF ${formatCount(retainedPopulation)} CLEAN + UNDER-REVIEW WALLETS`
          : "FLAGGED IN THIS ANALYSIS VERSION"}</small>
      </div>
    </div>
  );
}
