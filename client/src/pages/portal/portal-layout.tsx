import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { getPortalToken, setPortalToken, usePortalHasTags, PORTAL_PUSH_BANNER_DISMISSED_KEY } from "@/hooks/use-portal-api";
import {
  PortalFooter,
  PortalHeader,
  PortalTabBar,
  PortalThemeScope,
  activeTabForPath,
  interestsRedirectTarget,
  usePortalBrandingValue,
  usePortalSummary,
  usePortalPush,
} from "@/features/portal";
import { cn } from "@/lib/utils";

/** True inside a PortalLayout, so a page hosted by another page (the Trips segments) does not draw a second shell. */
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
      setLocation("/portal/login");
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

  return (
    <PortalThemeScope className={cn("flex flex-col", fullHeight ? "h-dvh overflow-hidden" : "pb-[calc(76px+env(safe-area-inset-bottom))]")}>
      <PortalHeader branding={branding} onHome={() => setLocation("/portal")} />

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
            <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-3">
              <div className="min-w-0 flex-1">
                <p className="portal-serif text-[20px] leading-tight">Get notified</p>
                <p className="text-[13px] text-white/80">We'll let you know when your agent replies.</p>
              </div>
              <button
                type="button"
                onClick={dismissBanner}
                className="min-h-11 px-2 text-[11px] font-medium uppercase tracking-[0.2em] text-white/80 hover:text-white"
                data-testid="button-dismiss-push"
              >
                Later
              </button>
              <button
                type="button"
                onClick={handleEnableNotifications}
                className="min-h-11 bg-accent px-4 text-[11px] font-medium uppercase tracking-[0.2em] text-accent-foreground hover:brightness-110"
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

      <PortalTabBar active={activeTab} onNavigate={setLocation} badges={{ trips: quoteCount }} inFlow={fullHeight} />
    </PortalThemeScope>
  );
}
