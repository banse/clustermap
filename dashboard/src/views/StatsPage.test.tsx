import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { AnalysisVersion, QualityStats } from "../models/domain";
import { StatsPage } from "./StatsPage";

const version: AnalysisVersion = {
  id: "2026-08-25-sybilkit-0.2.0",
  label: "SybilKit 0.2.0",
  at: "2026-08-25T00:00:00Z",
  stage: "published",
  summary: "Measured candidate.",
  detector: "sybilkit",
  detector_version: "0.2.0",
  rule_set: "v2h",
  snapshot_block: 25_807_057,
  commit: "abc1234",
  tag: "v0.2.0",
  reproduce_command: "make quality-stats",
  content_hash: "abc",
  published: true,
  list_scope: "retained",
  status_counts: { clean: 6_782, review: 324, flagged: 12_416 },
  cluster_count: 160,
};

const stats: QualityStats = {
  version,
  definitions: { raw: "Every wallet.", retained: "Clean plus review." },
  provenance: {
    snapshot_sha256: "one",
    versions_sha256: "two",
    nft_snapshot_sha256: "three",
    nft_observed_block: 25_853_521,
    nft_observed_at: "2026-08-28T11:44:23Z",
    nonce_coverage: 1,
    counterfactual_rule_set: "v2h",
  },
  disclaimer: "Population signals are not personhood proof.",
  outcome: {
    raw_wallets: 19_522,
    retained_wallets: 7_106,
    removed_wallets: 12_416,
    retention_rate: 7_106 / 19_522,
    raw_points: 29_675_956,
    retained_points: 6_929_267,
    retained_points_share: 6_929_267 / 29_675_956,
    status_counts: { clean: 6_782, review: 324, flagged: 12_416 },
  },
  nft: {
    benchmark: "Fixed blue-chip benchmark",
    method: "ERC-721 balanceOf",
    observed_block: 25_853_521,
    observed_at: "2026-08-28T11:44:23Z",
    raw_unique_holders: 38,
    retained_unique_holders: 38,
    removed_unique_holders: 0,
    retention_rate: 1,
    collections: [{
      id: "milady",
      name: "Milady Maker",
      contract: "0x5af0d9827e0c53e4799bb226655a1de152a425a5",
      explorer_url: "https://etherscan.io/token/0x5af0d9827e0c53e4799bb226655a1de152a425a5",
      raw_holders: 16,
      retained_holders: 16,
      removed_holders: 0,
      retention_rate: 1,
    }],
  },
  ladder: {
    definition: "At least three exact 0.10 ETH steps.",
    pattern_wallets: 564,
    retained_wallets: 420,
    status_counts: { clean: 304, review: 116, flagged: 144 },
    lengths: { "3": 126 },
    counterfactual: {
      rule_set: "v2h",
      ignored_evidence: "Exact natural ladder edges",
      removed_edges: 348,
      removed_reason_count: 15,
      flagged_wallets: 12_379,
      review_wallets: 232,
      retained_wallets: 7_143,
      no_longer_flagged: 37,
      pattern_wallets_no_longer_flagged: 36,
      newly_flagged: 0,
      transitions: { "flagged→clean": 36, "flagged→review": 1 },
    },
  },
  maturity: {
    metric: "Entry nonce",
    interpretation: "A maturity proxy, not calendar age.",
    coverage: 1,
    raw: {
      wallets: 19_522,
      covered_wallets: 19_522,
      median_prior_transactions: 0,
      nonce_zero_wallets: 11_298,
      nonce_zero_share: 11_298 / 19_522,
      buckets: { "0": 11_298, "1-4": 1_728, "5-19": 1_731, "20-99": 1_806, "100+": 2_959 },
    },
    retained: {
      wallets: 7_106,
      covered_wallets: 7_106,
      median_prior_transactions: 47,
      nonce_zero_wallets: 1_362,
      nonce_zero_share: 1_362 / 7_106,
      buckets: { "0": 1_362, "1-4": 474, "5-19": 924, "20-99": 1_486, "100+": 2_860 },
    },
  },
  controls: [{
    id: "verified",
    label: "Verified controls",
    meaning: "Independent false-positive controls.",
    raw_wallets: 308,
    retained_wallets: 274,
    removed_wallets: 34,
    retention_rate: 274 / 308,
  }],
};

afterEach(cleanup);

describe("StatsPage", () => {
  it("explains raw versus retained and renders each quality signal", () => {
    render(<StatsPage stats={stats} loading={false} />);

    expect(screen.getByRole("heading", { name: "WHAT SURVIVES THE FILTER?" })).toBeInTheDocument();
    const outcome = screen.getByRole("region", { name: "Filter outcome" });
    expect(outcome).toHaveTextContent("19,522");
    expect(outcome).toHaveTextContent("7,106");

    const nft = screen.getByRole("region", { name: "Blue-chip NFT benchmark" });
    expect(nft).toHaveTextContent("HOLDER RETENTION");
    expect(within(nft).getByRole("link", { name: /Milady Maker/ })).toHaveAttribute(
      "href",
      stats.nft.collections[0].explorer_url,
    );
    expect(nft).toHaveTextContent("100.00%");

    const ladder = screen.getByRole("region", { name: "Natural deposit ladder" });
    expect(ladder).toHaveTextContent("564");
    expect(ladder).toHaveTextContent("37 wallets would no longer be flagged");
    expect(ladder).toHaveTextContent("12,416");
    expect(ladder).toHaveTextContent("12,379");

    const maturity = screen.getByRole("region", { name: "Wallet maturity" });
    expect(maturity).toHaveTextContent(/RAW MEDIAN\s*0\s*prior transactions/);
    expect(maturity).toHaveTextContent(/RETAINED MEDIAN\s*47\s*prior transactions/);
    expect(maturity).toHaveTextContent("not calendar age");
    expect(screen.getByRole("region", { name: "Known signal retention" })).toHaveTextContent("Verified controls");
  });

  it("distinguishes an unavailable historical ablation from missing page data", () => {
    render(<StatsPage stats={{ ...stats, ladder: { ...stats.ladder, counterfactual: null } }} loading={false} />);

    expect(screen.getByText("NOT AVAILABLE FOR THIS HISTORICAL RULE SET")).toBeInTheDocument();
    expect(screen.getByText(/Switch to the SybilKit 0.2.0 version/)).toBeInTheDocument();
  });
});
