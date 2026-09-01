import { buildAlgorithmPresentation, type AlgorithmPresentation } from "../models/algorithmPresentation";
import type { Overview } from "../models/domain";

export interface HowAlgorithmWorksPageProps {
  readonly overview: Overview;
}

function RuleAtlas({ model }: { readonly model: AlgorithmPresentation }) {
  if (model.rules.length === 0) {
    return (
      <div className="algorithm-page__no-detector">
        <strong>{model.ruleState}</strong>
        <p>This raw contract-list view preserves the frozen population without inventing detector rules, edges, groups, confidence, or review outcomes.</p>
      </div>
    );
  }

  return (
    <div className="algorithm-page__rules" role="list" aria-label="Active concrete evidence rules">
      {model.rules.map((rule) => {
        const titleId = `algorithm-rule-${rule.id}`;
        return (
          <article key={rule.id} role="article" aria-labelledby={titleId}>
            <header>
              <h3 id={titleId}>{rule.label}</h3>
              <code>{rule.id}</code>
            </header>
            <div className="algorithm-page__families" aria-label={`Evidence families for ${rule.label}`}>
              {rule.families.map((family) => <span key={family} data-family={family}>{family.toUpperCase()}</span>)}
            </div>
            {rule.pairedFamilies ? <strong>PAIRED OUTPUT · ONE CONCEPTUAL RULE</strong> : null}
            <p>{rule.threshold}</p>
            <small>{rule.meaning}</small>
          </article>
        );
      })}
    </div>
  );
}

function ReproducibilityLinks({ model }: { readonly model: AlgorithmPresentation }) {
  return (
    <div className="algorithm-page__reproducibility">
      <dl>
        <div><dt>DETECTOR</dt><dd>{model.provenance.detector} {model.provenance.detectorVersion}</dd></div>
        <div><dt>RULE SET</dt><dd>{model.provenance.ruleSet}</dd></div>
        <div><dt>ANALYSIS COMMIT</dt><dd><code>{model.provenance.analysisCommit}</code></dd></div>
        {model.provenance.detectorRevision === null ? null : (
          <div><dt>DETECTOR REVISION</dt><dd><code>{model.provenance.detectorRevision}</code></dd></div>
        )}
        {model.provenance.rulesFile === null ? null : (
          <div><dt>RULES FILE</dt><dd><code>{model.provenance.rulesFile}</code></dd></div>
        )}
        {model.provenance.rulesSha256 === null ? null : (
          <div><dt>RULES SHA-256</dt><dd><code>{model.provenance.rulesSha256}</code></dd></div>
        )}
        <div><dt>CONTENT HASH</dt><dd><code>{model.provenance.contentHash}</code></dd></div>
        <div><dt>REPRODUCE</dt><dd><code>{model.provenance.reproduceCommand}</code></dd></div>
      </dl>
      <nav aria-label="Audit and dispute links">
        <a href={model.links.auditUrl} target="_blank" rel="noreferrer">OPEN FULL AUDIT</a>
        <a href={model.links.contestUrl} target="_blank" rel="noreferrer">CONTEST A RESULT</a>
      </nav>
    </div>
  );
}

export function HowAlgorithmWorksPage({ overview }: HowAlgorithmWorksPageProps) {
  const model = buildAlgorithmPresentation(overview);

  return (
    <section className="algorithm-page" aria-labelledby="algorithm-page-title">
      <header className="algorithm-page__header">
        <div>
          <span>INPUT → RULES → GRAPH → WALLET OUTCOME</span>
          <h1 id="algorithm-page-title">HOW THE ALGO WORKS</h1>
          <p>Read the selected immutable analysis from its frozen contract input through its published wallet outcomes.</p>
        </div>
        <div className="algorithm-page__version">
          <span>SELECTED ANALYSIS</span>
          <strong>{model.versionLabel}</strong>
          <code>{model.versionId}</code>
          <small data-detector-applied={model.detectorApplied}>{model.ruleState}</small>
        </div>
      </header>

      <div className="algorithm-page__pipeline" aria-hidden="true">
        <span>FROZEN LIST</span><i>→</i><span>RULE EDGES</span><i>→</i><span>COMPONENTS</span><i>→</i><span>MEMBER GATE</span><i>→</i><span>PRESENTATION</span>
      </div>

      <div className="algorithm-page__sections">
        {model.sections.map((section) => {
          const titleId = `algorithm-section-${section.id}`;
          return (
            <section
              key={section.id}
              className={`algorithm-page__section algorithm-page__section--${section.id}`}
              aria-labelledby={titleId}
            >
              <header>
                <span>{section.number}</span>
                <div>
                  <h2 id={titleId}>{section.title}</h2>
                  <p>{section.summary}</p>
                </div>
              </header>
              <ul>
                {section.facts.map((fact) => <li key={fact}>{fact}</li>)}
              </ul>
              {section.id === "rule-atlas" ? <RuleAtlas model={model} /> : null}
              {section.id === "limits-reproducibility" ? <ReproducibilityLinks model={model} /> : null}
            </section>
          );
        })}
      </div>
    </section>
  );
}
