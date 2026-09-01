import type { EvidenceEdge } from "../models/domain";
import {
  projectWalletEvidence,
  type WalletEvidenceIncident,
  type WalletEvidenceProjection,
} from "../models/walletEvidence";
import { familyLabel, formatCount } from "../models/presentation";

export interface WalletEvidenceGraphProps {
  readonly address: string;
  readonly edges: readonly EvidenceEdge[];
  readonly selectedRuleId: string | null;
  readonly onSelectRule: (ruleId: string | null) => void;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

const WIDTH = 1000;
const HEIGHT = 620;
const CENTER: Point = { x: WIDTH / 2, y: HEIGHT / 2 };

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function orbitPoint(index: number, count: number, radiusX: number, radiusY: number): Point {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(count, 1);
  return {
    x: CENTER.x + Math.cos(angle) * radiusX,
    y: CENTER.y + Math.sin(angle) * radiusY,
  };
}

function incidentPath(
  incident: WalletEvidenceIncident,
  rule: Point,
  counterpart: Point,
): string {
  const dx = counterpart.x - CENTER.x;
  const dy = counterpart.y - CENTER.y;
  const length = Math.hypot(dx, dy) || 1;
  const offset = incident.parallelOffset * 22;
  const offsetX = (-dy / length) * offset;
  const offsetY = (dx / length) * offset;
  const gate = { x: rule.x + offsetX, y: rule.y + offsetY };
  const firstControl = {
    x: (CENTER.x + gate.x) / 2 + offsetX,
    y: (CENTER.y + gate.y) / 2 + offsetY,
  };
  const secondControl = {
    x: (gate.x + counterpart.x) / 2 + offsetX,
    y: (gate.y + counterpart.y) / 2 + offsetY,
  };
  return [
    `M ${CENTER.x} ${CENTER.y}`,
    `Q ${firstControl.x} ${firstControl.y} ${gate.x} ${gate.y}`,
    `Q ${secondControl.x} ${secondControl.y} ${counterpart.x} ${counterpart.y}`,
  ].join(" ");
}

function EvidenceDiagram({ projection }: { readonly projection: WalletEvidenceProjection }) {
  const rulePoints = new Map(
    projection.rules.map((rule, index) => [
      rule.ruleId,
      orbitPoint(index, projection.rules.length, 205, 155),
    ]),
  );
  const counterpartPoints = new Map(
    projection.counterparts.map((wallet, index) => [
      wallet.id,
      orbitPoint(index, projection.counterparts.length, 405, 245),
    ]),
  );

  return (
    <svg
      className="wallet-evidence-graph__diagram"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Direct rule evidence for ${projection.center.address}`}
    >
      <title>Direct rule evidence for {projection.center.address}</title>
      <desc>
        The selected wallet is centred. Rules are logic gates on the first orbit and directly connected wallets are on the outer orbit. Solid paths are transfers; dashed paths are behavioural matches.
      </desc>
      <g className="wallet-evidence-graph__grid" aria-hidden="true">
        <line x1="30" y1={CENTER.y} x2={WIDTH - 30} y2={CENTER.y} />
        <line x1={CENTER.x} y1="24" x2={CENTER.x} y2={HEIGHT - 24} />
        <ellipse cx={CENTER.x} cy={CENTER.y} rx="205" ry="155" />
        <ellipse cx={CENTER.x} cy={CENTER.y} rx="405" ry="245" />
      </g>

      {projection.incidents.map((incident) => {
        const rule = rulePoints.get(incident.ruleId);
        const counterpart = counterpartPoints.get(incident.counterpartId);
        if (rule === undefined || counterpart === undefined) return null;
        return (
          <path
            key={incident.id}
            data-testid="wallet-evidence-incident"
            data-kind={incident.kind}
            data-family={incident.family}
            className={`wallet-evidence-graph__incident wallet-evidence-graph__incident--${incident.family} wallet-evidence-graph__incident--${incident.kind}`}
            d={incidentPath(incident, rule, counterpart)}
            fill="none"
            strokeDasharray={incident.kind === "behavior" ? "8 7" : undefined}
          >
            <title>{incident.ruleLabel} · {familyLabel(incident.family)} · {incident.kind}: {incident.reason}</title>
          </path>
        );
      })}

      {projection.counterparts.map((wallet) => {
        const point = counterpartPoints.get(wallet.id)!;
        return (
          <g key={wallet.id} className="wallet-evidence-graph__wallet-node wallet-evidence-graph__wallet-node--counterpart">
            <circle cx={point.x} cy={point.y} r="13" />
            <text x={point.x} y={point.y + (point.y < CENTER.y ? -23 : 31)} textAnchor="middle">
              {shortAddress(wallet.address)}
            </text>
          </g>
        );
      })}

      {projection.rules.map((rule) => {
        const point = rulePoints.get(rule.ruleId)!;
        return (
          <g key={rule.id} className="wallet-evidence-graph__rule-node">
            <polygon points={`${point.x - 15},${point.y} ${point.x},${point.y - 15} ${point.x + 15},${point.y} ${point.x},${point.y + 15}`} />
            <text x={point.x} y={point.y + 31} textAnchor="middle">{rule.label}</text>
          </g>
        );
      })}

      <g
        className="wallet-evidence-graph__wallet-node wallet-evidence-graph__wallet-node--selected"
        data-testid="wallet-evidence-selected-wallet"
      >
        <circle cx={CENTER.x} cy={CENTER.y} r="34" />
        <circle cx={CENTER.x} cy={CENTER.y} r="15" />
        <text x={CENTER.x} y={CENTER.y + 58} textAnchor="middle">
          SELECTED · {shortAddress(projection.center.address)}
        </text>
      </g>
    </svg>
  );
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}

export function WalletEvidenceGraph({
  address,
  edges,
  selectedRuleId,
  onSelectRule,
}: WalletEvidenceGraphProps) {
  const projection = projectWalletEvidence(address, edges, selectedRuleId);

  return (
    <section className="wallet-evidence-graph" aria-labelledby="wallet-evidence-graph-title">
      <header className="wallet-evidence-graph__header">
        <div>
          <span>DIRECT RULE TRACE</span>
          <h2 id="wallet-evidence-graph-title">WALLET EVIDENCE</h2>
          <p>{shortAddress(address)}</p>
        </div>
        <div className="wallet-evidence-graph__metrics" aria-label="Displayed wallet evidence counts">
          <strong>{countLabel(projection.directNeighborCount, "DIRECT WALLET", "DIRECT WALLETS")}</strong>
          <strong>{countLabel(projection.rules.length, "RULE", "RULES")}</strong>
          <strong>{countLabel(projection.displayedLinkCount, "DISPLAYED LINK", "DISPLAYED LINKS")}</strong>
        </div>
      </header>

      <nav className="wallet-evidence-graph__rules" aria-label="Triggered rule filter">
        <button
          type="button"
          aria-pressed={projection.selectedRuleId === null}
          disabled={projection.availableRules.length === 0}
          onClick={() => onSelectRule(null)}
        >
          ALL TRIGGERED RULES
        </button>
        {projection.availableRules.map((rule) => (
          <button
            key={rule.ruleId}
            type="button"
            aria-label={rule.label}
            aria-pressed={projection.selectedRuleId === rule.ruleId}
            onClick={() => onSelectRule(
              projection.selectedRuleId === rule.ruleId ? null : rule.ruleId,
            )}
          >
            <span>{rule.label}</span>
            <small>{rule.families.map(familyLabel).join(" + ")}</small>
          </button>
        ))}
      </nav>

      <div className="wallet-evidence-graph__stage">
        <EvidenceDiagram projection={projection} />
        {projection.isIsolated ? (
          <p className="wallet-evidence-graph__empty">NO DIRECT RULE ON THIS WALLET</p>
        ) : null}
      </div>

      <div className="wallet-evidence-graph__legend" aria-label="Evidence line legend">
        <span><i className="wallet-evidence-graph__line wallet-evidence-graph__line--transfer" />MEASURED TRANSFER</span>
        <span><i className="wallet-evidence-graph__line wallet-evidence-graph__line--behavior" />BEHAVIOURAL MATCH</span>
        <small>Funding is a transfer. Every other family is a behavioural similarity.</small>
      </div>
    </section>
  );
}
