"use client";

import { Cell, Label, Pie, PieChart } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type { VaspRecommendation } from "@/lib/tracers/types";

// Score ceiling before the hop penalty — see lib/scoring.ts:
// FIU-IND (3) + India nodal officer (2) + max reliability (5) = 10.
// Only used to normalize this gauge's fill; the raw auditable score and its
// breakdown are still shown as text next to it (lib/format.ts's vaspLine),
// never replaced by the gauge — "explainable, not a black box" per
// PLAN.md's differentiation note applies here too.
const SCORE_CEILING = 10;

const config = { score: { label: "Actionability score" } } satisfies ChartConfig;

export function VaspScoreGauge({ rec }: { rec: VaspRecommendation }) {
  const score = rec.breakdown.score;
  // A donut Pie's two slices are always proportional to each other by
  // construction — reliable across a wide score range, unlike
  // RadialBarChart's single-bar domain scaling (which turned out to need
  // real fighting to get an accurate percentage arc out of, not just a
  // decorative full ring). Clamped: the formula can't exceed the ceiling,
  // but a large hop distance can drive it negative.
  const plotted = Math.max(0, Math.min(SCORE_CEILING, score));
  const data = [
    { name: "filled", value: plotted },
    { name: "remainder", value: SCORE_CEILING - plotted },
  ];

  return (
    <ChartContainer config={config} className="mx-auto aspect-square w-full max-w-[130px] shrink-0">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          startAngle={90}
          endAngle={-270}
          innerRadius={46}
          outerRadius={64}
          strokeWidth={0}
          cornerRadius={4}
        >
          <Cell fill="var(--primary)" />
          <Cell fill="var(--muted)" />
          <Label
            content={({ viewBox }) => {
              if (!viewBox || !("cx" in viewBox) || viewBox.cx == null || viewBox.cy == null) return null;
              return (
                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                  <tspan x={viewBox.cx} y={viewBox.cy - 4} className="fill-foreground text-2xl font-bold">
                    {score}
                  </tspan>
                  <tspan x={viewBox.cx} y={viewBox.cy + 15} className="fill-muted-foreground text-[10px]">
                    / {SCORE_CEILING} score
                  </tspan>
                </text>
              );
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
