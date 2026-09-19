"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { TraceGraph, TraceNode, TypologyFlag } from "@/lib/tracers/types";
import type { LinkedCases } from "@/lib/linking";
import { TYPOLOGY_LABEL } from "@/lib/typology";
import { assetTotalsLabel, edgeAmountLabel, formatAssetValue, isContractCall } from "@/lib/format";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Link2, ShieldCheck } from "lucide-react";

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
  SANCTIONED: "#991b1b", // dark red, distinct from DARKNET/RANSOMWARE's #7f1d1d
  TERROR_FINANCING: "#450a0a", // near-black red — the most severe kind on the canvas
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
  SANCTIONED: "OFAC sanctioned",
  TERROR_FINANCING: "Terror financing",
};

// Contract-call edges: deliberately the dimmest thing on the canvas. They
// are real observations but not value flow, so they must not compete with
// the money path for attention (ROADMAP.md item 0).
const CONTRACT_CALL_COLOR = "#a78bfa"; // muted violet

// Cross-case link ring (lib/linking.ts) — cyan, outside every node-kind and
// flag hue, drawn dashed so it reads as "also elsewhere", not as a kind.
const LINK_RING_COLOR = "#06b6d4";

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

// react-force-graph-2d's node/link callback types don't survive next/dynamic's
// generic erasure, so callbacks below are typed loosely and cast at use sites.
type GraphNode = TraceNode & { id: string; x: number; y: number };
type GraphLink = { source: string; target: string; label: string; flags: TypologyFlag[]; isCall: boolean; curvature: number };

// Radial layout (rings by hop depth) as the starting position for each
// node — depth is instantly readable, and it gives d3-force a sane starting
// point instead of random placement. Positions aren't pinned (no fx/fy), so
// the physics simulation still settles them and drag/zoom keep working.
const RING_SPACING = 130;

