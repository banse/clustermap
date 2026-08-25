import { useEffect, useMemo, useRef, useState } from "react";

import type { DeltaClass, GlobalMap, RiskTier } from "../models/domain";
import { buildGlobalLayout, type PositionedGlobalNode } from "../models/globalLayout";
import { deltaLabel, formatCompact, riskLabel } from "../models/presentation";
import type { ThemeId } from "../models/theme";
import { drawFocusReticle } from "./drawFocusReticle";

interface GlobalWalletMapProps {
  readonly map: GlobalMap;
  readonly theme: ThemeId;
  readonly selectedAddress: string | null;
  readonly focusedAddress: string | null;
  readonly deltaClasses?: readonly DeltaClass[] | null;
  readonly deltaFilter?: DeltaClass | "all";
  readonly resetKey: number;
  readonly onSelectWallet: (address: string, clusterId: number | null) => void;
}

interface Transform { x: number; y: number; k: number }

interface Palette {
  readonly background: string;
  readonly grid: string;
  readonly text: string;
  readonly selected: string;
  readonly focus: string;
  readonly falsePositive: string;
  readonly deltas: Readonly<Record<DeltaClass, string>>;
  readonly risks: Readonly<Record<RiskTier, string>>;
}

const CELL_SIZE = 24;

function cssColor(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  return styles.getPropertyValue(name).trim() || fallback;
}

function paletteFromTheme(): Palette {
  const styles = getComputedStyle(document.documentElement);
  return {
    background: cssColor(styles, "--map-background", "#101410"),
    grid: cssColor(styles, "--map-grid", "rgba(0,255,65,.08)"),
    text: cssColor(styles, "--map-text", "#00dd33"),
    selected: cssColor(styles, "--map-selected", "#ffffff"),
    focus: cssColor(styles, "--wallet-focus", "#e8fff0"),
    falsePositive: cssColor(styles, "--map-false-positive", "#ffffff"),
    deltas: {
      improved: cssColor(styles, "--delta-improved", "#36dc82"),
      worsened: cssColor(styles, "--delta-worsened", "#ff4055"),
      under_review: cssColor(styles, "--delta-under-review", "#f0cc4d"),
      unchanged: cssColor(styles, "--delta-unchanged", "#718078"),
    },
    risks: {
      independent: cssColor(styles, "--risk-independent", "#00d66b"),
      review: cssColor(styles, "--risk-review", "#f0cc4d"),
      elevated: cssColor(styles, "--risk-elevated", "#ff8c42"),
      critical: cssColor(styles, "--risk-critical", "#ff4055"),
    },
  };
}

function cellKey(x: number, y: number): string {
  return `${Math.floor(x / CELL_SIZE)}:${Math.floor(y / CELL_SIZE)}`;
}

