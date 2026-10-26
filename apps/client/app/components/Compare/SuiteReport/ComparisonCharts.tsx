import { Bar, BarChart, LabelList, XAxis, YAxis } from 'recharts';

import { formatCost, formatSpeed } from '@/utils/compare-metrics';
import type { SuiteModelStats, SuiteReport } from '@/utils/compare-suite-report';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';

const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 });
const BAR_HEIGHT = 32;
const MAX_TICK_LENGTH = 16;

interface ChartSpec {
  id: string;
  title: string;
  description: string;
  color: string;
  value: (model: SuiteModelStats) => number | undefined;
  format: (model: SuiteModelStats) => string;
}

const charts: ChartSpec[] = [
  {
    id: 'wins',
    title: 'Win rate',
    description: 'Share of voted prompts each model won',
    color: 'hsl(var(--chart-1))',
    value: ({ winRate }) => winRate,
    format: ({ winRate }) => (winRate === undefined ? '-' : percent.format(winRate)),
  },
  {
    id: 'cost',
    title: 'Total cost',
    description: 'Lower is cheaper',
    color: 'hsl(var(--chart-2))',
    value: ({ totalCost }) => totalCost?.usd,
    format: ({ totalCost }) => formatCost(totalCost),
  },
  {
    id: 'speed',
    title: 'Speed',
    description: 'Median answer tokens per second',
    color: 'hsl(var(--chart-3))',
    value: ({ medianSpeed }) => medianSpeed,
    format: ({ medianSpeed }) => formatSpeed(medianSpeed),
  },
];

const truncate = (text: string) =>
  text.length > MAX_TICK_LENGTH ? `${text.slice(0, MAX_TICK_LENGTH - 3)}...` : text;

interface ComparisonChartsProps {
  report: SuiteReport;
  getModelLabel: (model: string) => string;
}

/** Horizontal bars per metric; the ranking table carries the same numbers for screen readers. */
const ComparisonCharts = ({ report, getModelLabel }: ComparisonChartsProps) => {
  return (
    <div className="grid min-w-0 gap-3 md:grid-cols-3 lg:gap-4">
      {charts.map((chart) => {
        const data = report.models.flatMap((model) => {
          const value = chart.value(model);
          if (value === undefined) return [];
          const label = getModelLabel(model.model);
          return [
            {
              label: model.variant ? `${label} ${model.variant}` : label,
              value,
              display: chart.format(model),
            },
          ];
        });
        const config = { value: { label: chart.title, color: chart.color } } satisfies ChartConfig;
        return (
          <figure
            key={chart.id}
            aria-hidden="true"
            className="flex min-w-0 flex-col gap-2 rounded-xl border border-border/70 bg-card p-3">
            <figcaption className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{chart.title}</span>
              <span className="text-xs text-muted-foreground">{chart.description}</span>
            </figcaption>
            {data.length ? (
              <ChartContainer
                config={config}
                className="aspect-auto w-full"
                style={{ height: data.length * BAR_HEIGHT + 8 }}>
                <BarChart
                  data={data}
                  layout="vertical"
                  margin={{ left: 0, right: 72, top: 4, bottom: 4 }}>
                  <XAxis type="number" dataKey="value" hide domain={[0, 'dataMax']} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={136}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={truncate}
                  />
                  <Bar
                    dataKey="value"
                    fill="var(--color-value)"
                    radius={4}
                    barSize={16}
                    // Numbers the user reads update in place; recharts' default 1.5s grow is
                    // decoration on data.
                    isAnimationActive={false}>
                    {/* A plain <text>, since recharts wraps labels to the bar's width. */}
                    <LabelList
                      dataKey="display"
                      content={({ x, y, width, height, value }) => (
                        <text
                          x={Number(x) + Number(width) + 6}
                          y={Number(y) + Number(height) / 2}
                          dominantBaseline="central"
                          fontSize={12}
                          className="fill-foreground tabular-nums">
                          {value}
                        </text>
                      )}
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="py-4 text-center text-xs text-muted-foreground">No data yet</p>
            )}
          </figure>
        );
      })}
    </div>
  );
};

export default ComparisonCharts;
