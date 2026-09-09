"use client";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

// recharts touches React context at module scope, so anything importing it
// needs a client boundary — app/cases/page.tsx stays a server component for
// the Prisma fetch and passes plain data down to these two.

export function RankedBarChart({
  data,
  emptyMessage,
}: {
  data: { label: string; count: number; fill: string }[];
  emptyMessage: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  const config = Object.fromEntries(data.map((d) => [d.label, { label: d.label }])) satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: data.length * 34 + 16 }}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }} accessibilityLayer>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" hide />
        <YAxis
          dataKey="label"
          type="category"
          tickLine={false}
          axisLine={false}
          width={110}
          tick={{ fontSize: 12 }}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="count" radius={4} barSize={16}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

const sparklineConfig = { count: { label: "Traces", color: "var(--chart-2)" } } satisfies ChartConfig;

export function Sparkline({ data }: { data: { day: string; count: number }[] }) {
  return (
    <ChartContainer config={sparklineConfig} className="aspect-auto h-[160px] w-full">
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tick={{ fontSize: 12 }} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
        <defs>
          <linearGradient id="fillTraces" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area dataKey="count" type="monotone" stroke="var(--color-count)" fill="url(#fillTraces)" strokeWidth={2} />
      </AreaChart>
    </ChartContainer>
  );
}
