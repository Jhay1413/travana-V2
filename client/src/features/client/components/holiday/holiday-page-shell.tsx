import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Slots {
  topBar: HTMLElement | null;
  main: HTMLElement | null;
  side: HTMLElement | null;
}

const SlotsContext = createContext<Slots>({ topBar: null, main: null, side: null });

/**
 * Persistent page frame: 290px rail | fluid centre | 320px right column, 24px gap.
 * The rail lives here so it survives picking another holiday; the keyed
 * quote / booking / enquiry compositions render into the three slots through
 * HolidayPageShell (portals), so only the slot content remounts.
 *
 * - up to 1480px wide: two columns (rail 270 + centre); the right column drops under the centre as a 2-up grid.
 * - up to 1180px: one column. Up to 860px: the right column stacks too.
 * The page scrolls with the window like every other redesigned page (no inner
 * fixed-height scroller, so there is never a second scroll context or dead
 * space under the content); the rail and the right column stick below the
 * 3.5rem sticky app header on wide screens.
 */
export function HolidayShellFrame({ rail, children }: { rail: ReactNode; children: ReactNode }) {
  const [topBar, setTopBar] = useState<HTMLElement | null>(null);
  const [main, setMain] = useState<HTMLElement | null>(null);
  const [side, setSide] = useState<HTMLElement | null>(null);
  const slots = useMemo(() => ({ topBar, main, side }), [topBar, main, side]);
  return (
    <section
      className="text-compact -m-4 min-h-full bg-social-page p-4 md:-m-6 md:p-6"
      data-testid="section-client-profile"
    >
      <div className="grid grid-cols-[290px_minmax(0,1fr)_320px] items-start gap-6 max-[1480px]:grid-cols-[270px_minmax(0,1fr)] max-[1180px]:grid-cols-1">
        <div className="col-span-full" ref={setTopBar} />
        <div className="min-w-0 min-[1181px]:sticky min-[1181px]:top-[4.5rem] min-[1181px]:max-h-[calc(100vh-5.5rem)] min-[1181px]:overflow-y-auto">
          {rail}
        </div>
        <div className="flex min-w-0 flex-col gap-5" data-testid="holiday-main-column" ref={setMain} />
        <div
          ref={setSide}
          className="flex min-w-0 flex-col gap-5 empty:hidden min-[1481px]:sticky min-[1481px]:top-[4.5rem] min-[1481px]:max-h-[calc(100vh-5.5rem)] min-[1481px]:overflow-y-auto max-[1480px]:col-start-2 max-[1480px]:grid max-[1480px]:grid-cols-2 max-[1480px]:items-start max-[1180px]:col-start-auto max-[860px]:grid-cols-1"
          data-testid="holiday-side-column"
        />
      </div>
      <SlotsContext.Provider value={slots}>{children}</SlotsContext.Provider>
    </section>
  );
}

export interface HolidayPageShellProps {
  topBar: ReactNode;
  main: ReactNode;
  side?: ReactNode;
}

/** Renders a composition's pieces into the persistent frame's slots. */
export function HolidayPageShell({ topBar, main, side }: HolidayPageShellProps) {
  const slots = useContext(SlotsContext);
  return (
    <>
      {slots.topBar && createPortal(topBar, slots.topBar)}
      {slots.main && createPortal(main, slots.main)}
      {slots.side && side ? createPortal(side, slots.side) : null}
    </>
  );
}

/** Two-up row used for "Holiday details | Price and profit"; stacks below 860px. */
export function HolidayTwoUp({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-5 max-[860px]:grid-cols-1">{children}</div>;
}

/** Inline loading / error body for the centre column while a holiday loads. */
export function HolidayMessage({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-social-border bg-card p-10 text-center text-sm text-qp-muted" data-testid="holiday-detail-message">
      {children}
    </div>
  );
}
