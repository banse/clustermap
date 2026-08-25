import type { EvidenceBand, EvidenceFamily } from "./domain";

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

