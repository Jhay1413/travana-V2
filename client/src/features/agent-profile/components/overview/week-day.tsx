import { StatusPill } from "@/features/admin-dashboard";
import { cn } from "@/lib/utils";
import type { WeekDayView } from "../../lib/week-model";

export function WeekDay({ day }: { day: WeekDayView }) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col gap-2 rounded-xl border bg-card p-2.5 min-[721px]:min-h-[190px]",
        day.isToday ? "border-2 border-social-navy p-[9px]" : "border-social-border",
      )}
      data-testid={`week-day-${day.date}`}
    >
      <h3 className="flex items-center justify-between gap-1.5 text-[12px] font-medium leading-tight text-social-muted xl:text-[13px]">
        <span>
          {day.short}
          <b className="block text-[18px] font-semibold text-social-navy xl:text-[20px]">{day.dayNumber}</b>
        </span>
        {day.isToday && <span className="rounded-full bg-social-navy px-2.5 py-0.5 text-[11px] font-semibold text-white xl:text-[12px]">Today</span>}
      </h3>
      {day.items.map((it) => (
        <div key={it.id} className="flex flex-col items-start gap-1.5 rounded-[10px] bg-status-draft-bg px-2.5 py-2 text-[12px] leading-snug xl:text-[13px]">
          <StatusPill tone={it.tone}>{it.label}</StatusPill>
          <span className="break-words">{it.text}</span>
          {it.time && <span className="tabular-nums text-social-muted">{it.time}</span>}
        </div>
      ))}
      {day.items.length === 0 && <span className="text-[12px] text-social-muted xl:text-[13px]">Nothing planned</span>}
    </div>
  );
}
