import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { getPortalToken, setPortalToken, usePortalHasTags, usePortalUser, PORTAL_PUSH_BANNER_DISMISSED_KEY } from "@/hooks/use-portal-api";
import {
  PortalFooter,
  PortalHeader,
  PortalHeroContext,
  PortalMenu,
  PortalMessageSheetProvider,
  PortalTabBar,
  PortalThemeScope,
  activeTabForPath,
  agentFirstName,
  menuCount,
  menuKeyForPath,
  signOutPortal,
  interestsRedirectTarget,
  portalLoginTarget,
  usePortalBrandingValue,
  usePortalMessageSheet,
  usePortalSummary,
  usePortalPush,
  type PortalMenuItem,
} from "@/features/portal";
import { cn } from "@/lib/utils";

/** True inside a PortalLayout, so a page hosted by another page (a nested page) does not draw a second shell. */
const PortalShellContext = createContext(false);

interface PortalLayoutProps {
  children: ReactNode;
  /**
   * `dark` (default) hosts the existing inner pages, which keep their dark styling for now.
   * `light` is for pages written in the new cream style.
   */
  tone?: "dark" | "light";
}

export default function PortalLayout({ children, tone = "dark" }: PortalLayoutProps) {
  const nested = useContext(PortalShellContext);
  if (nested) return <>{children}</>;
  return (
    <PortalShellContext.Provider value>
      <PortalShell tone={tone}>{children}</PortalShell>
    </PortalShellContext.Provider>
  );
}

