import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Home, FileText, Briefcase, Tag, MessageCircle, LogOut, Bell, BellOff, Gift } from "lucide-react";
import { getPortalToken, setPortalToken, clearPortalToken, usePortalHasTags } from "@/hooks/use-portal-api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function doSubscribe(): Promise<boolean> {
  try {
    const token = getPortalToken();
    if (!token) return false;

    const reg = await navigator.serviceWorker.register("/portal-sw.js");
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const resp = await fetch("/api/portal/push/vapid-key");
    const { publicKey } = await resp.json();
    if (!publicKey) return false;

    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    await fetch("/api/portal/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    return true;
  } catch (err) {
    console.warn("Push subscription failed:", err);
    return false;
  }
}

async function doUnsubscribe(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/portal-sw.js");
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const token = getPortalToken();
        if (token) {
          await fetch("/api/portal/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          }).catch(() => {});
        }
        await sub.unsubscribe().catch(() => {});
      }
    }
  } catch {}
}

async function checkExistingSubscription(): Promise<boolean> {
  try {
    if (!pushSupported()) return false;
    if (Notification.permission !== "granted") return false;
    const reg = await navigator.serviceWorker.getRegistration("/portal-sw.js");
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

const tabs = [
  { key: "home", label: "Home", icon: Home, path: "/portal" },
  { key: "quotes", label: "Quotes", icon: FileText, path: "/portal/quotes" },
  { key: "bookings", label: "Bookings", icon: Briefcase, path: "/portal/bookings" },
  { key: "deals", label: "Deals", icon: Tag, path: "/portal/deals" },
  { key: "messages", label: "Messages", icon: MessageCircle, path: "/portal/messages" },
  { key: "referrals", label: "Rewards", icon: Gift, path: "/portal/referrals" },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [pushState, setPushState] = useState<"unknown" | "unsupported" | "off" | "on" | "denied">("unknown");
  const [showBanner, setShowBanner] = useState(false);
  const bannerDismissed = useRef(false);

  const { data: hasTagsData, isSuccess: hasTagsLoaded } = usePortalHasTags();

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
      setLocation("/portal/tags");
    }
  }, [hasTagsLoaded, hasTagsData, setLocation]);

  useEffect(() => {
    const token = getPortalToken();
    if (!token) return;

    if (!pushSupported()) {
      console.log("[Push] Not supported in this browser/context", {
        sw: "serviceWorker" in navigator,
        push: "PushManager" in window,
        notif: "Notification" in window,
      });
      setPushState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      console.log("[Push] Permission denied");
      setPushState("denied");
      return;
    }
    checkExistingSubscription().then(active => {
      console.log("[Push] Existing subscription:", active);
      if (active) {
        setPushState("on");
      } else {
        setPushState("off");
        if (!bannerDismissed.current && Notification.permission === "default") {
          setTimeout(() => setShowBanner(true), 2000);
        }
      }
    });
  }, []);

  const handleEnableNotifications = useCallback(async () => {
    setShowBanner(false);
    bannerDismissed.current = true;
    const ok = await doSubscribe();
    setPushState(ok ? "on" : (Notification.permission === "denied" ? "denied" : "off"));
  }, []);

  const handleDismissBanner = useCallback(() => {
    setShowBanner(false);
    bannerDismissed.current = true;
  }, []);

  const handleTogglePush = useCallback(async () => {
    if (pushState === "on") {
      await doUnsubscribe();
      setPushState("off");
    } else {
      const ok = await doSubscribe();
      setPushState(ok ? "on" : (Notification.permission === "denied" ? "denied" : "off"));
    }
  }, [pushState]);

  const handleLogout = async () => {
    if (pushSupported()) {
      await doUnsubscribe();
    }
    clearPortalToken();
    setLocation("/portal/login");
  };

  const activeTab = tabs.find(t =>
    t.path === "/portal"
      ? location === "/portal" || location === "/portal/"
      : location.startsWith(t.path)
  )?.key || "home";

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="fixed top-0 left-0 right-0 z-40 px-4 pt-3 flex justify-end gap-2">
        {pushState !== "unknown" && (
          <button
            onClick={pushState === "unsupported" || pushState === "denied" ? undefined : handleTogglePush}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all text-xs ${
              pushState === "on"
                ? "text-emerald-400 hover:bg-emerald-400/10"
                : pushState === "denied" || pushState === "unsupported"
                ? "text-white/20 cursor-not-allowed"
                : "text-white/40 hover:text-white/70 hover:bg-white/[0.06]"
            }`}
            disabled={pushState === "denied" || pushState === "unsupported"}
            title={
              pushState === "on" ? "Notifications enabled — tap to disable"
                : pushState === "denied" ? "Notifications blocked in browser settings"
                : pushState === "unsupported" ? "Notifications not supported here"
                : "Enable notifications"
            }
            data-testid="button-toggle-push"
          >
            {pushState === "on" ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          </button>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all text-xs"
          data-testid="button-logout"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>

      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="fixed top-12 left-3 right-3 z-50"
          >
            <div className="backdrop-blur-xl bg-purple-500/20 border border-purple-400/30 rounded-2xl px-4 py-3 flex items-center gap-3">
              <Bell className="w-5 h-5 text-purple-300 shrink-0" />
              <div className="flex-1 min-w-0">
                {pushState === "unsupported" ? (
                  <>
                    <p className="text-sm font-medium text-white">Notifications</p>
                    <p className="text-xs text-white/60">Open this page in your phone's browser (Safari/Chrome) to enable push notifications</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-white">Get notified</p>
                    <p className="text-xs text-white/60">We'll let you know when your agent replies</p>
                  </>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={handleDismissBanner}
                  className="text-xs text-white/40 hover:text-white/70 px-2 py-1"
                  data-testid="button-dismiss-push"
                >
                  {pushState === "unsupported" ? "OK" : "Later"}
                </button>
                {pushState !== "unsupported" && (
                  <button
                    onClick={handleEnableNotifications}
                    className="text-xs bg-purple-500 hover:bg-purple-400 text-white px-3 py-1 rounded-xl font-medium transition-colors"
                    data-testid="button-enable-push"
                  >
                    Enable
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-3 pt-0" data-testid="nav-bottom">
        <div className="backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl px-2 py-2">
          <div className="flex items-center justify-around">
            {tabs.map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setLocation(tab.path)}
                  className="relative flex flex-col items-center gap-0.5 py-2 px-3 rounded-2xl transition-all"
                  data-testid={`nav-tab-${tab.key}`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="tab-bg"
                      className="absolute inset-0 bg-white/[0.1] rounded-2xl"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                  <tab.icon
                    className={`w-5 h-5 relative z-10 transition-colors ${
                      isActive ? "text-purple-400" : "text-white/40"
                    }`}
                  />
                  <span
                    className={`text-[10px] relative z-10 font-medium transition-colors ${
                      isActive ? "text-white" : "text-white/40"
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