export function GlobalWalletMap({ map, theme, selectedAddress, focusedAddress, deltaClasses = null, deltaFilter = "all", resetKey, onSelectWallet }: GlobalWalletMapProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<readonly PositionedGlobalNode[]>([]);
  const transformRef = useRef<Transform>({ x: 0, y: 0, k: 1 });
  const fittedViewRef = useRef("");
  const drawRef = useRef<() => void>(() => undefined);
  const hoveredRef = useRef<PositionedGlobalNode | null>(null);
  const [hovered, setHovered] = useState<PositionedGlobalNode | null>(null);
  const [size, setSize] = useState({ width: 900, height: 660 });
  const layout = useMemo(() => buildGlobalLayout(map), [map]);
  const deltaByAddress = useMemo(() => {
    if (deltaClasses === null) return null;
    return new Map(map.nodes.map((node, index) => [node.address, deltaClasses[index] ?? "unchanged"]));
  }, [deltaClasses, map.nodes]);
  const spatialIndex = useMemo(() => {
    const index = new Map<string, PositionedGlobalNode[]>();
    for (const node of layout.nodes) {
      const key = cellKey(node.x, node.y);
      const bucket = index.get(key) ?? [];
      bucket.push(node);
      index.set(key, bucket);
    }
    return index;
  }, [layout]);

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
    const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));
    nodesRef.current = layout.nodes;
    canvas.width = Math.floor(size.width * ratio);
    canvas.height = Math.floor(size.height * ratio);
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    const fittedView = `${map.version}:${size.width}:${size.height}:${resetKey}`;
    if (fittedViewRef.current !== fittedView) {
      const worldWidth = layout.bounds.maxX - layout.bounds.minX;
      const worldHeight = layout.bounds.maxY - layout.bounds.minY;
      const fit = Math.min(size.width / worldWidth, size.height / worldHeight) * 0.94;
      transformRef.current = {
        k: fit,
        x: size.width / 2 - ((layout.bounds.minX + layout.bounds.maxX) / 2) * fit,
        y: size.height / 2 - ((layout.bounds.minY + layout.bounds.maxY) / 2) * fit,
      };
      fittedViewRef.current = fittedView;
    }

    const draw = () => {
      const transform = transformRef.current;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, size.width, size.height);
      context.fillStyle = palette.background;
      context.fillRect(0, 0, size.width, size.height);
      context.save();
      context.translate(transform.x, transform.y);
      context.scale(transform.k, transform.k);

      context.strokeStyle = palette.grid;
      context.lineWidth = Math.max(0.35, 0.6 / transform.k);
      const grid = 96;
      for (let x = Math.floor(layout.bounds.minX / grid) * grid; x <= layout.bounds.maxX; x += grid) {
        context.beginPath(); context.moveTo(x, layout.bounds.minY); context.lineTo(x, layout.bounds.maxY); context.stroke();
      }
      for (let y = Math.floor(layout.bounds.minY / grid) * grid; y <= layout.bounds.maxY; y += grid) {
        context.beginPath(); context.moveTo(layout.bounds.minX, y); context.lineTo(layout.bounds.maxX, y); context.stroke();
      }

      for (const edge of map.edges) {
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);
        if (source === undefined || target === undefined) continue;
        context.beginPath();
        context.moveTo(source.x, source.y);
        context.lineTo(target.x, target.y);
        context.strokeStyle = deltaByAddress === null ? palette.risks[edge.risk] : palette.deltas.unchanged;
        context.globalAlpha = deltaByAddress === null ? 0.18 + Math.min(0.32, edge.strength * 0.22) : 0.08;
        context.lineWidth = Math.max(0.35, 0.75 / transform.k);
        context.stroke();
      }
      context.globalAlpha = 1;

      for (const node of layout.nodes) {
        const selected = node.address === selectedAddress;
        const focused = node.address === focusedAddress;
        const isHovered = hoveredRef.current?.id === node.id;
        const deltaClass = deltaByAddress?.get(node.address) ?? null;
        const visible = deltaClass === null || deltaFilter === "all" || deltaClass === deltaFilter;
        const radius = Math.max(node.radius, (node.cluster_id === null ? 0.75 : 1.05) / transform.k);
        context.beginPath();
        context.arc(node.x, node.y, radius, 0, Math.PI * 2);
        context.fillStyle = deltaClass === null ? palette.risks[node.risk] : palette.deltas[deltaClass];
        context.globalAlpha = visible ? 1 : 0.08;
        context.fill();
        context.globalAlpha = 1;
        if (selected || isHovered) {
          context.lineWidth = 2.4 / transform.k;
          context.strokeStyle = palette.selected;
          context.stroke();
        } else if (node.review_flag && radius * transform.k >= 1.4) {
          context.beginPath();
          context.arc(node.x, node.y, radius + 2 / transform.k, 0, Math.PI * 2);
          context.setLineDash([2.5 / transform.k, 2 / transform.k]);
          context.lineWidth = 1 / transform.k;
          context.strokeStyle = palette.falsePositive;
          context.stroke();
          context.setLineDash([]);
        }
        if (selected || radius * transform.k >= 7) {
          context.fillStyle = palette.text;
          context.font = `${Math.max(7, 9 / transform.k)}px Fragment Mono`;
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(`#${node.rank}`, node.x, node.y);
        }
      }
      const focusedNode = layout.nodes.find((node) => node.address === focusedAddress);
      if (focusedNode !== undefined) {
        const radius = Math.max(focusedNode.radius, (focusedNode.cluster_id === null ? 0.75 : 1.05) / transform.k);
        drawFocusReticle(context, focusedNode.x, focusedNode.y, radius, transform.k, palette.focus);
      }
      context.restore();
    };
    drawRef.current = draw;
    draw();
  }, [deltaByAddress, deltaFilter, focusedAddress, layout, map.edges, resetKey, selectedAddress, size.height, size.width, theme]);

  const screenToWorld = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const transform = transformRef.current;
    return { x: (clientX - rect.left - transform.x) / transform.k, y: (clientY - rect.top - transform.y) / transform.k };
  };

  const hitNode = (clientX: number, clientY: number): PositionedGlobalNode | null => {
    const point = screenToWorld(clientX, clientY);
    const tolerance = 7 / transformRef.current.k;
    const cellRange = Math.max(1, Math.ceil(tolerance / CELL_SIZE));
    const cellX = Math.floor(point.x / CELL_SIZE);
    const cellY = Math.floor(point.y / CELL_SIZE);
    let nearest: PositionedGlobalNode | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let x = cellX - cellRange; x <= cellX + cellRange; x += 1) {
      for (let y = cellY - cellRange; y <= cellY + cellRange; y += 1) {
        for (const node of spatialIndex.get(`${x}:${y}`) ?? []) {
          const distance = Math.hypot(point.x - node.x, point.y - node.y);
          if (distance <= Math.max(node.radius, tolerance) && distance < nearestDistance) {
            nearest = node;
            nearestDistance = distance;
          }
        }
      }
    }
    return nearest;
  };

  const gesture = useRef<{ startX: number; startY: number; transformX: number; transformY: number; node: PositionedGlobalNode | null; moved: boolean } | null>(null);

  return (
    <div className="global-map-shell" ref={shellRef}>
      <canvas
        ref={canvasRef}
        className="global-map-canvas"
        role="application"
        tabIndex={0}
        aria-label={`Global wallet map with ${map.meta.node_count} wallets and ${map.meta.edge_count} evidence links.${focusedAddress === null ? "" : " Your wallet is marked with a YOU reticle."}`}
        onPointerDown={(event) => {
          gesture.current = {
            startX: event.clientX,
            startY: event.clientY,
            transformX: transformRef.current.x,
            transformY: transformRef.current.y,
            node: hitNode(event.clientX, event.clientY),
            moved: false,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const active = gesture.current;
          if (active !== null) {
            const dx = event.clientX - active.startX;
            const dy = event.clientY - active.startY;
            if (Math.hypot(dx, dy) > 3) active.moved = true;
            if (active.moved) {
              transformRef.current = { ...transformRef.current, x: active.transformX + dx, y: active.transformY + dy };
              drawRef.current();
            }
            return;
          }
          const next = hitNode(event.clientX, event.clientY);
          if (next?.id !== hoveredRef.current?.id) {
            hoveredRef.current = next;
            setHovered(next);
            drawRef.current();
          }
        }}
        onPointerUp={(event) => {
          const active = gesture.current;
          if (active !== null && !active.moved && active.node !== null) onSelectWallet(active.node.address, active.node.cluster_id);
          gesture.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerLeave={() => {
          gesture.current = null;
          hoveredRef.current = null;
          setHovered(null);
          drawRef.current();
        }}
        onWheel={(event) => {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          const previous = transformRef.current;
          const nextScale = Math.max(0.12, Math.min(14, previous.k * Math.exp(-event.deltaY * 0.001)));
          const pointerX = event.clientX - rect.left;
          const pointerY = event.clientY - rect.top;
          transformRef.current = {
            k: nextScale,
            x: pointerX - ((pointerX - previous.x) / previous.k) * nextScale,
            y: pointerY - ((pointerY - previous.y) / previous.k) * nextScale,
          };
          drawRef.current();
        }}
      />
      {hovered === null ? null : (
        <div className="map-hover-card" aria-hidden="true">
          <strong>#{hovered.rank} · {formatCompact(hovered.points)} PTS</strong>
          <span>{hovered.name ?? `${hovered.address.slice(0, 8)}…${hovered.address.slice(-6)}`}</span>
          <small>{riskLabel(hovered.risk).toUpperCase()}{hovered.review_flag ? " · REVIEW" : ""}</small>
          {deltaByAddress === null ? null : <b>{deltaLabel(deltaByAddress.get(hovered.address) ?? "unchanged").toUpperCase()}</b>}
        </div>
      )}
      <div className="map-instructions" aria-hidden="true">PAN · SCROLL TO ZOOM · CLICK WALLET</div>
    </div>
  );
}
