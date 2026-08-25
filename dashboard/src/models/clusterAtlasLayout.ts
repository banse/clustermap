import type { ClusterSummary } from "./domain";

export interface PositionedCluster extends ClusterSummary {
  readonly x: number;
  readonly y: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly radius: number;
}

export interface ClusterAtlasLayout {
  readonly clusters: readonly PositionedCluster[];
  readonly plot: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };
  readonly minConfidence: number;
  readonly maxConfidence: number;
  readonly minShare: number;
  readonly maxShare: number;
}

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

export function buildClusterAtlasLayout(
  clusters: readonly ClusterSummary[],
  width: number,
  height: number,
): ClusterAtlasLayout {
  const plot = { left: 64, top: 34, right: Math.max(84, width - 24), bottom: Math.max(74, height - 54) };
  const minConfidence = Math.min(...clusters.map((cluster) => cluster.confidence));
  const maxConfidence = Math.max(...clusters.map((cluster) => cluster.confidence));
  const minShare = Math.min(...clusters.map((cluster) => cluster.points_share));
  const maxShare = Math.max(...clusters.map((cluster) => cluster.points_share));
  const maxSize = Math.max(...clusters.map((cluster) => cluster.size), 1);
  const confidenceSpan = Math.max(maxConfidence - minConfidence, 0.001);
  const logMinShare = Math.log10(Math.max(minShare, 0.000001));
  const logMaxShare = Math.log10(Math.max(maxShare, 0.000001));
  const shareSpan = Math.max(logMaxShare - logMinShare, 0.001);

  const mutable = [...clusters]
    .sort((left, right) => right.points_share - left.points_share || left.id - right.id)
    .map((cluster) => {
      const confidence = (cluster.confidence - minConfidence) / confidenceSpan;
      const importance = (Math.log10(Math.max(cluster.points_share, 0.000001)) - logMinShare) / shareSpan;
      const targetX = plot.left + confidence * (plot.right - plot.left);
      const targetY = plot.bottom - importance * (plot.bottom - plot.top);
      return {
        ...cluster,
        x: targetX,
        y: targetY,
        targetX,
        targetY,
        radius: 4.5 + Math.sqrt(cluster.size / maxSize) * 22,
      };
    });

  for (let iteration = 0; iteration < 72; iteration += 1) {
    for (let leftIndex = 0; leftIndex < mutable.length; leftIndex += 1) {
      const left = mutable[leftIndex];
      for (let rightIndex = leftIndex + 1; rightIndex < mutable.length; rightIndex += 1) {
        const right = mutable[rightIndex];
        let dx = right.x - left.x;
        let dy = right.y - left.y;
        let distance = Math.hypot(dx, dy);
        const minimumDistance = left.radius + right.radius + 2;
        if (distance >= minimumDistance) continue;
        if (distance < 0.001) {
          const angle = ((left.id * 31 + right.id * 17) % 360) * (Math.PI / 180);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }
        const push = (minimumDistance - distance) * 0.5;
        const pushX = (dx / distance) * push;
        const pushY = (dy / distance) * push;
        left.x -= pushX;
        left.y -= pushY;
        right.x += pushX;
        right.y += pushY;
      }
    }
    for (const cluster of mutable) {
      cluster.x += (cluster.targetX - cluster.x) * 0.075;
      cluster.y += (cluster.targetY - cluster.y) * 0.075;
      cluster.x = clamp(cluster.x, plot.left + cluster.radius, plot.right - cluster.radius);
      cluster.y = clamp(cluster.y, plot.top + cluster.radius, plot.bottom - cluster.radius);
    }
  }

  return { clusters: mutable, plot, minConfidence, maxConfidence, minShare, maxShare };
}
