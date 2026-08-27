import { AUDITED_V2H_DIFF } from "../models/analysisDiffSummary";

export function AnalysisDiffSummary() {
  return (
    <section className="analysis-diff-summary" aria-labelledby="analysis-diff-title">
      <header className="analysis-diff-summary__header">
        <span>AUDITED RULESET DIFF</span>
        <h2 id="analysis-diff-title">WHAT CHANGED</h2>
        <p>
          Same {AUDITED_V2H_DIFF.population}-wallet snapshot. New evidence rules,
          new per-wallet outcomes.
        </p>
        <code>{AUDITED_V2H_DIFF.base} → {AUDITED_V2H_DIFF.head}</code>
        <nav aria-label="V2h audit sources">
          <a href={AUDITED_V2H_DIFF.reportUrl} target="_blank" rel="noreferrer">FULL AUDIT ↗</a>
          <a href={AUDITED_V2H_DIFF.reproduceUrl} target="_blank" rel="noreferrer">REPRODUCE ↗</a>
        </nav>
      </header>

      <div className="analysis-diff-summary__primary-metric">
        <p>
          <span>{AUDITED_V2H_DIFF.primaryMetric.label}</span>
          <small>{AUDITED_V2H_DIFF.primaryMetric.detail}</small>
        </p>
        <strong>
          <span className="analysis-diff-summary__primary-value--from">
            {AUDITED_V2H_DIFF.primaryMetric.fromValue}
          </span>
          <span aria-hidden="true"> → </span>
          <span>{AUDITED_V2H_DIFF.primaryMetric.toValue}</span>
        </strong>
      </div>

      <dl className="analysis-diff-summary__comparisons">
        {AUDITED_V2H_DIFF.comparisonMetrics.map((metric) => (
          <div key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
            <small>{metric.detail}</small>
          </div>
        ))}
      </dl>

      <dl className="analysis-diff-summary__metrics">
        {AUDITED_V2H_DIFF.metrics.map((metric) => (
          <div key={metric.label} data-tone={metric.tone}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
            <small>{metric.detail}</small>
          </div>
        ))}
      </dl>

      <div className="analysis-diff-summary__sections">
        {AUDITED_V2H_DIFF.sections.map((section) => (
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
