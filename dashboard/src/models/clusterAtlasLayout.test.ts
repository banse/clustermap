import { describe, expect, it } from "vitest";

import type { ClusterSummary } from "./domain";
import { buildClusterAtlasLayout } from "./clusterAtlasLayout";

function cluster(id: number, confidence: number, pointsShare: number, size: number): ClusterSummary {
  return {
    id,
    size,
    confidence,
    band: confidence >= 0.95 ? "high" : "low",
    points: Math.round(pointsShare * 1_000_000),
    points_share: pointsShare,
    span_blocks: 100,
    families: ["amount", "funding"],
    reasons: [],
    edge_count: size - 1,
    risk: confidence >= 0.95 ? "critical" : "elevated",
    review_flag: false,
    review_reasons: [],
  };
}

describe("cluster evidence atlas layout", () => {
  it("orders confidence left-to-right and points relevance bottom-to-top", () => {
    const layout = buildClusterAtlasLayout([
      cluster(0, 0.8, 0.001, 20),
      cluster(1, 0.99, 0.001, 20),
      cluster(2, 0.9, 0.1, 20),
    ], 900, 620);
    const byId = new Map(layout.clusters.map((item) => [item.id, item]));

    expect(byId.get(1)!.targetX).toBeGreaterThan(byId.get(0)!.targetX);
    expect(byId.get(2)!.targetY).toBeLessThan(byId.get(0)!.targetY);
  });

  it("uses bubble area to distinguish larger groups and keeps bubbles in the plot", () => {
    const layout = buildClusterAtlasLayout([
      cluster(0, 0.8, 0.001, 10),
      cluster(1, 0.99, 0.1, 1_000),
    ], 900, 620);
    const byId = new Map(layout.clusters.map((item) => [item.id, item]));
    const large = byId.get(1)!;

    expect(large.radius).toBeGreaterThan(byId.get(0)!.radius);
    expect(large.x + large.radius).toBeLessThanOrEqual(layout.plot.right);
    expect(large.y - large.radius).toBeGreaterThanOrEqual(layout.plot.top);
  });
});
