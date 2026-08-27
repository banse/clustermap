import { SYBILKIT_V2_DIFF } from "../models/analysisDiffSummary";

export function AnalysisDiffSummary() {
  return (
    <section className="analysis-diff-summary" aria-labelledby="analysis-diff-title">
      <header className="analysis-diff-summary__header">
        <span>AUDITED RULESET DIFF</span>
        <h2 id="analysis-diff-title">WHAT CHANGED</h2>
        <p>
          Same {SYBILKIT_V2_DIFF.population}-wallet snapshot. New evidence rules,
          new per-wallet outcomes.
        </p>
        <code>{SYBILKIT_V2_DIFF.base} → {SYBILKIT_V2_DIFF.head}</code>
        <nav aria-label="V2h audit sources">
          <a href={SYBILKIT_V2_DIFF.reportUrl} target="_blank" rel="noreferrer">FULL AUDIT ↗</a>
          <a href={SYBILKIT_V2_DIFF.reproduceUrl} target="_blank" rel="noreferrer">REPRODUCE ↗</a>
        </nav>
      </header>

      <div className="analysis-diff-summary__primary-metric">
        <p>
          <span>{SYBILKIT_V2_DIFF.primaryMetric.label}</span>
          <small>{SYBILKIT_V2_DIFF.primaryMetric.detail}</small>
        </p>
        <strong>
          <span className="analysis-diff-summary__primary-value--from">
            {SYBILKIT_V2_DIFF.primaryMetric.fromValue}
          </span>
          <span aria-hidden="true"> → </span>
          <span>{SYBILKIT_V2_DIFF.primaryMetric.toValue}</span>
        </strong>
      </div>

      <dl className="analysis-diff-summary__comparisons">
        {SYBILKIT_V2_DIFF.comparisonMetrics.map((metric) => (
          <div key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
            <small>{metric.detail}</small>
          </div>
        ))}
      </dl>

      <dl className="analysis-diff-summary__metrics">
        {SYBILKIT_V2_DIFF.metrics.map((metric) => (
          <div key={metric.label} data-tone={metric.tone}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
            <small>{metric.detail}</small>
          </div>
        ))}
      </dl>

      <div className="analysis-diff-summary__sections">
        {SYBILKIT_V2_DIFF.sections.map((section) => (
          <article key={section.eyebrow}>
            <span>{section.eyebrow}</span>
            <h3>{section.title}</h3>
            {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.facts === undefined ? null : (
              <ul>
                {section.facts.map((fact) => <li key={fact}>{fact}</li>)}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
