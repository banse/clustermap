import type { DeltaClass, DeltaPayload } from "../models/domain";
import { DELTA_CLASSES } from "../models/delta";
import { clusterLabel, deltaLabel, formatCount } from "../models/presentation";

interface DeltaPanelProps {
  readonly delta: DeltaPayload;
  readonly filter: DeltaClass | "all";
  readonly onFilter: (value: DeltaClass | "all") => void;
}

export function DeltaPanel({ delta, filter, onFilter }: DeltaPanelProps) {
  return (
    <section className="delta-panel" aria-label="Version delta">
      <header>
        <div>
          <span>DIRECTIONAL DELTA</span>
          <strong>{delta.base.label} <b aria-hidden="true">→</b> {delta.head.label}</strong>
        </div>
        <p><b>{formatCount(delta.released)}</b> released · <b>{formatCount(delta.newly_flagged)}</b> newly flagged</p>
      </header>
      <div className="delta-panel__classes" role="group" aria-label="Filter delta classes">
        <button type="button" aria-pressed={filter === "all"} onClick={() => onFilter("all")}>
          <span>ALL</span><strong>{formatCount(delta.wallet_classes.length)}</strong>
        </button>
        {DELTA_CLASSES.map((value) => (
          <button
            key={value}
            type="button"
            className={`delta-key delta-key--${value}`}
            aria-pressed={filter === value}
            onClick={() => onFilter(value)}
          >
            <span>{deltaLabel(value).toUpperCase()}</span>
            <strong>{formatCount(delta.counts[value])}</strong>
          </button>
        ))}
      </div>
      {delta.dissolved_clusters.length === 0 ? null : (
        <details className="delta-panel__dissolved">
          <summary>{formatCount(delta.dissolved_clusters.length)} DISSOLVED BASE CLUSTERS</summary>
          <div>
            {delta.dissolved_clusters.map((cluster) => (
              <span key={cluster.id}>{clusterLabel(cluster.id)} · {delta.base.id} · {formatCount(cluster.size)} wallets</span>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
