import { cn } from "@/lib/utils";
import { portalTabs, type PortalTabKey } from "../portal-nav";

/** The design's own tab icons (24 grid, 1.5 stroke, 22px). `messages` is two overlapping bubbles (the chat page); `agent` keeps the design's single bubble. */
const ICON_PATHS: Record<PortalTabKey, string[]> = {
  home: ["M3 10.5L12 3l9 7.5M5 9.5V21h14V9.5M10 21v-6h4v6"],
  quotes: ["M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6zM14 3v6h6M8 13h8M8 17h5"],
  bookings: ["M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 7h18v13H3zM3 12h18"],
  messages: ["M3 5a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8l-3 3v-3a2 2 0 01-2-2z", "M18 9h1a2 2 0 012 2v5a2 2 0 01-2 2v3l-3-3h-5a2 2 0 01-2-2v-1"],
  agent: ["M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"],
};

/**
 * Navy bottom bar, as the design: five tabs (Home, Quotes, Bookings, Message, the agent), `aria-current` on the active one.
 * The agent's tab does not navigate: it opens the Message sheet, and while the sheet is open it is the only active tab.
 */
export function PortalTabBar({
  active,
  onNavigate,
  onOpenAgent,
  agentOpen = false,
  agent = "",
  badges = {},
  inFlow = false,
}: {
  active: PortalTabKey | null;
  onNavigate: (path: string) => void;
  /** Called by the agent's tab. */
  onOpenAgent: () => void;
  /** The Message sheet is open: the agent's tab shows active and the page's tab does not. */
  agentOpen?: boolean;
  /** The agent's first name (the fifth tab's label), or "your agent" / "" for the fallback "Agent". */
  agent?: string;
  /** A count shown on a tab (hidden when 0 or missing). */
  badges?: Partial<Record<PortalTabKey, number>>;
  /** Sit at the end of the page layout instead of fixed to the screen (the full-height Messages tab). */
  inFlow?: boolean;
}) {
  return (
    <nav
      aria-label="Customer portal"
      className={cn("portal-bg-navy-deep z-30 border-t border-white/[0.12] pb-[max(10px,env(safe-area-inset-bottom))] pt-1", inFlow ? "relative flex-none" : "sticky bottom-0")}
      data-testid="nav-bottom"
    >
      <div className="mx-auto flex max-w-xl px-1.5">
        {portalTabs(agent).map((tab) => {
          const on = tab.key === "agent" ? agentOpen : !agentOpen && active === tab.key;
          const count = badges[tab.key] ?? 0;
          const label = count > 0 ? `${tab.label}, ${count}` : tab.label;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => (tab.path ? onNavigate(tab.path) : onOpenAgent())}
              // The agent's tab opens a sheet rather than a page: it says "expanded", never "current page" (the visual highlight stays).
              aria-current={tab.path && on ? "page" : undefined}
              aria-expanded={tab.path ? undefined : agentOpen}
              aria-haspopup={tab.path ? undefined : "dialog"}
              aria-label={tab.key === "agent" ? (agent && agent !== "your agent" ? `Message ${agent}` : "Message your agent") : label}
              className={cn(
                "relative flex min-h-[60px] min-w-0 flex-1 flex-col items-center justify-center gap-[5px] px-0 text-[10px] font-normal uppercase tracking-[0.2em]",
                on ? "text-white" : "text-white/[0.62]",
              )}
              data-testid={`nav-tab-${tab.key}`}
            >
              {on && <span aria-hidden className="absolute inset-x-[32%] -top-1 h-0.5 bg-accent" />}
              <span className="relative block leading-[0]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {ICON_PATHS[tab.key].map((d) => (
                    <path key={d} d={d} />
                  ))}
                </svg>
                {count > 0 && (
                  <span
                    aria-hidden
                    className="absolute -right-3 -top-1.5 box-border h-[18px] min-w-[18px] rounded-[9px] bg-accent px-[5px] text-center text-[10px] font-medium leading-[18px] tracking-normal text-accent-foreground"
                    data-testid={`nav-badge-${tab.key}`}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </span>
              <span className="block max-w-full truncate" data-testid={`nav-label-${tab.key}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
