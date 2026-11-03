import { useId } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { niceAxis, type ChartMonth, type MonthKind } from "../lib/chart-model";
import { gbp } from "../lib/money";

const NAVY = "hsl(var(--social-navy))";
const GREY = "hsl(var(--stage-future-dot))";
const ORANGE = "hsl(var(--social-orange))";
const ORANGE_DARK = "hsl(var(--social-orange-text))";
const TICK_COLOR = "hsl(var(--foreground))";

function compact(v: number): string {
  return Math.abs(v) >= 1000 ? `£${Number((v / 1000).toFixed(1))}k` : gbp(v);
}

interface TickShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/** The dark 3px target tick spanning the month's bar width. Nothing is drawn when there is no target. */
function TargetTick({ x = 0, y = 0, width = 0, height = 0 }: TickShapeProps) {
  if (!(height > 0) || !(width > 0)) return null;
  return <rect x={x} y={y - 1.5} width={width} height={3} fill={TICK_COLOR} />;
}

interface TipProps {
  active?: boolean;
  payload?: Array<{ payload?: { tooltip?: string } }>;
}

function ChartTip({ active, payload }: TipProps) {
  const text = payload?.[0]?.payload?.tooltip;
  if (!active || !text) return null;
  return (
    <div className="max-w-[240px] rounded-[10px] bg-social-navy-ink px-3 py-2 text-[12px] font-medium leading-snug text-white shadow-lg">{text}</div>
  );
}

/** `shadedMonths` (YYYY-MM keys) get a soft band behind their bars, e.g. the period picked on a profile. */
export function CommissionChart({ months, shadedMonths = [] }: { months: ChartMonth[]; shadedMonths?: readonly string[] }) {
  const patternId = useId().replace(/:/g, "");
  const fills: Record<MonthKind, string> = { on: NAVY, under: `url(#${patternId})`, none: GREY };
  const data = months.map((m) => ({
    name: m.name,
    commission: m.hasBar || m.commission < 0 ? m.commission : 0,
    target: m.hasTarget ? m.target : 0,
    kind: m.kind,
    tooltip: m.tooltip,
  }));
  const axis = niceAxis(Math.max(0, ...data.map((d) => Math.max(d.commission, d.target))));
  const step = axis.ticks[1] ?? 1;
  const low = Math.min(0, ...data.map((d) => d.commission));
  const floor = low < 0 ? Math.floor(low / step) * step : 0;
  const ticks = Array.from({ length: Math.round((axis.max - floor) / step) + 1 }, (_, i) => floor + step * i);

  return (
    <div className="h-[260px]" data-testid="commission-chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
          <defs>
            <pattern id={patternId} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="10" height="10" fill={ORANGE} />
              <rect width="5" height="10" fill={ORANGE_DARK} />
            </pattern>
          </defs>
          {months
            .filter((m) => shadedMonths.includes(m.month))
            .map((m) => (
              <ReferenceArea key={`shade-${m.month}`} yAxisId="commission" x1={m.name} x2={m.name} fill="hsl(var(--social-navy))" fillOpacity={0.09} />
            ))}
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} tick={{ fontSize: 12 }} interval={0} />
          {/* Separate X axis so the target tick overlays the commission bar instead of sitting beside it. */}
          <XAxis xAxisId="tick" dataKey="name" hide />
          <YAxis
            yAxisId="commission"
            domain={[floor, axis.max]}
            ticks={ticks}
            tickFormatter={compact}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
            width={52}
          />
          <Tooltip content={<ChartTip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
          <Bar yAxisId="commission" dataKey="commission" radius={[6, 6, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={months[i].month} fill={fills[d.kind]} />
            ))}
          </Bar>
          <Bar
            xAxisId="tick"
            yAxisId="commission"
            dataKey="target"
            shape={<TargetTick />}
            isAnimationActive={false}
            legendType="none"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
