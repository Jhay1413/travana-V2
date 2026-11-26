import { Home, Luggage, Tag, MessageCircle, User } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { PORTAL_TABS, type PortalTabKey } from "../portal-nav";

const ICONS: Record<PortalTabKey, ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>> = {
  home: Home,
  trips: Luggage,
  deals: Tag,
  messages: MessageCircle,
  account: User,
};

/** Navy bottom bar: five tabs, 44px+ targets, safe-area padding, `aria-current` on the active one. */
export function PortalTabBar({
  active,
  onNavigate,
  badges = {},
  inFlow = false,
}: {
  active: PortalTabKey | null;
  onNavigate: (path: string) => void;
  /** A count shown on a tab (hidden when 0 or missing). */
  badges?: Partial<Record<PortalTabKey, number>>;
  /** Sit at the end of the page layout instead of fixed to the screen (the full-height Messages tab). */
  inFlow?: boolean;
}) {
  return (
    <nav
      aria-label="Customer portal"
      className={cn("portal-bg-navy-deep z-50 border-t border-white/10 pb-[max(8px,env(safe-area-inset-bottom))] pt-1", inFlow ? "relative flex-none" : "fixed inset-x-0 bottom-0")}
      data-testid="nav-bottom"
    >
      <div className="mx-auto flex max-w-xl px-1">
        {PORTAL_TABS.map((tab) => {
          const on = active === tab.key;
          const Icon = ICONS[tab.key];
          const count = badges[tab.key] ?? 0;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onNavigate(tab.path)}
              aria-current={on ? "page" : undefined}
              aria-label={count > 0 ? `${tab.label}, ${count}` : tab.label}
              className={cn(
                "relative flex min-h-[60px] min-w-0 flex-1 flex-col items-center justify-center gap-[5px] px-0.5 text-[11px] font-medium uppercase tracking-[0.1em] transition-colors",
                on ? "text-white" : "text-white/75 hover:text-white",
              )}
              data-testid={`nav-tab-${tab.key}`}
            >
              {on && <span aria-hidden className="portal-bg-brand-accent absolute inset-x-[28%] -top-1 h-0.5" />}
              <span className="relative">
                <Icon className="size-[22px]" strokeWidth={1.5} aria-hidden />
                {count > 0 && (
                  <span
                    aria-hidden
                    className="absolute -right-3 -top-1.5 min-w-[18px] rounded-full bg-accent px-[5px] text-center text-[11px] font-medium leading-[18px] tracking-normal text-accent-foreground"
                    data-testid={`nav-badge-${tab.key}`}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </span>
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
