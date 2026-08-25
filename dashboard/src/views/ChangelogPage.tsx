import { useChangelogController } from "../controllers/useChangelogController";
import type { ChangelogEntry } from "../models/domain";
import { formatCount, formatTimelineDate } from "../models/presentation";

interface ChangelogPageProps {
  readonly entries: readonly ChangelogEntry[];
}

export function ChangelogPage({ entries }: ChangelogPageProps) {
  const controller = useChangelogController(entries);
  return (
    <section className="changelog-page" aria-labelledby="changelog-title">
      <header className="changelog-page__header">
        <div>
          <span>PUBLIC ASSERTION RECORD</span>
          <h2 id="changelog-title">CHANGE LOG</h2>
          <p>Immutable chain events and every dated change to what CLUSTERMAP asserts.</p>
        </div>
        <div className="changelog-filters" aria-label="Change log filters">
          <label>
            <span>KIND</span>
            <select value={controller.kind} onChange={(event) => controller.setKind(event.target.value as typeof controller.kind)}>
              <option value="all">All entries</option>
              <option value="chain">Chain</option>
              <option value="analysis">Analysis</option>
              <option value="publication">Publication</option>
              <option value="context">Context</option>
            </select>
          </label>
          <label><span>FROM</span><input type="date" value={controller.from} onChange={(event) => controller.setFrom(event.target.value)} /></label>
          <label><span>TO</span><input type="date" value={controller.to} onChange={(event) => controller.setTo(event.target.value)} /></label>
          <button type="button" onClick={controller.reset}>RESET</button>
        </div>
      </header>
      <p className="changelog-page__count">{formatCount(controller.entries.length)} OF {formatCount(entries.length)} ENTRIES</p>
      <ol className="changelog-timeline">
        {controller.entries.map((entry) => (
          <li key={entry.id} className={`changelog-entry changelog-entry--${entry.kind}`}>
            <div className="changelog-entry__rail"><i aria-hidden="true" /><span>{entry.kind.toUpperCase()}</span></div>
            <article>
              <header>
                <time dateTime={entry.at}>{formatTimelineDate(entry.at)}</time>
                {entry.block === null ? null : <b>BLOCK {formatCount(entry.block)}</b>}
              </header>
              <h3>{entry.title}</h3>
              <p>{entry.summary}</p>
              {entry.version === undefined ? null : <code>VERSION {entry.version}</code>}
              {entry.links.length === 0 ? null : (
                <nav aria-label={`Links for ${entry.title}`}>
                  {entry.links.map((link) => (
                    <a key={`${entry.id}-${link.label}`} href={link.url}>{link.label} ↗</a>
                  ))}
                </nav>
              )}
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}
