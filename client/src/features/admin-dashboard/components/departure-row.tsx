import { CARD_BUTTON } from "./shared/bits";
import { StatusPill, type PillTone } from "./shared/pills";
import type { DepartureRow as Row, DepartureTone } from "../lib/sample-departures";

const TONE: Record<DepartureTone, PillTone> = { ok: "good", done: "info", warn: "warn", error: "bad" };

export function DepartureRow({ row, onToggle }: { row: Row; onToggle: (id: string) => void }) {
  const { dep, isDone, hasAction, status, tone, actionLabel } = row;
  return (
    <div
      className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-social-border py-3 first:border-t-0 first:pt-0.5 max-[720px]:grid-cols-[56px_minmax(0,1fr)]"
      data-testid={`row-departure-${dep.id}`}
    >
      <span className="w-14 rounded-[10px] bg-status-draft-bg py-1 text-center text-[12px] leading-tight text-social-muted" aria-hidden>
        {dep.day}
        <b className="block text-[17px] font-semibold text-social-navy">{dep.num}</b>
      </span>
      <div className="min-w-0">
        <h3 className="text-[13px] font-semibold leading-snug xl:text-[14px]">
          {dep.who}, {dep.dest}
        </h3>
        <div className="text-[12px] text-social-muted xl:text-[13px]">
          Departs {dep.dayFull} · {dep.meta}
        </div>
        <div className="mt-1.5">
          <StatusPill tone={TONE[tone]}>{status}</StatusPill>
        </div>
      </div>
      {hasAction && (
        <button
          type="button"
          aria-pressed={isDone}
          onClick={() => onToggle(dep.id)}
          data-testid={`button-departure-action-${dep.id}`}
          className={
            isDone
              ? "inline-flex h-9 items-center rounded-[10px] px-3 text-[12px] font-semibold text-status-posted-fg hover:bg-status-posted-bg max-[720px]:col-start-2 max-[720px]:justify-self-start xl:text-[13px]"
              : `${CARD_BUTTON} max-[720px]:col-start-2 max-[720px]:justify-self-start`
          }
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