export function GraphView({ graph, linked = {} }: { graph: TraceGraph; linked?: LinkedCases }) {
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

    // Edges are per destination *per asset*, so ETH and USDT to one address
    // are two links between the same pair. At one shared curvature they draw
    // exactly on top of each other and only one hover label is reachable —
    // bow each extra parallel link out further.
    const parallelCount = new Map<string, number>();
    // Cases stored before the 2026-09-14 bfs.ts fix can hold an edge into a
    // node the node budget never created; react-force-graph throws "node not
    // found" on it. Drop those here so old truncated cases still render.
    const nodeIds = new Set(graph.nodes.map((n) => n.address));
    const links = graph.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to)).map((e) => {
      const pair = `${e.from}|${e.to}`;
      const i = parallelCount.get(pair) ?? 0;
      parallelCount.set(pair, i + 1);
      return {
        source: e.from,
        target: e.to,
        label: [
          `${edgeAmountLabel(e, graph.chain)} · ${new Date(e.latestTimestamp * 1000).toLocaleDateString()}`,
          ...e.typologyFlags.map((f) => TYPOLOGY_LABEL[f]),
        ].join(" — "),
        flags: e.typologyFlags,
        isCall: isContractCall(e),
        curvature: 0.2 + i * 0.35,
      };
    });

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
      "TERROR_FINANCING",
      "SANCTIONED",
      "DARKNET",
      "RANSOMWARE",
      "UNKNOWN",
    ];
    const seen = new Set(graph.nodes.map((n) => n.kind));
    return order.filter((k) => seen.has(k));
  }, [graph.nodes]);

  const hasContractCall = useMemo(() => graph.edges.some(isContractCall), [graph.edges]);

  // Pixel radius for a node — shared between the paint callback and the
  // pointer hit-area so clicks land exactly where the circle is drawn.
  function nodeRadius(node: GraphNode) {
    if (node.kind === "SUSPECT") return 9;
    if (node.typologyFlags.length > 0) return 7;
    return 5.5;
  }

  // Click target, not paint radius. It has to cover everything drawn around
  // the node — the cyan link ring sits at r+5 and the flag ring at r+2.5, and
  // both used to fall outside a hit area of r+2, so clicking the ring on a
  // linked node did nothing. Floor of 8 screen px so a zoomed-out node is
  // still hittable with a mouse.
  function hitRadius(node: GraphNode, globalScale: number) {
    const r = nodeRadius(node);
    const outer = linked[node.address] ? r + 6 : node.typologyFlags.length > 0 ? r + 4 : r + 2;
    return Math.max(outer, 8 / globalScale);
  }

  // The on-canvas name chip, or null when it isn't drawn. Shared by the paint
  // and the hit area so a click on the name lands on the node it names.
  // Sets ctx.font as a side effect — measureText needs it.
  function labelBox(node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) {
    // Only for nodes that carry meaning: the suspect root and anything with a
    // real entity name. Labelling every anonymous intermediary was a real bug
    // on ETH traces (40+ overlapping chips); their address is one hover or
    // click away. Skipped while zoomed far out.
    if (globalScale <= 1.1 || (node.kind !== "SUSPECT" && !node.entityName)) return null;
    const r = nodeRadius(node);
    const label = node.entityName ?? short(node.address);
    const fontSize = Math.max(10 / globalScale, 3.4);
    ctx.font = `${node.kind === "SUSPECT" ? "600" : "400"} ${fontSize}px system-ui, sans-serif`;
    // The radial layout puts depth-1 nodes level with the suspect, so the
    // suspect's label goes above to avoid colliding with its neighbours' —
    // a placement heuristic, not full collision avoidance.
    const above = node.kind === "SUSPECT";
    const y = above ? node.y - r - 2 : node.y + r + 2;
    const padX = fontSize * 0.4;
    const padY = fontSize * 0.25;
    const boxW = ctx.measureText(label).width + padX * 2;
    const boxH = fontSize + padY * 2;
    return { label, fontSize, boxX: node.x - boxW / 2, boxY: above ? y - boxH : y, boxW, boxH };
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

          // Dashed cyan outer ring: this address also appears in another of
          // the viewer's cases.
          if (linked[node.address]) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 5, 0, 2 * Math.PI);
            ctx.setLineDash([2, 1.5]);
            ctx.strokeStyle = LINK_RING_COLOR;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.setLineDash([]);
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

          // Solid rounded chip behind the text, not ctx.strokeText — a glyph
          // outline halo spikes at sharp corners and blobs around the "…".
          const box = labelBox(node, ctx, globalScale);
          if (box) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
            ctx.beginPath();
            if (typeof ctx.roundRect === "function") {
              ctx.roundRect(box.boxX, box.boxY, box.boxW, box.boxH, Math.min(3, box.fontSize * 0.35));
            } else {
              ctx.rect(box.boxX, box.boxY, box.boxW, box.boxH);
            }
            ctx.fill();
            ctx.fillStyle = "#1e293b";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(box.label, node.x, box.boxY + box.boxH / 2);
          }
        }}
        nodePointerAreaPaint={(n, color, ctx, globalScale) => {
          const node = n as GraphNode;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, hitRadius(node, globalScale), 0, 2 * Math.PI);
          ctx.fill();
          const box = labelBox(node, ctx, globalScale);
          if (box) ctx.fillRect(box.boxX, box.boxY, box.boxW, box.boxH);
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
        linkWidth={(l) => {
          const link = l as unknown as GraphLink;
          if (link.isCall) return 1;
          return link.flags.length > 0 ? 3 : 1.5;
        }}
        // Dashed + dimmer + no flow particles: the particles read as value
        // in motion, which is the exact wrong story for a zero-value call.
        linkLineDash={(l) => ((l as unknown as GraphLink).isCall ? [4, 4] : null)}
        linkColor={(l) => {
          const link = l as unknown as GraphLink;
          if (link.flags.length > 0) return FLAG_COLOR[link.flags[0]];
          return link.isCall ? CONTRACT_CALL_COLOR : "#9ca3af";
        }}
        linkCurvature="curvature"
        linkDirectionalArrowLength={5}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={(l) => {
          const link = l as unknown as GraphLink;
          if (link.isCall) return 0;
          return link.flags.length > 0 ? 3 : 2;
        }}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleSpeed={0.004}
        onNodeClick={(n) => setSelected(n as GraphNode)}
        onEngineStop={() => fgRef.current?.zoomToFit(400, 60)}
        // force-graph resolves clicks from a hidden hit-map canvas it only
        // repaints every 800ms. With the default 15s cooldown, nodes kept
        // drifting long after load, so the hit map lagged where they were
        // drawn and clicks on moving nodes missed (or hit a neighbour) —
        // "some nodes are clickable, some aren't". Settle most of the layout
        // before the first paint, and stop the engine quickly after.
        warmupTicks={80}
        cooldownTime={2000}
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
        {/* Only when this trace actually has one — a dashed-line key on a
            graph with no contract-call edges is noise, same rule as the
            node kinds above. */}
        {Object.keys(linked).length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 shrink-0 rounded-full border border-dashed" style={{ borderColor: LINK_RING_COLOR }} />
            Also in your other cases
          </span>
        )}
        {hasContractCall && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-0 w-4 shrink-0 border-t-2 border-dashed"
              style={{ borderColor: CONTRACT_CALL_COLOR }}
            />
            Contract call (no value)
          </span>
        )}
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
                {/* wrap-anywhere: co-spend reasons carry a 64-char txid,
                    which overflowed the 383px sheet (measured 408px). */}
                <div className="text-xs text-muted-foreground wrap-anywhere">
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
            {selected && (selected.receivedInTrace?.length ?? 0) > 0 && (
              <div>
                <div className="text-xs text-muted-foreground">Received in this trace</div>
                {/* Only what this trace's BFS actually followed into this
                    node — not the wallet's real total, see TraceNode's own
                    comment on receivedInTrace. */}
                <div className="text-sm">{assetTotalsLabel(selected.receivedInTrace!, graph.chain)}</div>
              </div>
            )}
            {selected?.balanceBaseUnits && (
              <div>
                <div className="text-xs text-muted-foreground">
                  Current balance (live) — {NODE_KIND_LABEL[selected.kind]}
                </div>
                <div className="text-sm">{formatAssetValue(selected.balanceBaseUnits, undefined, graph.chain)}</div>
              </div>
            )}
            {selected?.totalReceivedBaseUnits && (
              <div>
                <div className="text-xs text-muted-foreground">Total received (all-time, live)</div>
                <div className="text-sm">{formatAssetValue(selected.totalReceivedBaseUnits, undefined, graph.chain)}</div>
              </div>
            )}
            {selected && linked[selected.address] && (
              <div>
                <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Link2 className="size-3.5" />
                  Also appears in {linked[selected.address].length} other case{linked[selected.address].length === 1 ? "" : "s"}
                </div>
                <ul className="mt-1 flex flex-col gap-0.5 text-xs">
                  {linked[selected.address].map((l) => (
                    <li key={l.caseId}>
                      <a href={`/cases/${l.caseId}`} className="font-mono underline underline-offset-2 wrap-anywhere">
                        {l.rootAddress}
                      </a>{" "}
                      <span className="text-muted-foreground">· {new Date(l.createdAt).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
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

// One-line summary above the graph: how many of this trace's addresses tie it
// to the viewer's other cases, and how many distinct cases that is.
export function LinkedCasesSummary({ linked }: { linked: LinkedCases }) {
  const addresses = Object.keys(linked).length;
  if (addresses === 0) return null;
  const cases = new Set(Object.values(linked).flatMap((ls) => ls.map((l) => l.caseId))).size;
  return (
    <div className="mb-3 flex items-start gap-2 rounded-xl border border-cyan-600/30 bg-cyan-500/10 p-3 text-xs text-cyan-800 dark:text-cyan-300">
      <Link2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>
        {addresses} address{addresses === 1 ? "" : "es"} in this trace also appear{addresses === 1 ? "s" : ""} in {cases} of your
        other case{cases === 1 ? "" : "s"} — possibly the same operator. Ringed in cyan on the graph; click one for the cases.
      </span>
    </div>
  );
}
