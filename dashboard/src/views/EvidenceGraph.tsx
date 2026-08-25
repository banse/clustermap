import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ClusterDetail, EvidenceFamily, Overview, RiskTier } from "../models/domain";
import { clusterLabel, formatCompact } from "../models/presentation";
import type { ThemeId } from "../models/theme";
import { drawFocusReticle } from "./drawFocusReticle";

interface EvidenceGraphProps {
  readonly overview: Overview;
  readonly detail: ClusterDetail | null;
  readonly selectedAddress: string | null;
  readonly focusedAddress: string | null;
  readonly resetKey: number;
  readonly theme?: ThemeId;
  readonly onOpenCluster: (id: number) => void;
  readonly onSelectWallet: (address: string, clusterId: number) => void;
}

interface GraphNode extends SimulationNodeDatum {
  readonly id: string;
  readonly radius: number;
  readonly label: string;
  readonly sublabel: string;
  readonly risk: Exclude<RiskTier, "independent">;
  readonly reviewFlag: boolean;
  readonly clusterId: number;
  readonly address: string | null;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  readonly family: EvidenceFamily;
  readonly strength: number;
  readonly isTransfer: boolean;
  readonly risk: Exclude<RiskTier, "independent">;
}

interface Transform {
  x: number;
  y: number;
  k: number;
}

interface GraphPalette {
  readonly ink: string;
  readonly markInk: string;
  readonly paper: string;
  readonly lime: string;
  readonly grid: string;
  readonly review: string;
  readonly elevated: string;
  readonly critical: string;
  readonly falsePositive: string;
  readonly focus: string;
}

function graphPalette(): GraphPalette {
  const styles = getComputedStyle(document.documentElement);
  const color = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  return {
    ink: color("--map-text", "#00dd33"), markInk: color("--map-mark-text", "#071008"),
    paper: color("--map-background", "#1c1c1c"), lime: color("--map-selected", "#00ff41"),
    grid: color("--map-grid", "rgba(0,255,65,.08)"),
    review: color("--risk-review", "#ffe45c"), elevated: color("--risk-elevated", "#ff8a00"),
    critical: color("--risk-critical", "#ff0040"), falsePositive: color("--map-false-positive", "#ffffff"),
    focus: color("--wallet-focus", "#e8fff0"),
  };
}

function riskColor(risk: Exclude<RiskTier, "independent">, palette: GraphPalette): string {
  return palette[risk];
}

function hashPosition(id: string, width: number, height: number): [number, number] {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const angle = ((hash >>> 0) % 360) * (Math.PI / 180);
  const radius = 30 + ((hash >>> 8) % Math.max(40, Math.floor(Math.min(width, height) * 0.36)));
  return [width / 2 + Math.cos(angle) * radius, height / 2 + Math.sin(angle) * radius];
}

