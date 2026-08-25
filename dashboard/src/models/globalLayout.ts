import type { GlobalMap, GlobalMapNode } from "./domain";

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export interface PositionedGlobalNode extends GlobalMapNode {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface GlobalLayout {
  readonly nodes: readonly PositionedGlobalNode[];
  readonly bounds: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number };
}

interface LayoutUnit {
  readonly nodes: readonly GlobalMapNode[];
  readonly peakPoints: number;
  readonly peakRank: number;
}

export function buildGlobalLayout(map: GlobalMap): GlobalLayout {
  const groups = new Map<number, GlobalMapNode[]>();
  const units: LayoutUnit[] = [];
  for (const node of map.nodes) {
    if (node.cluster_id === null) {
      units.push({ nodes: [node], peakPoints: node.points, peakRank: node.rank });
      continue;
    }
    const group = groups.get(node.cluster_id) ?? [];
    group.push(node);
    groups.set(node.cluster_id, group);
  }
  for (const nodes of groups.values()) {
    nodes.sort((left, right) => right.points - left.points || left.rank - right.rank);
    units.push({ nodes, peakPoints: nodes[0].points, peakRank: nodes[0].rank });
  }
  units.sort((left, right) => right.peakPoints - left.peakPoints || left.peakRank - right.peakRank);

  const maxPoints = Math.max(...map.nodes.map((node) => node.points), 1);
  const positioned: PositionedGlobalNode[] = [];
  units.forEach((unit, unitIndex) => {
    const anchorRadius = unitIndex === 0 ? 0 : 12 * Math.sqrt(unitIndex);
    const anchorAngle = unitIndex * GOLDEN_ANGLE;
    const anchorX = Math.cos(anchorAngle) * anchorRadius;
    const anchorY = Math.sin(anchorAngle) * anchorRadius;
    const localExtent = unit.nodes.length === 1 ? 0 : Math.max(6, Math.sqrt(unit.nodes.length) * 0.8);
    unit.nodes.forEach((node, nodeIndex) => {
      const progress = unit.nodes.length === 1 ? 0 : Math.sqrt(nodeIndex / (unit.nodes.length - 1));
      const localRadius = progress * localExtent;
      const localAngle = nodeIndex * GOLDEN_ANGLE;
      positioned.push({
        ...node,
        x: anchorX + Math.cos(localAngle) * localRadius,
        y: anchorY + Math.sin(localAngle) * localRadius,
        radius: 1.4 + Math.sqrt(node.points / maxPoints) * 6.6,
      });
    });
  });

  const padding = 20;
  return {
    nodes: positioned,
    bounds: {
      minX: Math.min(...positioned.map((node) => node.x - node.radius)) - padding,
      minY: Math.min(...positioned.map((node) => node.y - node.radius)) - padding,
      maxX: Math.max(...positioned.map((node) => node.x + node.radius)) + padding,
      maxY: Math.max(...positioned.map((node) => node.y + node.radius)) + padding,
    },
  };
}
