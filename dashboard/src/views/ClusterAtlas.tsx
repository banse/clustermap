import { useEffect, useMemo, useRef, useState } from "react";

import type { ClusterSummary, Overview, RiskTier } from "../models/domain";
import { buildClusterAtlasLayout, type PositionedCluster } from "../models/clusterAtlasLayout";
import { clusterLabel, formatCount, formatPercent } from "../models/presentation";
import type { ThemeId } from "../models/theme";
import { drawFocusReticle } from "./drawFocusReticle";

interface ClusterAtlasProps {
  readonly overview: Overview;
  readonly theme: ThemeId;
  readonly resetKey: number;
  readonly focusedClusterId: number | null;
  readonly onOpenCluster: (clusterId: number) => void;
}

interface Palette {
  readonly background: string;
  readonly grid: string;
  readonly text: string;
  readonly muted: string;
  readonly selected: string;
  readonly markText: string;
  readonly falsePositive: string;
  readonly focus: string;
  readonly risks: Readonly<Record<Exclude<RiskTier, "independent">, string>>;
}

function cssColor(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  return styles.getPropertyValue(name).trim() || fallback;
}

function paletteFromTheme(): Palette {
  const styles = getComputedStyle(document.documentElement);
  return {
    background: cssColor(styles, "--map-background", "#101410"),
    grid: cssColor(styles, "--map-grid", "rgba(0,255,65,.08)"),
    text: cssColor(styles, "--map-text", "#00dd33"),
    muted: cssColor(styles, "--muted", "#8fa091"),
    selected: cssColor(styles, "--map-selected", "#ffffff"),
    markText: cssColor(styles, "--map-mark-text", "#071008"),
    falsePositive: cssColor(styles, "--map-false-positive", "#ffffff"),
    focus: cssColor(styles, "--wallet-focus", "#e8fff0"),
    risks: {
      review: cssColor(styles, "--risk-review", "#f0cc4d"),
      elevated: cssColor(styles, "--risk-elevated", "#ff8c42"),
      critical: cssColor(styles, "--risk-critical", "#ff4055"),
    },
  };
}

function confidenceX(confidence: number, minimum: number, maximum: number, left: number, right: number): number {
  return left + ((confidence - minimum) / Math.max(maximum - minimum, 0.001)) * (right - left);
}

function shareY(share: number, minimum: number, maximum: number, top: number, bottom: number): number {
  const minLog = Math.log10(Math.max(minimum, 0.000001));
  const maxLog = Math.log10(Math.max(maximum, 0.000001));
  const progress = (Math.log10(Math.max(share, 0.000001)) - minLog) / Math.max(maxLog - minLog, 0.001);
  return bottom - progress * (bottom - top);
}

function groupCode(cluster: ClusterSummary): string {
  return `G${String(cluster.id + 1).padStart(3, "0")}`;
}