export function EvidenceGraph({
  overview,
  detail,
  selectedAddress,
  focusedAddress,
  resetKey,
  theme = "maxpane",
  onOpenCluster,
  onSelectWallet,
}: EvidenceGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const transformRef = useRef<Transform>({ x: 0, y: 0, k: 1 });
  const drawRef = useRef<() => void>(() => undefined);
  const hoveredRef = useRef<GraphNode | null>(null);
  const [size, setSize] = useState({ width: 800, height: 620 });
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const palette = useMemo(() => graphPalette(), [theme]);

  const graph = useMemo(() => {
    if (detail === null) {
      return {
        nodes: overview.clusters.map((cluster) => ({
          id: `cluster-${cluster.id}`,
          radius: Math.max(8, Math.min(48, 8 + Math.sqrt(cluster.points_share) * 105)),
          label: `G${String(cluster.id + 1).padStart(3, "0")}`,
          sublabel: `${formatCompact(cluster.size)} wallets`,
          risk: cluster.risk,
          reviewFlag: cluster.review_flag,
          clusterId: cluster.id,
          address: null,
        } satisfies GraphNode)),
        links: [] as GraphLink[],
      };
    }
    const maxPoints = Math.max(...detail.nodes.map((node) => node.points), 1);
    return {
      nodes: detail.nodes.map((node) => ({
        id: node.id,
        radius: 4 + Math.sqrt(node.points / maxPoints) * 18,
        label: `#${node.rank}`,
        sublabel: `${formatCompact(node.points)} pts`,
        risk: detail.cluster.risk,
        reviewFlag: detail.cluster.review_flag,
        clusterId: detail.cluster.id,
        address: node.address,
      } satisfies GraphNode)),
      links: detail.edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        family: edge.family,
        strength: edge.strength,
        isTransfer: edge.is_transfer,
        risk: detail.cluster.risk,
      } satisfies GraphLink)),
    };
  }, [detail, overview.clusters]);

  useEffect(() => {
    const shell = shellRef.current;
    if (shell === null) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(320, Math.floor(entry.contentRect.width)),
        height: Math.max(460, Math.floor(entry.contentRect.height)),
      });
    });
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const context = canvas.getContext("2d");
    if (context === null) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(size.width * ratio);
    canvas.height = Math.floor(size.height * ratio);
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    transformRef.current = { x: 0, y: 0, k: 1 };

    const nodes = graph.nodes.map((node) => {
      const [x, y] = hashPosition(node.id, size.width, size.height);
      return { ...node, x, y };
    });
    const links = graph.links.map((link) => ({ ...link }));
    nodesRef.current = nodes;

    const draw = () => {
      const transform = transformRef.current;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, size.width, size.height);
      context.fillStyle = palette.paper;
      context.fillRect(0, 0, size.width, size.height);
      context.save();
      context.translate(transform.x, transform.y);
      context.scale(transform.k, transform.k);

      context.strokeStyle = palette.grid;
      context.lineWidth = 1 / transform.k;
      const grid = 48;
      for (let x = 0; x <= size.width; x += grid) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, size.height);
        context.stroke();
      }
      for (let y = 0; y <= size.height; y += grid) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(size.width, y);
        context.stroke();
      }

      for (const link of links) {
        const source = link.source as GraphNode;
        const target = link.target as GraphNode;
        if (source.x === undefined || source.y === undefined || target.x === undefined || target.y === undefined) continue;
        context.beginPath();
        context.moveTo(source.x, source.y);
        context.lineTo(target.x, target.y);
        context.strokeStyle = riskColor(link.risk, palette);
        context.globalAlpha = Math.max(0.16, Math.min(0.7, link.strength * 0.65));
        context.lineWidth = (link.isTransfer ? 1.6 : 0.8) / transform.k;
        context.setLineDash(link.isTransfer ? [] : [4 / transform.k, 5 / transform.k]);
        context.stroke();
      }
      context.globalAlpha = 1;
      context.setLineDash([]);

      for (const node of nodes) {
        if (node.x === undefined || node.y === undefined) continue;
        const selected = node.address !== null && node.address === selectedAddress;
        const focused = node.address !== null && node.address === focusedAddress;
        const isHovered = hoveredRef.current?.id === node.id;
        context.beginPath();
        context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        context.fillStyle = selected ? palette.lime : riskColor(node.risk, palette);
        context.fill();
        context.lineWidth = (selected || isHovered ? 3 : 1.5) / transform.k;
        context.strokeStyle = palette.ink;
        context.stroke();
        if (node.reviewFlag && !selected) {
          context.beginPath();
          context.arc(node.x, node.y, node.radius + 2.5 / transform.k, 0, Math.PI * 2);
          context.setLineDash([3 / transform.k, 3 / transform.k]);
          context.lineWidth = 1.4 / transform.k;
          context.strokeStyle = palette.falsePositive;
          context.stroke();
          context.setLineDash([]);
        }
        if (node.address === null || node.radius * transform.k >= 11 || selected || focused) {
          context.fillStyle = node.address === null || selected ? palette.markInk : palette.ink;
          context.font = `${Math.max(7, Math.min(11, node.radius * 0.45)) / transform.k}px Fragment Mono`;
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(node.label, node.x, node.y);
        }
      }
      const focusedNode = nodes.find((node) => node.address !== null && node.address === focusedAddress);
      if (focusedNode?.x !== undefined && focusedNode.y !== undefined) {
        drawFocusReticle(context, focusedNode.x, focusedNode.y, focusedNode.radius, transform.k, palette.focus);
      }
      context.restore();
    };
    drawRef.current = draw;

    const simulation = forceSimulation<GraphNode>(nodes)
      .force("center", forceCenter(size.width / 2, size.height / 2))
      .force("x", forceX(size.width / 2).strength(detail === null ? 0.035 : 0.012))
      .force("y", forceY(size.height / 2).strength(detail === null ? 0.035 : 0.012))
      .force("charge", forceManyBody().strength(detail === null ? -24 : -9))
      .force("collide", forceCollide<GraphNode>().radius((node) => node.radius + 3).iterations(2))
      .alphaDecay(detail === null ? 0.045 : 0.06)
      .on("tick", draw);
    if (links.length > 0) {
      simulation.force(
        "link",
        forceLink<GraphNode, GraphLink>(links)
          .id((node) => node.id)
          .distance((link) => (link.isTransfer ? 28 : 42))
          .strength((link) => Math.max(0.03, link.strength * 0.12)),
      );
    }
    simulationRef.current = simulation;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      simulation.stop();
      for (let index = 0; index < 180; index += 1) simulation.tick();
      draw();
    }
    return () => {
      simulation.stop();
    };
  }, [detail, focusedAddress, graph, palette, resetKey, selectedAddress, size.height, size.width]);

  const screenToWorld = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const transform = transformRef.current;
    return {
      x: (clientX - rect.left - transform.x) / transform.k,
      y: (clientY - rect.top - transform.y) / transform.k,
    };
  };

  const hitNode = (clientX: number, clientY: number): GraphNode | null => {
    const point = screenToWorld(clientX, clientY);
    for (let index = nodesRef.current.length - 1; index >= 0; index -= 1) {
      const node = nodesRef.current[index];
      const dx = point.x - (node.x ?? 0);
      const dy = point.y - (node.y ?? 0);
      if (dx * dx + dy * dy <= node.radius * node.radius) return node;
    }
    return null;
  };

  const gesture = useRef<{
    mode: "drag" | "pan";
    node: GraphNode | null;
    startX: number;
    startY: number;
    transformX: number;
    transformY: number;
    moved: boolean;
  } | null>(null);

  return (
    <div className="graph-shell" ref={shellRef}>
      <canvas
        ref={canvasRef}
        className="evidence-canvas"
        role="application"
        tabIndex={0}
        aria-label={
          detail === null
            ? `${overview.clusters.length} linked-wallet groups. Use the inspector list for keyboard navigation.`
            : `${detail.nodes.length} wallets in ${clusterLabel(detail.cluster.id)}.${focusedAddress === null ? "" : " Your wallet is marked with a YOU reticle."} Use the original list for keyboard navigation.`
        }
        onPointerDown={(event) => {
          const node = hitNode(event.clientX, event.clientY);
          gesture.current = {
            mode: node === null ? "pan" : "drag",
            node,
            startX: event.clientX,
            startY: event.clientY,
            transformX: transformRef.current.x,
            transformY: transformRef.current.y,
            moved: false,
          };
          if (node !== null) {
            node.fx = node.x;
            node.fy = node.y;
          }
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const active = gesture.current;
          if (active === null) {
            const next = hitNode(event.clientX, event.clientY);
            hoveredRef.current = next;
            setHovered(next);
            drawRef.current();
            return;
          }
          const dx = event.clientX - active.startX;
          const dy = event.clientY - active.startY;
          if (Math.hypot(dx, dy) > 3) active.moved = true;
          if (active.mode === "pan") {
            transformRef.current = {
              ...transformRef.current,
              x: active.transformX + dx,
              y: active.transformY + dy,
            };
            drawRef.current();
          } else if (active.node !== null) {
            const point = screenToWorld(event.clientX, event.clientY);
            active.node.fx = point.x;
            active.node.fy = point.y;
            simulationRef.current?.alphaTarget(0.16).restart();
          }
        }}
        onPointerUp={(event) => {
          const active = gesture.current;
          if (active?.node !== null && active?.node !== undefined) {
            active.node.fx = null;
            active.node.fy = null;
            simulationRef.current?.alphaTarget(0);
            if (!active.moved) {
              if (active.node.address === null) onOpenCluster(active.node.clusterId);
              else onSelectWallet(active.node.address, active.node.clusterId);
            }
          }
          gesture.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerLeave={() => {
          hoveredRef.current = null;
          setHovered(null);
          drawRef.current();
        }}
        onWheel={(event) => {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          const previous = transformRef.current;
          const nextScale = Math.max(0.45, Math.min(4, previous.k * Math.exp(-event.deltaY * 0.001)));
          const pointerX = event.clientX - rect.left;
          const pointerY = event.clientY - rect.top;
          transformRef.current = {
            k: nextScale,
            x: pointerX - ((pointerX - previous.x) / previous.k) * nextScale,
            y: pointerY - ((pointerY - previous.y) / previous.k) * nextScale,
          };
          drawRef.current();
        }}
        onKeyDown={(event) => {
          if (event.key === "Home") {
            transformRef.current = { x: 0, y: 0, k: 1 };
            drawRef.current();
          }
        }}
      />
      {hovered === null ? null : (
        <div className="graph-tooltip" aria-hidden="true">
          <strong>{hovered.address === null ? clusterLabel(hovered.clusterId) : hovered.label}</strong>
          <span>{hovered.sublabel}</span>
        </div>
      )}
      <div className="graph-scale" aria-hidden="true">
        DRAG NODES · PAN FIELD · SCROLL TO ZOOM
      </div>
    </div>
  );
}
