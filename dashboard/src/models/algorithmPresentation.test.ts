import { describe, expect, it } from "vitest";

import type { AnalysisVersion, Overview } from "./domain";
import { buildAlgorithmPresentation } from "./algorithmPresentation";

const publishedVersion: AnalysisVersion = {
  id: "2026-08-25-sybilkit-0.2.0",
  label: "SybilKit 0.2.0",
  at: "2026-08-25T00:00:00Z",
  stage: "published",
  summary: "Published audited analysis.",
  detector: "sybilkit",
  detector_version: "0.2.0",
  detector_commit: "d835b3f063b5eecb9bed8d959bd6958aa4a48915",
  rule_set: "v2h (v2g + aged-weak periphery)",
  rules_file: "audit/harness/sk_v2.py",
  rules_sha256: "457fac65506d3ce9693f35c154f2f1d635d3cef5673138e43c3d6332bf71b2b3",
  list_scope: "retained",
  snapshot_block: 25_807_057,
  commit: "f7154a6",
  tag: "v0.4.0",
  reproduce_command: "uv run python scripts/build_versions.py",
  content_hash: "486c7787fded341765b11c178916b237b46dc7c09e486931758c179af3bf2f9f",
  published: true,
  status_counts: { clean: 6_782, review: 324, flagged: 12_416 },
  cluster_count: 160,
};

function overview(version: AnalysisVersion = publishedVersion): Overview {
  return {
    version,
    provenance: {
      chain_id: 1,
      chain_name: "Ethereum mainnet",
      contract: "0xcb0b0531e86a9ac36fa865ca8e3dbccf047fda91",
      deployment_block: 25_769_870,
      snapshot_block: 25_807_057,
      snapshot_at: "2026-08-22T00:00:00Z",
      sybilkit_version: version.detector_version,
      sybilkit_revision: "d835b3f063b5eecb",
    },
    totals: {
      population: 19_522,
      deposits: 28_353,
      groups: version.cluster_count,
      linked_wallets: version.status_counts.flagged + version.status_counts.review,
      unlinked_wallets: version.status_counts.clean,
      points: 29_675_956,
      linked_points: 22_746_689,
      tx_fingerprints: 28_353,
      funding_rows: 19_522,
      status_counts: version.status_counts,
    },
    analysis: {
      min_size: 5,
      min_families: 2,
      points_per_eth: 1_000,
      min_deposit_wei: 50_000_000_000_000_000,
      eth_usd: null,
      disclaimer: "Evidence is not proof of common ownership.",
      dispute: {
        text: "Contest a wallet result.",
        audit_url: "https://example.test/audit",
        contest_url: "https://example.test/dispute",
      },
    },
    clusters: [],
  };
}

