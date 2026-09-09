"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { TraceGraph, TraceNode, TypologyFlag } from "@/lib/tracers/types";
import { TYPOLOGY_LABEL } from "@/lib/typology";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { Chain } from "@/lib/generated/prisma/client";
import { AlertTriangle, ShieldCheck } from "lucide-react";

// react-force-graph-2d touches window/canvas at import time — must load client-only.
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

// Functional color — deliberately outside the blue chrome palette in
// globals.css (PLAN.md Day 4: "blue is for chrome," node kind is meaning).
// BRIDGE was #2563eb before the Day 4 repaint, which is now byte-identical
// to --primary; a BRIDGE node would have silently read as "app chrome"
// instead of a node kind. Moved to teal so every kind stays visually
// distinct from the new blue UI.
const NODE_COLOR: Record<TraceNode["kind"], string> = {
  SUSPECT: "#dc2626", // red
  INTERMEDIARY: "#6b7280", // muted gray
  EXCHANGE: "#16a34a", // green
  MIXER: "#ea580c", // orange
  DARKNET: "#7f1d1d", // dark red
  RANSOMWARE: "#7f1d1d", // dark red
  BRIDGE: "#0d9488", // teal — was #2563eb, collided with the new --primary
  UNKNOWN: "#6b7280",
};

const NODE_KIND_LABEL: Record<TraceNode["kind"], string> = {
  SUSPECT: "Suspect",
  INTERMEDIARY: "Intermediary",
  EXCHANGE: "Exchange",
  MIXER: "Mixer",
  DARKNET: "Darknet",
  RANSOMWARE: "Ransomware",
  BRIDGE: "Bridge",
  UNKNOWN: "Unknown",
};

// Distinct from NODE_COLOR so a flagged edge reads as its own signal even
// when it touches an already-colored node (e.g. an edge into a mixer).
const FLAG_COLOR: Record<TypologyFlag, string> = {
  FAN_OUT: "#f59e0b", // amber
  PEEL_CHAIN: "#9333ea", // purple
  RAPID_MIXER_HOP: "#ea580c", // orange
};

