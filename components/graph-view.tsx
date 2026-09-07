"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { TraceGraph, TraceNode } from "@/lib/tracers/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

// react-force-graph-2d touches window/canvas at import time — must load client-only.
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

const NODE_COLOR: Record<TraceNode["kind"], string> = {
  SUSPECT: "#dc2626", // red
  INTERMEDIARY: "#6b7280", // muted gray
  EXCHANGE: "#16a34a", // green
  MIXER: "#ea580c", // orange
  DARKNET: "#7f1d1d", // dark red
  RANSOMWARE: "#7f1d1d", // dark red
  BRIDGE: "#2563eb", // blue
  UNKNOWN: "#6b7280",
};

function short(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatEth(wei: string) {
  return `${(Number(BigInt(wei)) / 1e18).toFixed(4)} ETH`;
}

// react-force-graph-2d's node/link callback types don't survive next/dynamic's
// generic erasure, so callbacks below are typed loosely and cast at use sites.
type GraphNode = TraceNode & { id: string; x: number; y: number };
type GraphLink = { source: string; target: string; label: string };

// Radial layout (rings by hop depth) as the starting position for each
// node — depth is instantly readable, and it gives d3-force a sane starting
// point instead of random placement. Positions aren't pinned (no fx/fy), so
// the physics simulation still settles them and drag/zoom keep working.
const RING_SPACING = 130;

export function GraphView({ graph }: { graph: TraceGraph }) {
  const [selected, setSelected] = useState<TraceNode | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ForceGraphMethods generic doesn't survive next/dynamic
  const fgRef = useRef<any>(null);

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
      label: `${formatEth(e.valueWei)} · ${e.txCount} tx · ${new Date(e.latestTimestamp * 1000).toLocaleDateString()}`,
    }));

    return { nodes, links };
  }, [graph]);

  return (
    <div className="relative h-[500px] w-full overflow-hidden rounded-md border bg-card">
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        nodeId="id"
        nodeLabel={(n) => `${(n as GraphNode).entityName ?? short((n as GraphNode).address)} (${(n as GraphNode).kind})`}
        nodeColor={(n) => NODE_COLOR[(n as GraphNode).kind]}
        nodeRelSize={7}
        nodeVal={(n) => ((n as GraphNode).kind === "SUSPECT" ? 3 : 1.5)}
        linkLabel={(l) => (l as unknown as GraphLink).label}
        linkWidth={1.5}
        linkColor={() => "#9ca3af"}
        linkDirectionalArrowLength={5}
        linkDirectionalArrowRelPos={1}
        onNodeClick={(n) => setSelected(n as GraphNode)}
        onEngineStop={() => fgRef.current?.zoomToFit(400, 60)}
        height={500}
      />

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
                <div className="text-sm">{selected.confidence} (exact address match)</div>
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
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
