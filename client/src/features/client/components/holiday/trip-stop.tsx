import {
  Anchor,
  ArrowLeftRight,
  Bus,
  Car,
  Coffee,
  Hotel,
  ParkingSquare,
  PawPrint,
  Plane,
  PlaneLanding,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TruncateTip } from "@/features/client/components/holiday/truncate-tip";
import type { TripIcon, TripStop as TripStopData, TripTone } from "@/features/client/lib/trip-timeline";

const ICONS: Record<TripIcon, LucideIcon> = {
  plane: Plane,
  "plane-return": PlaneLanding,
  bus: Bus,
  hotel: Hotel,
  anchor: Anchor,
  paw: PawPrint,
  transfer: ArrowLeftRight,
  car: Car,
  ticket: Ticket,
  coffee: Coffee,
  parking: ParkingSquare,
};

const TONE_CHIP: Record<TripTone, string> = {
  out: "bg-qp-trip-out-bg text-qp-trip-out-fg",
  transfer: "bg-qp-trip-transfer-bg text-qp-trip-transfer-fg",
  hotel: "bg-qp-trip-hotel-bg text-qp-trip-hotel-fg",
  return: "bg-qp-trip-return-bg text-qp-trip-return-fg",
  extra: "bg-qp-chip-bg text-qp-chip-fg",
  cruise: "bg-qp-trip-out-bg text-qp-trip-out-fg",
  lodge: "bg-qp-trip-transfer-bg text-qp-trip-transfer-fg",
};

const TONE_LABEL: Record<TripTone, string> = {
  out: "text-qp-trip-out-fg",
  transfer: "text-qp-trip-transfer-fg",
  hotel: "text-qp-trip-hotel-fg",
  return: "text-qp-trip-return-fg",
  extra: "text-qp-chip-fg",
  cruise: "text-qp-trip-out-fg",
  lodge: "text-qp-trip-transfer-fg",
};

/** One stop on the vertical trip timeline: tone-coloured icon chip, a dashed connector down to the next stop, then the details. */
export function TripStop({ stop, isLast }: { stop: TripStopData; isLast: boolean }) {
  const Icon = ICONS[stop.icon];
  return (
    <li
      className={cn(
        "relative grid grid-cols-[28px_minmax(0,1fr)] gap-2.5 pb-3",
        isLast && "pb-0",
        !isLast && "before:absolute before:bottom-0.5 before:left-[13px] before:top-[30px] before:border-l-2 before:border-dashed before:border-social-border before:content-['']",
      )}
      data-testid={`trip-stop-${stop.kind}`}
    >
      <span className={cn("grid size-7 place-items-center rounded-lg", TONE_CHIP[stop.tone])} aria-hidden>
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <span className={cn("text-[10.5px] font-semibold uppercase tracking-[.04em]", TONE_LABEL[stop.tone])}>{stop.label}</span>
        <h3 className="mt-px min-w-0">
          <TruncateTip text={stop.title} className="text-[13px] font-semibold leading-snug" />
        </h3>
        <div className="mt-0.5 flex min-w-0 flex-col gap-0.5 text-xs text-qp-muted">
          {stop.route && (
            <span className="flex items-center gap-2 tabular-nums">
              <b className="text-sm font-semibold text-foreground">{stop.route.depart || "--:--"}</b>
              <i className="relative h-0 min-w-4 flex-1 border-t-2 border-social-border" aria-hidden />
              <b className="text-sm font-semibold text-foreground">{stop.route.arrive || "--:--"}</b>
            </span>
          )}
          {stop.lines.map((line, i) => (
            <TruncateTip key={`${i}-${line}`} text={line} />
          ))}
          {stop.landsNextDay && <span className="font-medium text-qp-trip-return-fg">Lands the next morning</span>}
        </div>
        {stop.pills.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {stop.pills.map((p) => (
              <span key={p} className="max-w-full truncate rounded-full bg-muted px-2 py-px text-[11px] font-semibold text-qp-muted">
                {p}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
