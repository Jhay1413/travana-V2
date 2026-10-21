import type { ReactNode } from "react";

export interface SocialQuoteShellProps {
  topBar: ReactNode;
  main: ReactNode;
  side: ReactNode;
}

/**
 * Page frame of the social quote: fluid centre | 320px right column, 24px gap, same look as the client quote page
 * (no "All holidays" rail, since free quotes have no client). The page scrolls with the window; the right column sticks
 * under the sticky app header on wide screens. Up to 1180px it is one column, and the right column drops below the
 * centre as a 2-up grid (one column up to 860px).
 */
export function SocialQuoteShell({ topBar, main, side }: SocialQuoteShellProps) {
  return (
    <section className="text-compact -m-4 min-h-full bg-social-page p-4 md:-m-6 md:p-6" data-testid="page-social-quote">
      <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-6 max-[1180px]:grid-cols-1">
        <div className="col-span-full">{topBar}</div>
        <div className="flex min-w-0 flex-col gap-5" data-testid="layout-social-quote-body">
          {main}
        </div>
        <div
          className="flex min-w-0 flex-col gap-5 min-[1181px]:sticky min-[1181px]:top-[4.5rem] min-[1181px]:max-h-[calc(100vh-5.5rem)] min-[1181px]:overflow-y-auto max-[1180px]:grid max-[1180px]:grid-cols-2 max-[1180px]:items-start max-[860px]:grid-cols-1"
          data-testid="social-quote-side-column"
        >
          {side}
        </div>
      </div>
    </section>
  );
}
