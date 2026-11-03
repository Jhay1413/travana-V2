import type { ReactNode } from "react";
import { CalendarCheck, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export type TileGlyph = "pound" | "calendar" | "target";
export type TileTone = "green" | "blue" | "orange" | "red";

const TONE: Record<TileTone, { ring: string; bar: string }> = {
  green: { ring: "border-emerald-500 text-emerald-500", bar: "bg-emerald-500" },
  blue: { ring: "border-blue-500 text-blue-500", bar: "bg-blue-500" },
  orange: { ring: "border-amber-500 text-amber-500", bar: "bg-amber-500" },
  red: { ring: "border-red-600 text-red-600", bar: "bg-red-600" },
};

function GlyphDot({ glyph, tone }: { glyph: TileGlyph; tone: TileTone }) {
  return (
    <span
      className={cn(
        "grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-[1.5px] text-[11px] font-semibold",
        TONE[tone].ring,
      )}
      aria-hidden
    >
      {glyph === "pound" && "£"}
      {glyph === "calendar" && <CalendarCheck className="h-3.5 w-3.5" strokeWidth={2.2} />}
      {glyph === "target" && <Target className="h-3.5 w-3.5" strokeWidth={2.2} />}
    </span>
  );
}

/** One profit tile: muted title with a ringed glyph, big value, optional bar, and a subline. */
export function StatTile({
  label,
  glyph,
  tone,
  value,
  valueTestId,
  suffix,
  barPct,
  barTestId,
  barTone,
  testId,
  children,
}: {
  label: string;
  glyph: TileGlyph;
  tone: TileTone;
  value: string;
  valueTestId: string;
  /** Muted "/ £10,000" shown after the value. */
  suffix?: string;
  /** Percent of the bar to fill; omit for no bar. */
  barPct?: number;
  barTestId?: string;
  barTone?: TileTone;
  testId: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-[14px] border border-social-border bg-card p-3.5" data-testid={testId}>
      <div className="flex items-center justify-between gap-1.5">
        <span className="whitespace-nowrap text-[11px] font-medium text-social-muted xl:text-[12px]">{label}</span>
        <GlyphDot glyph={glyph} tone={tone} />
      </div>
      <p
        className="mb-1 mt-2 whitespace-nowrap text-[20px] font-semibold tracking-tight xl:text-[24px]"
        data-testid={valueTestId}
      >
        {value}
        {suffix && <span className="ml-1 text-[11px] font-medium text-social-muted">{suffix}</span>}
      </p>
      {barPct !== undefined && (
        <div className="mb-1.5 h-[5px] overflow-hidden rounded-[3px] bg-social-border" data-testid={barTestId}>
          <div
            className={cn("h-full rounded-[3px] transition-all duration-700 ease-out", TONE[barTone ?? tone].bar)}
            style={{ width: `${barPct}%` }}
          />
        </div>
      )}
      <div className="text-[11px] text-social-muted">{children}</div>
    </div>
  );
}
