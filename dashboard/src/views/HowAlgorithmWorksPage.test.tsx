import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { AnalysisVersion, Overview } from "../models/domain";
import { HowAlgorithmWorksPage } from "./HowAlgorithmWorksPage";

const version: AnalysisVersion = {
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

function overview(selectedVersion: AnalysisVersion = version): Overview {
  return {
    version: selectedVersion,
    provenance: {
      chain_id: 1,
      chain_name: "Ethereum mainnet",
      contract: "0xcb0b0531e86a9ac36fa865ca8e3dbccf047fda91",
      deployment_block: 25_769_870,
      snapshot_block: 25_807_057,
      snapshot_at: "2026-08-22T00:00:00Z",
      sybilkit_version: selectedVersion.detector_version,
      sybilkit_revision: "d835b3f063b5eecb",
    },
    totals: {
      population: 19_522,
      deposits: 28_353,
      groups: selectedVersion.cluster_count,
      linked_wallets: selectedVersion.status_counts.flagged + selectedVersion.status_counts.review,
      unlinked_wallets: selectedVersion.status_counts.clean,
      points: 29_675_956,
      linked_points: 22_746_689,
      tx_fingerprints: 28_353,
      funding_rows: 19_522,
      status_counts: selectedVersion.status_counts,
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

afterEach(cleanup);

describe("HowAlgorithmWorksPage", () => {
  it("renders the complete eight-part explanation for the selected version", () => {
    render(<HowAlgorithmWorksPage overview={overview()} />);

    expect(screen.getByRole("heading", { name: "HOW THE ALGO WORKS" })).toBeInTheDocument();
    expect(screen.getByText(version.id)).toBeInTheDocument();
    for (const heading of [
      "FROZEN INPUT",
      "POINTS",
      "RULE ATLAS",
      "GRAPH CONSTRUCTION",
      "WALLET GATE",
      "CONFIDENCE & PRESENTATION TIERS",
      "VERSION DIFFERENCES",
      "LIMITS & REPRODUCIBILITY",
    ]) {
      expect(screen.getByRole("region", { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText(/isqrt\(weight_wei\) × 1,000/)).toBeInTheDocument();
    expect(screen.getByText(/local two-family core/)).toBeInTheDocument();
    expect(screen.getByText(/1 − ∏\(1 − strongest family strength\)/)).toBeInTheDocument();
  });

  it("shows concrete rules, paired-family caveats and transfer semantics", () => {
    render(<HowAlgorithmWorksPage overview={overview()} />);

    const atlas = screen.getByRole("region", { name: "RULE ATLAS" });
    const peel = within(atlas).getByRole("article", { name: "Tight peel chain" });
    expect(peel).toHaveTextContent("FUNDING");
    expect(peel).toHaveTextContent("CADENCE");
    expect(peel).toHaveTextContent("PAIRED OUTPUT · ONE CONCEPTUAL RULE");
    expect(peel).toHaveTextContent("transfer + behavioural");
    expect(within(atlas).getByRole("article", { name: "Near-same-block amounts" })).toHaveTextContent("Behavioural pattern");
  });

  it("exposes version provenance, audit and dispute routes", () => {
    render(<HowAlgorithmWorksPage overview={overview()} />);

    const limits = screen.getByRole("region", { name: "LIMITS & REPRODUCIBILITY" });
    expect(limits).toHaveTextContent(version.content_hash);
    expect(limits).toHaveTextContent(version.reproduce_command);
    expect(limits).toHaveTextContent(version.detector_commit!);
    expect(limits).toHaveTextContent(version.rules_sha256!);
    expect(within(limits).getByRole("link", { name: "OPEN FULL AUDIT" })).toHaveAttribute("href", "https://example.test/audit");
    expect(within(limits).getByRole("link", { name: "CONTEST A RESULT" })).toHaveAttribute("href", "https://example.test/dispute");
    expect(limits).toHaveTextContent("not proof of common identity, control, intent, or ownership");
  });

  it("renders the raw version as no detector applied without rule cards", () => {
    const raw = {
      ...version,
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
    render(<HowAlgorithmWorksPage overview={overview(raw)} />);

    expect(screen.getAllByText("NO DETECTOR APPLIED").length).toBeGreaterThan(0);
    const atlas = screen.getByRole("region", { name: "RULE ATLAS" });
    expect(within(atlas).queryAllByRole("article")).toHaveLength(0);
    expect(within(atlas).getByText(/raw contract-list view/)).toBeInTheDocument();
  });
});
