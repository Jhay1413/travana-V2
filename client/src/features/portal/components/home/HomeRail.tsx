import { Children, useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Eyebrow, SplitHeading } from "../brand";

/** How far one arrow press or arrow key moves the rail: about one card and its gap. */
const STEP = 274;

const ARROW =
  "inline-flex size-11 items-center justify-center border border-border text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:pointer-events-none disabled:opacity-30";

/**
 * A heading row and a horizontally scrolling rail of cards. Works with a mouse (previous / next buttons, shown
 * whenever the cards overflow), by touch (swipe, snapping) and by keyboard (the rail takes focus and the left and
 * right arrow keys scroll it; every card inside is also a focusable link or button).
 */
export function HomeRail({
  id,
  eyebrow,
  lead,
  italic,
  label,
  action,
  hint,
  testId,
  children,
}: {
  id: string;
  eyebrow?: string;
  lead: string;
  italic: string;
  /** Accessible name of the scrolling region. */
  label: string;
  /** A "See all" style button, placed beside the arrows. */
  action?: ReactNode;
  /** The design's "Swipe" hint, shown on phones (where there are no arrow buttons). */
  hint?: string;
  testId: string;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ canPrev: false, canNext: false });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const canPrev = el.scrollLeft > 4;
    const canNext = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((old) => (old.canPrev === canPrev && old.canNext === canNext ? old : { canPrev, canNext }));
  }, []);

  // Measure again whenever the number of cards changes, and on every resize (one listener, added once).
  const cardCount = Children.count(children);
  useEffect(() => {
    measure();
  }, [measure, cardCount]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const scrollBy = (dir: -1 | 1) => track.current?.scrollBy({ left: dir * STEP, behavior: reduceMotion ? "auto" : "smooth" });

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollBy(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollBy(-1);
    }
  };

  const overflowing = edges.canPrev || edges.canNext;

  return (
    <section aria-labelledby={id} className="mx-auto flex w-full max-w-5xl flex-col gap-[26px] pb-6 pt-[72px]" data-testid={testId}>
      <div className="flex flex-col gap-3 px-7">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <div className="flex items-end justify-between gap-3">
          <SplitHeading id={id} lead={lead} italic={italic} className="text-[34px] leading-[1.08]" />
          <div className="flex flex-none items-center gap-2 pb-1">
            {action}
            {hint && <span className="pb-[2px] text-[11px] uppercase tracking-[0.24em] text-muted-foreground md:hidden">{hint}</span>}
            {overflowing && (
              <div className="hidden items-center gap-2 md:flex">
                <button type="button" className={ARROW} onClick={() => scrollBy(-1)} disabled={!edges.canPrev} aria-label={`Previous in ${label}`} data-testid={`${testId}-prev`}>
                  <ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden />
                </button>
                <button type="button" className={ARROW} onClick={() => scrollBy(1)} disabled={!edges.canNext} aria-label={`Next in ${label}`} data-testid={`${testId}-next`}>
                  <ChevronRight className="size-5" strokeWidth={1.5} aria-hidden />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div
        ref={track}
        role="region"
        aria-label={label}
        tabIndex={0}
        onScroll={measure}
        onKeyDown={onKeyDown}
        data-scroll-rail className={cn("no-scrollbar flex snap-x snap-mandatory scroll-px-7 gap-3.5 overflow-x-auto px-7 focus-visible:outline-offset-[-2px]")}
        data-testid={`${testId}-track`}
      >
        {children}
      </div>
    </section>
  );
}