describe("buildAlgorithmPresentation", () => {
  it("builds all eight version-aware sections for the published v2 analysis", () => {
    const model = buildAlgorithmPresentation(overview());

    expect(model.detectorApplied).toBe(true);
    expect(model.sections.map((section) => section.id)).toEqual([
      "frozen-input",
      "points",
      "rule-atlas",
      "graph-construction",
      "wallet-gate",
      "confidence-tiers",
      "version-differences",
      "limits-reproducibility",
    ]);
    expect(model.rules).toHaveLength(17);
    expect(model.rules.map((rule) => rule.id)).toContain("tight-peel-chain");
    expect(model.rules.map((rule) => rule.id)).toContain("jitter-engine");
    expect(model.sections.find((section) => section.id === "points")?.facts.join(" ")).toContain(
      "isqrt(weight_wei) × 1,000 ÷ 1,000,000,000",
    );
    expect(model.sections.find((section) => section.id === "graph-construction")?.facts.join(" ")).toContain("5+ wallets");
    expect(model.sections.find((section) => section.id === "wallet-gate")?.facts.join(" ")).toContain("local two-family core");
    expect(model.sections.find((section) => section.id === "wallet-gate")?.facts.join(" ")).toContain("nonce ≥ 50");
    expect(model.sections.find((section) => section.id === "confidence-tiers")?.facts.join(" ")).toContain("1 − ∏(1 − strongest family strength)");
    expect(model.provenance.contentHash).toBe(publishedVersion.content_hash);
    expect(model.provenance.detectorRevision).toBe(publishedVersion.detector_commit);
    expect(model.provenance.rulesSha256).toBe(publishedVersion.rules_sha256);
    expect(model.links.auditUrl).toBe("https://example.test/audit");
    expect(model.links.contestUrl).toBe("https://example.test/dispute");
  });

  it("describes the implemented builder thresholds and confidence formula precisely", () => {
    const model = buildAlgorithmPresentation(overview());
    const threshold = (id: string) => model.rules.find((rule) => rule.id === id)?.threshold;

    expect(threshold("consecutive-joins")).toContain("skipped only when every amount");
    expect(threshold("jitter-engine")).toContain("wallet rows");
    expect(threshold("jitter-engine")).toContain("amounts need not be unique");
    expect(threshold("deposit-ladder")).toContain("adjacent first-deposit gaps");
    expect(threshold("fresh-funder-hub")).toContain("adjacent deposit gaps");
    expect(model.sections.find((section) => section.id === "graph-construction")?.facts.join(" ")).toContain("Component-building rule edges");
    expect(model.sections.find((section) => section.id === "graph-construction")?.facts.join(" ")).toContain("cannot merge");
    expect(model.sections.find((section) => section.id === "confidence-tiers")?.facts.join(" ")).toContain("0.85–1.00 factor");
  });

  it("keeps paired families together without calling them independent witnesses", () => {
    const model = buildAlgorithmPresentation(overview());
    const jitter = model.rules.find((rule) => rule.id === "jitter-engine");
    const peel = model.rules.find((rule) => rule.id === "tight-peel-chain");

    expect(jitter?.families).toEqual(["amount", "cadence"]);
    expect(jitter?.pairedFamilies).toBe(true);
    expect(peel?.families).toEqual(["funding", "cadence"]);
    expect(peel?.pairedFamilies).toBe(true);
    expect(peel?.meaning).toContain("transfer + behavioural");
  });

  it("uses the smaller shipped catalog and its group-level member gate", () => {
    const shipped = {
      ...publishedVersion,
      id: "2026-08-22-shipped",
      label: "Original SybilKit 0.1.1",
      detector_version: "0.1.1",
      rule_set: "baseline(shipped)",
      stage: "superseded",
      status_counts: { clean: 7_949, review: 0, flagged: 11_573 },
      cluster_count: 263,
    } satisfies AnalysisVersion;
    const model = buildAlgorithmPresentation(overview(shipped));

    expect(model.rules).toHaveLength(11);
    expect(model.rules.map((rule) => rule.id)).toContain("peel-chain");
    expect(model.rules.map((rule) => rule.id)).not.toContain("tight-peel-chain");
    expect(model.sections.find((section) => section.id === "wallet-gate")?.facts.join(" ")).toContain("whole kept component");
  });

  it("does not invent detector rules for the raw contract list", () => {
    const raw = {
      ...publishedVersion,
      id: "2026-08-22-whitelistcurator-raw",
      label: "Original WhitelistCurator.sol list",
      detector: "whitelistcurator",
      detector_version: "raw",
      rule_set: "none (raw contract list)",
      list_scope: "raw",
      stage: "source",
      status_counts: { clean: 19_522, review: 0, flagged: 0 },
      cluster_count: 0,
    } satisfies AnalysisVersion;
    const model = buildAlgorithmPresentation(overview(raw));

    expect(model.detectorApplied).toBe(false);
    expect(model.ruleState).toBe("NO DETECTOR APPLIED");
    expect(model.rules).toEqual([]);
    expect(model.sections).toHaveLength(8);
    expect(model.provenance.detectorRevision).toBeNull();
    expect(model.provenance.rulesSha256).toBeNull();
  });

  it("does not invent v2 graph semantics for an unknown future detector", () => {
    const future = {
      ...publishedVersion,
      id: "future-analysis",
      detector_version: "3.0.0",
      rule_set: "future",
    } satisfies AnalysisVersion;
    const model = buildAlgorithmPresentation(overview(future));
    const graphFacts = model.sections.find((section) => section.id === "graph-construction")?.facts.join(" ");

    expect(model.ruleState).toBe("RULE CATALOG NOT PUBLISHED FOR THIS VERSION");
    expect(graphFacts).toContain("no published graph-construction explanation");
    expect(graphFacts).not.toContain("v2 structural funding builders");
  });
});
