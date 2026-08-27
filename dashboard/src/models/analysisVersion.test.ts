import { describe, expect, it } from "vitest";

import type { AnalysisVersion, VersionsResponse } from "./domain";
import { DEFAULT_ANALYSIS_VERSION_ID, defaultAnalysisVersionId } from "./analysisVersion";

const published: AnalysisVersion = {
  id: "2026-08-22-shipped",
  label: "Published SybilKit 0.1.1",
  at: "2026-08-22T00:00:00Z",
  stage: "published",
  summary: "Published analysis.",
  detector: "sybilkit",
  detector_version: "0.1.1",
  rule_set: "baseline(shipped)",
  snapshot_block: 25_807_057,
  commit: "88d595b",
  tag: "v0.1.0",
  reproduce_command: "uv run python scripts/build_versions.py",
  content_hash: "published-hash",
  published: true,
  status_counts: { clean: 7_949, review: 0, flagged: 11_573 },
  cluster_count: 263,
};

const audited: AnalysisVersion = {
  ...published,
  id: DEFAULT_ANALYSIS_VERSION_ID,
  label: "Audited v2h candidate",
  stage: "candidate",
  tag: null,
  published: false,
  status_counts: { clean: 6_782, review: 324, flagged: 12_416 },
  cluster_count: 160,
};

function index(versions: readonly AnalysisVersion[]): VersionsResponse {
  return { published_version: published.id, versions };
}

describe("defaultAnalysisVersionId", () => {
  it("opens on the audited v2h analysis when it is available", () => {
    expect(defaultAnalysisVersionId(index([published, audited]))).toBe(audited.id);
  });

  it("falls back to the published version when v2h is unavailable", () => {
    expect(defaultAnalysisVersionId(index([published]))).toBe(published.id);
  });
});
