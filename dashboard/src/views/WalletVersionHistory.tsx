import type { ChangelogEntry, WalletVersionHistory as WalletVersionHistoryRow } from "../models/domain";
import { clusterLabel, familyLabel, formatCount, statusLabel } from "../models/presentation";

interface WalletVersionHistoryProps {
  readonly history: readonly WalletVersionHistoryRow[];
  readonly selectedVersion: string;
  readonly headEntry?: ChangelogEntry | null;
}

export function WalletVersionHistory({ history, selectedVersion, headEntry = null }: WalletVersionHistoryProps) {
  return (
    <section className="wallet-version-history" aria-labelledby="wallet-history-title">
      <h4 id="wallet-history-title">VERSION HISTORY</h4>
      <div>
        {history.map((row) => (
          <article key={row.version} data-current={row.version === selectedVersion ? "true" : undefined}>
            <header><strong>{row.label}</strong><span>{row.version === selectedVersion ? "SHOWN NOW" : row.version}</span></header>
            <p>{statusLabel(row.status).toUpperCase()}</p>
            <strong className="wallet-version-history__rank">
              CLEANED RANK {row.retained_rank === null
                ? "NOT RETAINED"
                : `#${formatCount(row.retained_rank)} / ${formatCount(row.retained_population)}`}
            </strong>
            <small>{row.cluster_id === null ? "NO CLUSTER" : `${clusterLabel(row.cluster_id)} IN ${row.version}`}</small>
            <div>
              {row.member_families.length === 0
                ? <em>No incident evidence families</em>
                : row.member_families.map((family) => <span key={family}>{familyLabel(family)}</span>)}
            </div>
          </article>
        ))}
      </div>
      {headEntry === null ? null : (
        <article className="wallet-version-history__change">
          <span>CHANGE THAT PRODUCED HEAD</span>
          <strong>{headEntry.title}</strong>
          <p>{headEntry.summary}</p>
        </article>
      )}
    </section>
  );
}
