import type { EvidenceBand, EvidenceFamily, RiskTier } from "./domain";

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const precise = new Intl.NumberFormat("en", {
  maximumFractionDigits: 2,
});

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}

export function formatCompact(value: number): string {
  return compact.format(value);
}

export function formatPercent(share: number): string {
  return `${(share * 100).toFixed(2)}%`;
}

export function formatEth(value: number, ethUsd: number | null): string {
  const eth = `${precise.format(value)} ETH`;
  if (ethUsd === null) return `${eth} · USD unavailable`;
  return `${eth} · ≈ $${precise.format(value * ethUsd)}`;
}

export function clusterLabel(id: number): string {
  return `GROUP ${String(id + 1).padStart(3, "0")}`;
}

export function familyLabel(family: EvidenceFamily): string {
  const labels: Record<EvidenceFamily, string> = {
    amount: "Amount pattern",
    sequence: "Join sequence",
    cadence: "Timing cadence",
    gas: "Gas fingerprint",
    funding: "Funding transfer",
  };
  return labels[family];
}

export function bandLabel(band: EvidenceBand): string {
  if (band === "none") return "No group link";
  return band === "high" ? "Multi-family evidence" : "Two-family evidence";
}

export function shortRevision(revision: string): string {
  return revision.slice(0, 7);
}

/**
 * How strongly a GROUP is linked — never a judgement about a wallet's owner.
 *
 * SybilKit's tiers are properties of a cluster, computed from the evidence
 * families that hold the cluster together. An audit of this snapshot found
 * members carried by a single rule of a single family inheriting their
 * cluster's top tier, so wording that reads as a verdict on a person
 * ("strong sybil signal") overstates what was measured. See `audit/`.
 */
export function riskLabel(risk: RiskTier): string {
  if (risk === "critical") return "Strong group evidence";
  if (risk === "elevated") return "Moderate group evidence";
  if (risk === "review") return "Weak group evidence";
  return "No group link";
}

/** The same tier from a wallet's point of view: membership, not a verdict. */
export function walletGroupLabel(risk: RiskTier | null): string {
  if (risk === null) return "No kept group";
  if (risk === "critical") return "In a strong-evidence group";
  if (risk === "elevated") return "In a moderate-evidence group";
  if (risk === "review") return "In a weak-evidence group";
  return "No group link";
}
