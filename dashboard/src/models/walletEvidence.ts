import type { EvidenceEdge, EvidenceFamily } from "./domain";

export type WalletEvidenceKind = "transfer" | "behavior";

export interface WalletEvidenceCenter {
  readonly id: "selected-wallet";
  readonly address: string;
}

export interface WalletEvidenceRule {
  readonly id: string;
  readonly ruleId: string;
  readonly label: string;
  readonly families: readonly EvidenceFamily[];
}

export interface WalletEvidenceCounterpart {
  readonly id: string;
  readonly address: string;
}

export interface WalletEvidenceIncident {
  readonly id: string;
  readonly ruleId: string;
  readonly ruleLabel: string;
  readonly counterpartId: string;
  readonly counterpartAddress: string;
  readonly source: string;
  readonly target: string;
  readonly family: EvidenceFamily;
  readonly strength: number;
  readonly reason: string;
  readonly kind: WalletEvidenceKind;
  /** Symmetric slot used by the view so paired family outputs do not overlap. */
  readonly parallelOffset: number;
}

export interface WalletEvidenceProjection {
  readonly center: WalletEvidenceCenter;
  /** All rules remain available while the graph is focused to one of them. */
  readonly availableRules: readonly WalletEvidenceRule[];
  readonly rules: readonly WalletEvidenceRule[];
  readonly counterparts: readonly WalletEvidenceCounterpart[];
  readonly incidents: readonly WalletEvidenceIncident[];
  readonly selectedRuleId: string | null;
  readonly directNeighborCount: number;
  readonly displayedLinkCount: number;
  readonly isIsolated: boolean;
}

interface IncidentCandidate {
  readonly edge: EvidenceEdge;
  readonly counterpartAddress: string;
  readonly counterpartKey: string;
}

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

function compareCandidates(left: IncidentCandidate, right: IncidentCandidate): number {
  return (
    compareText(left.edge.rule_label, right.edge.rule_label) ||
    compareText(left.edge.rule_id, right.edge.rule_id) ||
    compareText(left.counterpartKey, right.counterpartKey) ||
    compareText(left.edge.family, right.edge.family) ||
    compareText(left.edge.reason, right.edge.reason) ||
    compareText(left.edge.source, right.edge.source) ||
    compareText(left.edge.target, right.edge.target) ||
    left.edge.strength - right.edge.strength
  );
}

function incidentCandidates(address: string, edges: readonly EvidenceEdge[]): IncidentCandidate[] {
  const selected = normalizeAddress(address);
  return edges.flatMap((edge) => {
    const source = normalizeAddress(edge.source);
    const target = normalizeAddress(edge.target);
    if (source !== selected && target !== selected) return [];
    const counterpartAddress = source === selected ? edge.target : edge.source;
    return [{ edge, counterpartAddress, counterpartKey: normalizeAddress(counterpartAddress) }];
  }).sort(compareCandidates);
}

function rulesFrom(candidates: readonly IncidentCandidate[]): WalletEvidenceRule[] {
  const byRule = new Map<string, { label: string; families: Set<EvidenceFamily> }>();
  for (const { edge } of candidates) {
    const current = byRule.get(edge.rule_id) ?? { label: edge.rule_label, families: new Set() };
    current.families.add(edge.family);
    byRule.set(edge.rule_id, current);
  }
  return [...byRule.entries()]
    .map(([ruleId, value]) => ({
      id: `rule-${ruleId}`,
      ruleId,
      label: value.label,
      families: [...value.families].sort(compareText),
    }))
    .sort((left, right) => compareText(left.label, right.label) || compareText(left.ruleId, right.ruleId));
}

function counterpartNodes(candidates: readonly IncidentCandidate[]): WalletEvidenceCounterpart[] {
  const addresses = new Map<string, string>();
  for (const candidate of candidates) {
    if (!addresses.has(candidate.counterpartKey)) {
      addresses.set(candidate.counterpartKey, candidate.counterpartAddress);
    }
  }
  return [...addresses.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([key, address]) => ({ id: `wallet-${key}`, address }));
}

function projectedIncidents(candidates: readonly IncidentCandidate[]): WalletEvidenceIncident[] {
  const groupSizes = new Map<string, number>();
  for (const candidate of candidates) {
    const key = `${candidate.edge.rule_id}:${candidate.counterpartKey}`;
    groupSizes.set(key, (groupSizes.get(key) ?? 0) + 1);
  }

  const groupIndexes = new Map<string, number>();
  const duplicateIndexes = new Map<string, number>();
  return candidates.map(({ edge, counterpartAddress, counterpartKey }) => {
    const groupKey = `${edge.rule_id}:${counterpartKey}`;
    const parallelIndex = groupIndexes.get(groupKey) ?? 0;
    groupIndexes.set(groupKey, parallelIndex + 1);
    const parallelCount = groupSizes.get(groupKey) ?? 1;
    const identity = `${groupKey}:${edge.family}:${edge.strength}:${edge.reason}`;
    const duplicateIndex = duplicateIndexes.get(identity) ?? 0;
    duplicateIndexes.set(identity, duplicateIndex + 1);
    return {
      id: `${identity}:${duplicateIndex}`,
      ruleId: edge.rule_id,
      ruleLabel: edge.rule_label,
      counterpartId: `wallet-${counterpartKey}`,
      counterpartAddress,
      source: edge.source,
      target: edge.target,
      family: edge.family,
      strength: edge.strength,
      reason: edge.reason,
      kind: edge.family === "funding" ? "transfer" : "behavior",
      parallelOffset: parallelIndex - (parallelCount - 1) / 2,
    };
  });
}

export function projectWalletEvidence(
  address: string,
  edges: readonly EvidenceEdge[],
  requestedRuleId: string | null,
): WalletEvidenceProjection {
  const allCandidates = incidentCandidates(address, edges);
  const availableRules = rulesFrom(allCandidates);
  const selectedRuleId = availableRules.some((rule) => rule.ruleId === requestedRuleId)
    ? requestedRuleId
    : null;
  const visibleCandidates = selectedRuleId === null
    ? allCandidates
    : allCandidates.filter(({ edge }) => edge.rule_id === selectedRuleId);
  const counterparts = counterpartNodes(visibleCandidates);

  return {
    center: { id: "selected-wallet", address },
    availableRules,
    rules: rulesFrom(visibleCandidates),
    counterparts,
    incidents: projectedIncidents(visibleCandidates),
    selectedRuleId,
    directNeighborCount: counterparts.length,
    displayedLinkCount: visibleCandidates.length,
    isIsolated: allCandidates.length === 0,
  };
}
