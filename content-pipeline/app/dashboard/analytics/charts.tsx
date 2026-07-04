/** Hand-rolled SVG line/bar charts (Phase 7, section 5's own constraint:
 * "don't add a generic charting library dependency for one or two simple
 * line/bar charts"). Deliberately minimal -- no axes library, no
 * animation, no tooltips beyond native `<title>` -- just enough to show
 * the trend/comparison the brief asks for. */

const CHART_WIDTH = 600;
const CHART_HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 28, left: 36 };

export interface LineSeries {
  label: string;
  color: string;
  points: Array<{ x: string; y: number | null }>;
}

/** Renders one or more series sharing a 0-100 y-axis (this codebase's two
 * line-chart use cases -- qa_pass_rate and human_approval_rate -- are
 * both percentages). `null` values (e.g. prior_week_qa_pass_rate on the
 * very first ever week) are skipped rather than plotted as zero. */
export function LineChart({ series, xLabels }: { series: LineSeries[]; xLabels: string[] }) {
  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const stepX = xLabels.length > 1 ? innerWidth / (xLabels.length - 1) : 0;
  const xForIndex = (i: number) => PADDING.left + i * stepX;
  const yForValue = (v: number) => PADDING.top + innerHeight - (v / 100) * innerHeight;

  return (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full" role="img" aria-label="Line chart">
      {[0, 25, 50, 75, 100].map((tick) => (
        <g key={tick}>
          <line
            x1={PADDING.left}
            x2={CHART_WIDTH - PADDING.right}
            y1={yForValue(tick)}
            y2={yForValue(tick)}
            className="stroke-zinc-200 dark:stroke-zinc-800"
            strokeWidth={1}
          />
          <text x={4} y={yForValue(tick) + 4} className="fill-zinc-400 text-[9px] dark:fill-zinc-500">
            {tick}%
          </text>
        </g>
      ))}

      {series.map((s) => {
        const pathPoints = s.points
          .map((p, i) => (p.y === null ? null : `${xForIndex(i)},${yForValue(p.y)}`))
          .filter((p): p is string => p !== null);

        return (
          <g key={s.label}>
            <polyline points={pathPoints.join(" ")} fill="none" stroke={s.color} strokeWidth={2} />
            {s.points.map((p, i) =>
              p.y === null ? null : (
                <circle key={i} cx={xForIndex(i)} cy={yForValue(p.y)} r={3} fill={s.color}>
                  <title>{`${s.label}: ${xLabels[i]} \u2014 ${p.y}%`}</title>
                </circle>
              )
            )}
          </g>
        );
      })}

      {xLabels.map((label, i) => (
        <text
          key={label + i}
          x={xForIndex(i)}
          y={CHART_HEIGHT - 8}
          textAnchor="middle"
          className="fill-zinc-400 text-[9px] dark:fill-zinc-500"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  color: string;
}

export function BarChart({ data }: { data: BarDatum[] }) {
  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const maxValue = Math.max(1, ...data.map((d) => d.value));
  const barWidth = data.length > 0 ? Math.min(80, innerWidth / data.length - 16) : 0;
  const slot = data.length > 0 ? innerWidth / data.length : 0;

  return (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full" role="img" aria-label="Bar chart">
      <line
        x1={PADDING.left}
        x2={CHART_WIDTH - PADDING.right}
        y1={PADDING.top + innerHeight}
        y2={PADDING.top + innerHeight}
        className="stroke-zinc-300 dark:stroke-zinc-700"
        strokeWidth={1}
      />
      {data.map((d, i) => {
        const barHeight = (d.value / maxValue) * innerHeight;
        const x = PADDING.left + i * slot + (slot - barWidth) / 2;
        const y = PADDING.top + innerHeight - barHeight;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barWidth} height={barHeight} fill={d.color} rx={3}>
              <title>{`${d.label}: ${d.value}`}</title>
            </rect>
            <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" className="fill-zinc-600 text-[10px] font-medium dark:fill-zinc-300">
              {d.value}
            </text>
            <text
              x={x + barWidth / 2}
              y={CHART_HEIGHT - 8}
              textAnchor="middle"
              className="fill-zinc-500 text-[10px] dark:fill-zinc-400"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