function PortalShell({ children, tone }: Required<PortalLayoutProps>) {
  const [location, setLocation] = useLocation();
  const branding = usePortalBrandingValue();
  const reduceMotion = useReducedMotion();
  const { state: pushState, enable: enablePush } = usePortalPush();
  const [showBanner, setShowBanner] = useState(false);
  // Persisted across tab navigation (sessionStorage), reset on logout → shows once per login.
  const bannerDismissed = useRef(sessionStorage.getItem(PORTAL_PUSH_BANNER_DISMISSED_KEY) === "1");

  const { data: hasTagsData, isSuccess: hasTagsLoaded } = usePortalHasTags();
  // The same unanswered-quotes number Home shows ("quotes to consider"), from the same query (nothing here polls).
  const { data: summary } = usePortalSummary();
  const { data: user } = usePortalUser();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  // How many heroes are on the page; with none, a navy band sits behind the floating header.
  const [heroes, setHeroes] = useState(0);
  const heroApi = useMemo(
    () => ({
      register: () => {
        setHeroes((n) => n + 1);
        return () => setHeroes((n) => n - 1);
      },
    }),
    [],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      setPortalToken(urlToken);
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);
      return;
    }

    const token = getPortalToken();
    if (!token) {
      // Keep the page they were going to (path, query and hash) so signing in lands there, not on Home.
      setLocation(portalLoginTarget(window.location.pathname, window.location.search, window.location.hash));
    }
  }, [setLocation]);

  useEffect(() => {
    if (hasTagsLoaded && hasTagsData?.hasTags === false) {
      setLocation(interestsRedirectTarget(window.location.pathname, window.location.search));
    }
  }, [hasTagsLoaded, hasTagsData, setLocation]);

  // Offer push once per login, shortly after the shell appears, only when it can work and has not been decided yet.
  useEffect(() => {
    if (pushState !== "off") return;
    if (bannerDismissed.current || Notification.permission !== "default") return;
    const timer = setTimeout(() => setShowBanner(true), 2000);
    return () => clearTimeout(timer);
  }, [pushState]);

  const dismissBanner = () => {
    setShowBanner(false);
    bannerDismissed.current = true;
    sessionStorage.setItem(PORTAL_PUSH_BANNER_DISMISSED_KEY, "1");
  };

  const handleEnableNotifications = async () => {
    dismissBanner();
    await enablePush();
  };

  const activeTab = activeTabForPath(location);
  const quoteCount = summary?.counts.quotesAwaiting ?? 0;
  // The Messages page is a full-height chat: the shell is exactly the screen tall, the tab bar sits in the flow
  // under it (so nothing hard-codes the header or tab bar height), and there is no footer to sit below the fold.
  const fullHeight = activeTab === "messages";
  const hideFooter = fullHeight;

  // "← My quotes" on a quote (the design), "← My bookings" on a booking opened from a list, in place of the logo.
  const back = location.startsWith("/portal/quote/")
    ? { label: "My quotes", onClick: () => setLocation("/portal/quotes") }
    : location.startsWith("/portal/booking/")
      ? { label: "My bookings", onClick: () => setLocation("/portal/bookings") }
      : undefined;

  const menuCurrent = menuKeyForPath(location);
  // The design's three rows, then the pages that have no tab, in the same row style.
  const menuItems = [
    { key: "home", label: "Home", path: "/portal" },
    { key: "quotes", label: "My quotes", path: "/portal/quotes", count: menuCount(summary?.counts.quotesAwaiting, "to view") },
    { key: "bookings", label: "My bookings", path: "/portal/bookings", count: menuCount(summary?.counts.upcomingBookings, "booked") },
    { key: "messages", label: "Messages", path: "/portal/messages" },
    { key: "deals", label: "Deals", path: "/portal/deals" },
    { key: "rewards", label: "Rewards", path: "/portal/referrals" },
    { key: "interests", label: "Travel interests", path: "/portal/tags" },
    { key: "account", label: "My account", path: "/portal/account" },
  ];
  const logOut = async () => {
    setMenuOpen(false);
    await signOutPortal();
    // Nothing from this customer may linger for the next person on a shared device.
    queryClient.removeQueries({ queryKey: ["portal"] });
    setLocation("/portal/login");
  };

  return (
    <PortalThemeScope className={cn("relative flex flex-col", fullHeight && "h-dvh overflow-hidden")}>
      <PortalMessageSheetProvider>
      <PortalHeroContext.Provider value={heroApi}>
      <PortalHeader branding={branding} onHome={() => setLocation("/portal")} onMenu={() => setMenuOpen(true)} back={back} />
      {heroes === 0 && <div aria-hidden className="h-[92px] flex-none bg-[#0D2A4E]" data-testid="portal-header-band" />}

      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="portal-bg-navy-deep text-white"
            role="region"
            aria-label="Notifications"
          >
            <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 pb-3 pt-[88px]">
              <div className="min-w-0 flex-1">
                <p className="portal-serif text-[20px] leading-tight">Get notified</p>
                <p className="text-[13px] text-white/80">We'll let you know when your agent replies.</p>
              </div>
              <button
                type="button"
                onClick={dismissBanner}
                className="min-h-11 px-2 text-[11px] font-normal uppercase tracking-[0.2em] text-white/80 hover:text-white"
                data-testid="button-dismiss-push"
              >
                Later
              </button>
              <button
                type="button"
                onClick={handleEnableNotifications}
                className="min-h-11 bg-accent px-4 text-[11px] font-normal uppercase tracking-[0.2em] text-accent-foreground hover:brightness-110"
                data-testid="button-enable-push"
              >
                Enable
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className={cn("flex-1", fullHeight && "flex min-h-0 flex-col", tone === "dark" && "portal-legacy bg-[#0a0a0f] font-sans text-white")}>
        {reduceMotion ? (
          children
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={fullHeight ? "flex min-h-0 flex-1 flex-col" : undefined}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {!hideFooter && <PortalFooter branding={branding} />}

      <PortalShellNav
        activeTab={activeTab}
        quoteCount={quoteCount}
        fullHeight={fullHeight}
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
        customerName={[user?.firstName, user?.lastName].filter(Boolean).join(" ")}
        menuItems={menuItems}
        menuCurrent={menuCurrent}
        onLogout={logOut}
      />
      </PortalHeroContext.Provider>
      </PortalMessageSheetProvider>
    </PortalThemeScope>
  );
}

/** The bottom tab bar and the full-screen menu. Inside the Message sheet's provider, so the agent tab and the menu's "Message <agent>" can open it. */
function PortalShellNav({
  activeTab,
  quoteCount,
  fullHeight,
  menuOpen,
  onMenuOpenChange,
  customerName,
  menuItems,
  menuCurrent,
  onLogout,
}: {
  activeTab: ReturnType<typeof activeTabForPath>;
  quoteCount: number;
  fullHeight: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  customerName: string;
  menuItems: readonly PortalMenuItem[];
  menuCurrent: string | null;
  onLogout: () => void;
}) {
  const [, setLocation] = useLocation();
  const branding = usePortalBrandingValue();
  const messageSheet = usePortalMessageSheet();
  const agent = agentFirstName(branding.agentName ?? "");
  return (
    <>
      <PortalTabBar
        active={activeTab}
        onNavigate={setLocation}
        onOpenAgent={() => messageSheet.open()}
        agentOpen={messageSheet.isOpen}
        agent={agent}
        badges={{ quotes: quoteCount }}
        inFlow={fullHeight}
      />
      <PortalMenu
        open={menuOpen}
        onOpenChange={onMenuOpenChange}
        branding={branding}
        customerName={customerName}
        agent={agent}
        items={menuItems}
        currentKey={menuCurrent}
        onNavigate={setLocation}
        onMessageAgent={() => messageSheet.open()}
        onLogout={onLogout}
      />
    </>
  );
}
