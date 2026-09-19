// Decorative "trace" motif — a faint network graph, echoing what the app
// actually does (nodes + edges), for the two screens with the least real
// content to fill the viewport: /login and the home page's pre-trace hero.
// Pure SVG, no new dependency. Fixed node layout (not randomized) so server
// and client render identically — no hydration mismatch risk. Purely
// decorative: aria-hidden, pointer-events-none, and the pulse only runs
// under `motion-safe` so prefers-reduced-motion gets a static graph.
const NODES = [
  { x: 8, y: 20 }, { x: 22, y: 55 }, { x: 15, y: 85 }, { x: 40, y: 12 },
  { x: 48, y: 45 }, { x: 62, y: 22 }, { x: 78, y: 8 }, { x: 88, y: 35 },
  { x: 70, y: 60 }, { x: 92, y: 78 }, { x: 55, y: 82 }, { x: 33, y: 70 },
];
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [4, 8],
  [8, 9], [8, 10], [10, 11], [11, 1], [4, 11], [2, 11],
];

export function NetworkBackdrop() {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 size-full text-primary/25 dark:text-primary/20"
    >
      {EDGES.map(([a, b], i) => (
        <line
          key={i}
          x1={NODES[a].x}
          y1={NODES[a].y}
          x2={NODES[b].x}
          y2={NODES[b].y}
          stroke="currentColor"
          strokeWidth="0.15"
        />
      ))}
      {NODES.map((n, i) => (
        <circle
          key={i}
          cx={n.x}
          cy={n.y}
          r={i === 4 ? 1.1 : 0.7}
          fill="currentColor"
          className="motion-safe:animate-pulse"
          style={{ animationDuration: `${3 + (i % 4)}s`, animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </svg>
  );
}
