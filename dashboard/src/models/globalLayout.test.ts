import { describe, expect, it } from "vitest";

import type { GlobalMap } from "./domain";
import { buildGlobalLayout } from "./globalLayout";

const map: GlobalMap = {
  nodes: [
    { id: "top", address: "top", rank: 1, points: 100, name: null, cluster_id: null, risk: "independent", cluster_risk: "independent", member_families: [], review_flag: false },
    { id: "cluster-a", address: "cluster-a", rank: 2, points: 80, name: null, cluster_id: 1, risk: "critical", cluster_risk: "critical", member_families: ["funding", "amount"], review_flag: false },
    { id: "cluster-b", address: "cluster-b", rank: 3, points: 70, name: null, cluster_id: 1, risk: "critical", cluster_risk: "critical", member_families: ["funding", "amount"], review_flag: false },
    { id: "outer", address: "outer", rank: 4, points: 10, name: null, cluster_id: null, risk: "independent", cluster_risk: "independent", member_families: [], review_flag: false },
  ],
  edges: [{ source: "cluster-a", target: "cluster-b", family: "funding", strength: 1, risk: "critical" }],
  meta: {
    node_count: 4,
    edge_count: 1,
    risk_counts: { independent: 2, review: 0, elevated: 0, critical: 2 },
    review_cluster_count: 0,
    layout: "test",
  },
};

describe("global wallet layout", () => {
  it("places the highest-point unit at the centre and keeps cluster members together", () => {
    const layout = buildGlobalLayout(map);
    const byId = new Map(layout.nodes.map((node) => [node.id, node]));
    const top = byId.get("top")!;
    const clusterA = byId.get("cluster-a")!;
    const clusterB = byId.get("cluster-b")!;

    expect([top.x, top.y]).toEqual([0, 0]);
    expect(Math.hypot(clusterA.x - clusterB.x, clusterA.y - clusterB.y)).toBeLessThan(15);
    expect(layout.bounds.maxX).toBeGreaterThan(layout.bounds.minX);
  });
});
