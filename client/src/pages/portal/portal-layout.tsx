import { useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Home, FileText, Briefcase, Tag, MessageCircle, LogOut } from "lucide-react";
import { getPortalToken, setPortalToken, clearPortalToken } from "@/hooks/use-portal-api";

const tabs = [
  { key: "home", label: "Home", icon: Home, path: "/portal" },
  { key: "quotes", label: "Quotes", icon: FileText, path: "/portal/quotes" },
  { key: "bookings", label: "Bookings", icon: Briefcase, path: "/portal/bookings" },
  { key: "deals", label: "Deals", icon: Tag, path: "/portal/deals" },
  { key: "messages", label: "Messages", icon: MessageCircle, path: "/portal/messages" },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

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

  const handleLogout = () => {
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
      <div className="fixed top-0 left-0 right-0 z-40 px-4 pt-3 flex justify-end">
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all text-xs"
          data-testid="button-logout"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>

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