export function ClusterAtlas({ overview, theme, resetKey, focusedClusterId, onOpenCluster }: ClusterAtlasProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoveredRef = useRef<PositionedCluster | null>(null);
  const drawRef = useRef<() => void>(() => undefined);
  const [hovered, setHovered] = useState<PositionedCluster | null>(null);
  const [size, setSize] = useState({ width: 900, height: 660 });
  const layout = useMemo(
    () => buildClusterAtlasLayout(overview.clusters, size.width, size.height),
    [overview.clusters, size.height, size.width],
  );

  useEffect(() => {
    const shell = shellRef.current;
    if (shell === null) return;
    const observer = new ResizeObserver(([entry]) => setSize({
      width: Math.max(320, Math.floor(entry.contentRect.width)),
      height: Math.max(460, Math.floor(entry.contentRect.height)),
    }));
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const context = canvas.getContext("2d");
    if (context === null) return;
    const ratio = window.devicePixelRatio || 1;
    const palette = paletteFromTheme();
    canvas.width = Math.floor(size.width * ratio);
    canvas.height = Math.floor(size.height * ratio);
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    const draw = () => {
      const { plot } = layout;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, size.width, size.height);
      context.fillStyle = palette.background;
      context.fillRect(0, 0, size.width, size.height);
      context.font = "8px Fragment Mono";
      context.textBaseline = "middle";

      const confidenceTicks = [0.8, 0.85, 0.9, 0.95, 1].filter(
        (tick) => tick >= layout.minConfidence && tick <= layout.maxConfidence + 0.001,
      );
      for (const tick of confidenceTicks) {
        const x = confidenceX(tick, layout.minConfidence, layout.maxConfidence, plot.left, plot.right);
        context.beginPath();
        context.moveTo(x, plot.top);
        context.lineTo(x, plot.bottom);
        context.strokeStyle = palette.grid;
        context.lineWidth = 1;
        context.stroke();
        context.fillStyle = palette.muted;
        context.textAlign = "center";
        context.fillText(`${Math.round(tick * 100)}%`, x, plot.bottom + 18);
      }

      const shareTicks = [0.0001, 0.001, 0.01, 0.1].filter(
        (tick) => tick >= layout.minShare && tick <= layout.maxShare,
      );
      for (const tick of shareTicks) {
        const y = shareY(tick, layout.minShare, layout.maxShare, plot.top, plot.bottom);
        context.beginPath();
        context.moveTo(plot.left, y);
        context.lineTo(plot.right, y);
        context.strokeStyle = palette.grid;
        context.lineWidth = 1;
        context.stroke();
        context.fillStyle = palette.muted;
        context.textAlign = "right";
        context.fillText(formatPercent(tick), plot.left - 8, y);
      }

      const active = hoveredRef.current;
      if (active !== null) {
        context.beginPath();
        context.moveTo(plot.left, active.y);
        context.lineTo(plot.right, active.y);
        context.moveTo(active.x, plot.top);
        context.lineTo(active.x, plot.bottom);
        context.setLineDash([3, 5]);
        context.strokeStyle = palette.selected;
        context.globalAlpha = 0.3;
        context.stroke();
        context.globalAlpha = 1;
        context.setLineDash([]);
      }

      const drawOrder = [...layout.clusters].sort((left, right) => right.radius - left.radius || left.id - right.id);
      for (const cluster of drawOrder) {
        const isHovered = active?.id === cluster.id;
        const isFocused = focusedClusterId === cluster.id;
        context.beginPath();
        context.arc(cluster.x, cluster.y, cluster.radius, 0, Math.PI * 2);
        context.fillStyle = palette.risks[cluster.risk];
        context.globalAlpha = isHovered ? 1 : 0.88;
        context.fill();
        context.globalAlpha = 1;
        context.lineWidth = isHovered ? 2.5 : 1;
        context.strokeStyle = isHovered ? palette.selected : palette.text;
        context.stroke();
        if (cluster.review_flag) {
          context.beginPath();
          context.arc(cluster.x, cluster.y, cluster.radius + 3, 0, Math.PI * 2);
          context.setLineDash([3, 3]);
          context.lineWidth = 1.2;
          context.strokeStyle = palette.falsePositive;
          context.stroke();
          context.setLineDash([]);
        }
        if (cluster.radius >= 10 || isHovered || isFocused) {
          context.fillStyle = palette.markText;
          context.font = `${cluster.radius >= 18 ? 9 : 7}px Fragment Mono`;
          context.textAlign = "center";
          context.fillText(groupCode(cluster), cluster.x, cluster.y);
        }
      }
      const focusedCluster = layout.clusters.find((cluster) => cluster.id === focusedClusterId);
      if (focusedCluster !== undefined) {
        drawFocusReticle(context, focusedCluster.x, focusedCluster.y, focusedCluster.radius, 1, palette.focus);
      }

      context.fillStyle = palette.muted;
      context.font = "8px Fragment Mono";
      context.textAlign = "center";
      context.fillText("EVIDENCE CONFIDENCE →", (plot.left + plot.right) / 2, size.height - 14);
      context.save();
      context.translate(14, (plot.top + plot.bottom) / 2);
      context.rotate(-Math.PI / 2);
      context.fillText("POINTS SHARE →", 0, 0);
      context.restore();
    };
    drawRef.current = draw;
    draw();
  }, [focusedClusterId, layout, resetKey, size.height, size.width, theme]);

  const hitCluster = (clientX: number, clientY: number): PositionedCluster | null => {
    const canvas = canvasRef.current;
    if (canvas === null) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let nearest: PositionedCluster | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const cluster of layout.clusters) {
      const distance = Math.hypot(cluster.x - x, cluster.y - y);
      if (distance <= cluster.radius + 4 && distance < nearestDistance) {
        nearest = cluster;
        nearestDistance = distance;
      }
    }
    return nearest;
  };

  return (
    <div className="cluster-atlas-shell" ref={shellRef}>
      <canvas
        ref={canvasRef}
        className="cluster-atlas-canvas"
        role="application"
        tabIndex={0}
        aria-label={`Cluster evidence atlas with ${overview.clusters.length} groups. Confidence increases to the right and points share increases upward.${focusedClusterId === null ? "" : " The group containing your wallet is marked with a YOU reticle."}`}
        onPointerMove={(event) => {
          const next = hitCluster(event.clientX, event.clientY);
          if (next?.id !== hoveredRef.current?.id) {
            hoveredRef.current = next;
            setHovered(next);
            drawRef.current();
          }
        }}
        onPointerLeave={() => {
          hoveredRef.current = null;
          setHovered(null);
          drawRef.current();
        }}
        onClick={(event) => {
          const cluster = hitCluster(event.clientX, event.clientY);
          if (cluster !== null) onOpenCluster(cluster.id);
        }}
      />
      {hovered === null ? null : (
        <div className="map-hover-card atlas-hover-card" aria-hidden="true">
          <strong>{clusterLabel(hovered.id)} · {hovered.risk.toUpperCase()}</strong>
          <span>{formatCount(hovered.size)} wallets · {formatPercent(hovered.points_share)} of points</span>
          <small>{formatPercent(hovered.confidence)} confidence · {hovered.families.join(" / ")}</small>
          {hovered.review_flag ? <b>POSSIBLE FALSE POSITIVE · REVIEW</b> : null}
        </div>
      )}
      <div className="map-instructions" aria-hidden="true">CLICK GROUP · X CONFIDENCE · Y POINTS SHARE · SIZE WALLETS</div>
    </div>
  );
}