function short(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// TraceEdge.valueWei is the smallest base unit for whichever chain the
// trace ran on (wei / satoshis / sun) — divisor+symbol keyed off it here
// rather than renaming the field across every file that touches it.
const CHAIN_UNIT: Record<Chain, { symbol: string; decimals: number }> = {
  ETHEREUM: { symbol: "ETH", decimals: 18 },
  BITCOIN: { symbol: "BTC", decimals: 8 },
  TRON: { symbol: "TRX", decimals: 6 },
};

function formatValue(baseUnits: string, chain: Chain) {
  const { symbol, decimals } = CHAIN_UNIT[chain];
  return `${(Number(BigInt(baseUnits)) / 10 ** decimals).toFixed(4)} ${symbol}`;
}

// react-force-graph-2d's node/link callback types don't survive next/dynamic's
// generic erasure, so callbacks below are typed loosely and cast at use sites.
type GraphNode = TraceNode & { id: string; x: number; y: number };
type GraphLink = { source: string; target: string; label: string; flags: TypologyFlag[] };

// Radial layout (rings by hop depth) as the starting position for each
// node — depth is instantly readable, and it gives d3-force a sane starting
// point instead of random placement. Positions aren't pinned (no fx/fy), so
// the physics simulation still settles them and drag/zoom keep working.
const RING_SPACING = 130;

export function GraphView({ graph }: { graph: TraceGraph }) {
  const [selected, setSelected] = useState<TraceNode | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ForceGraphMethods generic doesn't survive next/dynamic
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // ForceGraph2D defaults its width to window.innerWidth, not its parent, so
  // without this the canvas is laid out far wider than the container and
  // zoomToFit centres the graph into the clipped-off region.
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Seed synchronously: when the graph mounts after a trace completes the
    // observer's first callback can land too late (or not at all) and the
    // canvas stays 0-wide.
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const graphData = useMemo(() => {
    const byDepth = new Map<number, string[]>();
    for (const n of graph.nodes) {
      const arr = byDepth.get(n.depth) ?? [];
      arr.push(n.address);
      byDepth.set(n.depth, arr);
    }

    const nodes = graph.nodes.map((n) => {
      const siblings = byDepth.get(n.depth)!;
      const i = siblings.indexOf(n.address);
      const angle = (2 * Math.PI * i) / siblings.length;
      const radius = n.depth * RING_SPACING;
      return {
        ...n,
        id: n.address,
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
      };
    });

    const links = graph.edges.map((e) => ({
      source: e.from,
      target: e.to,
      label: [
        `${formatValue(e.valueWei, graph.chain)} · ${e.txCount} tx · ${new Date(e.latestTimestamp * 1000).toLocaleDateString()}`,
        ...e.typologyFlags.map((f) => TYPOLOGY_LABEL[f]),
      ].join(" — "),
      flags: e.typologyFlags,
    }));

    return { nodes, links };
  }, [graph]);

  // onEngineStop alone isn't enough: nodes get radial start positions, so a
  // small graph can settle (and fit) before the measured width lands, leaving
  // the camera framed for the wrong canvas size.
  useEffect(() => {
    if (width > 0) fgRef.current?.zoomToFit(400, 60);
  }, [width, graphData]);

  // Kinds actually present in this trace, in a fixed display order — a
  // legend entry for a kind the graph never produced (e.g. RANSOMWARE on a
  // clean trace) is noise, not a legend.
  const presentKinds = useMemo(() => {
    const order: TraceNode["kind"][] = [
      "SUSPECT",
      "EXCHANGE",
      "INTERMEDIARY",
      "MIXER",
      "BRIDGE",
      "DARKNET",
      "RANSOMWARE",
      "UNKNOWN",
    ];
    const seen = new Set(graph.nodes.map((n) => n.kind));
    return order.filter((k) => seen.has(k));
  }, [graph.nodes]);

  // Pixel radius for a node — shared between the paint callback and the
  // pointer hit-area so clicks land exactly where the circle is drawn.
  function nodeRadius(node: GraphNode) {
    if (node.kind === "SUSPECT") return 9;
    if (node.typologyFlags.length > 0) return 7;
    return 5.5;
  }

  return (
    <div
      ref={containerRef}
      className="relative h-[500px] w-full overflow-hidden rounded-xl border border-border bg-card backdrop-blur-xl"
    >
      <ForceGraph2D
        ref={fgRef}
        width={width}
        graphData={graphData}
        nodeId="id"
        nodeLabel={(n) => {
          const node = n as GraphNode;
          const base = `${node.entityName ?? short(node.address)} (${node.kind})`;
          return node.typologyFlags.length > 0
            ? `${base} — ${node.typologyFlags.map((f) => TYPOLOGY_LABEL[f]).join(", ")}`
            : base;
        }}
        nodeCanvasObject={(n, ctx, globalScale) => {
          const node = n as GraphNode;
          const r = nodeRadius(node);
          const color = NODE_COLOR[node.kind];

          // Glow/halo on the suspect root — the one node every trace has,
          // and the thing a judge's eye should find first on the canvas.
          if (node.kind === "SUSPECT") {
            const glow = ctx.createRadialGradient(node.x, node.y, r * 0.5, node.x, node.y, r * 3.2);
            glow.addColorStop(0, "rgba(220, 38, 38, 0.35)");
            glow.addColorStop(1, "rgba(220, 38, 38, 0)");
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r * 3.2, 0, 2 * Math.PI);
            ctx.fill();
          }

          // A thin ring in the flag color reads as "this node was flagged"
          // even before hover, distinct from the fill (which is node kind).
          if (node.typologyFlags.length > 0) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 2.5, 0, 2 * Math.PI);
            ctx.strokeStyle = FLAG_COLOR[node.typologyFlags[0]];
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
          ctx.stroke();

          // On-canvas label — text drawn directly rather than hover-only,
          // so the trail reads at a glance on a projector. Skip while
          // heavily zoomed out (labels would overlap/blur into noise).
          if (globalScale > 1.1) {
            const label = node.entityName ?? short(node.address);
            const fontSize = Math.max(10 / globalScale, 3.4);
            ctx.font = `${node.kind === "SUSPECT" ? "600" : "400"} ${fontSize}px system-ui, sans-serif`;
            ctx.textAlign = "center";
            // The radial layout puts every depth-1 node level with the
            // suspect (angle 0/π when there are 2 siblings) — a below-node
            // label for the suspect then collides with its own immediate
            // neighbor's label. Drawing the suspect's label above instead
            // sidesteps the single most common case (small trace, few
            // depth-1 nodes); it's a placement heuristic, not full
            // collision avoidance across the whole graph.
            const above = node.kind === "SUSPECT";
            const y = above ? node.y - r - 2 : node.y + r + 2;

            // Solid rounded chip behind the text, NOT ctx.strokeText.
            // strokeText traces each glyph's own outline, so a halo thick
            // enough to be readable spikes out at sharp letter corners and
            // blobs together around the "…" in a shortened address — the
            // ragged look in the reported bug. A measured rect is uniform
            // by construction and cheaper to draw.
            const padX = fontSize * 0.4;
            const padY = fontSize * 0.25;
            const textW = ctx.measureText(label).width;
            const boxW = textW + padX * 2;
            const boxH = fontSize + padY * 2;
            const boxX = node.x - boxW / 2;
            const boxY = above ? y - boxH : y;

            ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
            ctx.beginPath();
            if (typeof ctx.roundRect === "function") {
              ctx.roundRect(boxX, boxY, boxW, boxH, Math.min(3, fontSize * 0.35));
            } else {
              ctx.rect(boxX, boxY, boxW, boxH);
            }
            ctx.fill();

            ctx.fillStyle = "#1e293b";
            ctx.textBaseline = "middle";
            ctx.fillText(label, node.x, boxY + boxH / 2);
          }
        }}
        nodePointerAreaPaint={(n, color, ctx) => {
          const node = n as GraphNode;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeRadius(node) + 2, 0, 2 * Math.PI);
          ctx.fill();
        }}
        // nodeCanvasObject above only replaces the paint step — the force
        // simulation still reads nodeVal for collision size, so a bigger
        // suspect/flagged node keeps repelling neighbors more than it would
        // as an unweighted point mass.
        nodeVal={(n) => {
          const node = n as GraphNode;
          if (node.kind === "SUSPECT") return 3;
          return node.typologyFlags.length > 0 ? 2.2 : 1.5;
        }}
        linkLabel={(l) => (l as unknown as GraphLink).label}
        linkWidth={(l) => ((l as unknown as GraphLink).flags.length > 0 ? 3 : 1.5)}
        linkColor={(l) => {
          const flags = (l as unknown as GraphLink).flags;
          return flags.length > 0 ? FLAG_COLOR[flags[0]] : "#9ca3af";
        }}
        linkCurvature={0.2}
        linkDirectionalArrowLength={5}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={(l) => ((l as unknown as GraphLink).flags.length > 0 ? 3 : 2)}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleSpeed={0.004}
        onNodeClick={(n) => setSelected(n as GraphNode)}
        onEngineStop={() => fgRef.current?.zoomToFit(400, 60)}
        height={500}
      />

      {/* Legend — the color coding was undiscoverable without hovering a
          node/link. Only lists kinds this specific trace actually has. */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-x-3 gap-y-1.5 rounded-lg border border-border bg-background/85 px-3 py-2 text-xs backdrop-blur-xl">
        {presentKinds.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: NODE_COLOR[k] }} />
            {NODE_KIND_LABEL[k]}
          </span>
        ))}
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="font-mono text-sm break-all">{selected?.address}</SheetTitle>
            <SheetDescription>Hop {selected?.depth} from suspect wallet</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4">
            <Badge style={{ backgroundColor: selected ? NODE_COLOR[selected.kind] : undefined }}>
              {selected?.kind}
            </Badge>
            {selected?.entityName && (
              <div>
                <div className="text-xs text-muted-foreground">Entity</div>
                <div className="text-sm font-medium">{selected.entityName}</div>
              </div>
            )}
            {selected?.confidence && (
              <div>
                <div className="text-xs text-muted-foreground">Confidence</div>
                <div className="flex items-center gap-1.5 text-sm capitalize">
                  <ShieldCheck className="size-3.5 text-muted-foreground" />
                  {selected.confidence}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selected.confidenceReason ?? "Exact address match against the labeled-address DB"}
                </div>
              </div>
            )}
            {selected?.source && (
              <div>
                <div className="text-xs text-muted-foreground">Source</div>
                <div className="text-sm">{selected.source}</div>
              </div>
            )}
            {selected?.stopReason && (
              <div>
                <div className="text-xs text-muted-foreground">Trace stopped here</div>
                <div className="text-sm">{selected.stopReason.replaceAll("_", " ")}</div>
              </div>
            )}
            {selected && selected.typologyFlags.length > 0 && (
              <div>
                <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <AlertTriangle className="size-3.5" />
                  Typology flags (heuristic)
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selected.typologyFlags.map((f) => (
                    <Badge key={f} style={{ backgroundColor: FLAG_COLOR[f] }}>
                      {TYPOLOGY_LABEL[f]}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
