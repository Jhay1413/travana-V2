import { barTone, niceMax } from "../../lib/chart";
import { gbp, shortGbp } from "../../lib/money";
import { MONTH_LABELS } from "../../lib/months";

interface ProfitChartProps {
  target: readonly number[];
  actual: readonly number[];
  /** 1 to 12: months before it are complete, it is "to date", later months have no bar. */
  currentMonth: number;
  /** The month that is "to date" (1 to 12), or 0 when none is (year over or not started). */
  toDate: number;
  width?: number;
  height?: number;
}

const PAD_LEFT = 52;
const PAD_RIGHT = 12;
const PAD_TOP = 10;
const PAD_BOTTOM = 28;
const GRID_LINES = 3;

export function ChartLegend({ currentMonthLabel }: { currentMonthLabel: string | null }) {
  const item = (swatch: string, text: string) => (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-social-muted">
      <span className={`h-2.5 w-2.5 ${swatch}`} />
      {text}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {item("rounded-sm bg-emerald-500", "Met target")}
      {item("rounded-sm bg-red-500", "Missed target")}
      {item("rounded-full bg-indigo-500", "Target")}
      {currentMonthLabel && <span className="text-[12px] text-social-muted">{currentMonthLabel} is month to date</span>}
    </div>
  );
}

/** Monthly profit bars against a dashed monthly target line. */
export function ProfitChart({ target, actual, currentMonth, toDate, width = 760, height = 360 }: ProfitChartProps) {
  const ymax = niceMax(target, actual.slice(0, currentMonth));
  const innerW = width - PAD_LEFT - PAD_RIGHT;
  const innerH = height - PAD_BOTTOM - PAD_TOP;
  const slot = innerW / 12;
  const barW = slot * 0.5;
  const y = (v: number) => PAD_TOP + innerH - (v / ymax) * innerH;
  const cx = (i: number) => PAD_LEFT + (i + 0.5) * slot;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label="Monthly profit against monthly target. Green bars met the target, red bars missed it, and the current month is month to date."
      className="text-social-muted"
    >
      {Array.from({ length: GRID_LINES + 1 }, (_, g) => {
        const v = (ymax * g) / GRID_LINES;
        return (
          <g key={g}>
            <line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={y(v)} y2={y(v)} className="stroke-social-border" />
            <text x={PAD_LEFT - 8} y={y(v) + 4} textAnchor="end" fontSize={11} className="fill-current">
              {shortGbp(Math.round(v))}
            </text>
          </g>
        );
      })}
      {MONTH_LABELS.map((m, i) => {
        const has = i < currentMonth;
        const v = actual[i] ?? 0;
        const t = target[i] ?? 0;
        return (
          <g key={m}>
            <text x={cx(i)} y={height - 8} textAnchor="middle" fontSize={12} className="fill-current">
              {m}
            </text>
            {has && (
              <rect
                x={cx(i) - barW / 2}
                y={y(v)}
                width={barW}
                height={(v / ymax) * innerH}
                rx={4}
                className={barTone(v, t) === "met" ? "fill-emerald-500" : "fill-red-500"}
                opacity={i === toDate - 1 ? 0.55 : 1}
              >
                <title>{`${m}: ${gbp(v)} against a target of ${gbp(t)}`}</title>
              </rect>
            )}
          </g>
        );
      })}
      <polyline
        points={target.map((v, i) => `${cx(i)},${y(v)}`).join(" ")}
        fill="none"
        className="stroke-indigo-500"
        strokeWidth={2}
        strokeDasharray="5 4"
      />
      {target.map((v, i) => (
        <circle key={i} cx={cx(i)} cy={y(v)} r={3.5} className="fill-card stroke-indigo-500" strokeWidth={2} />
      ))}
    </svg>
  );
}
