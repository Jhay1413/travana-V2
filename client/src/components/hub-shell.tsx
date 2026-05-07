import { useState, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useCurrentUser } from "@/hooks/queries";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  BookOpen,
  ChevronRight,
  GraduationCap,
  LogOut,
  Menu,
  Moon,
  Newspaper,
  Search,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Trophy,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { HubRole } from "@/data/hub-mock";
import { AskAiDialog } from "@/components/ask-ai-dialog";

const NAV_ITEMS = [
  { key: "profiles", label: "My Profile", icon: User, path: "/hub/profiles" },
  { key: "training", label: "Training Centre", icon: GraduationCap, path: "/hub/training" },
  { key: "knowledge", label: "Knowledge Vault", icon: BookOpen, path: "/hub/knowledge" },
  { key: "deals", label: "Deal Wins Wall", icon: Trophy, path: "/hub/deals" },
  { key: "news", label: "News & Announcements", icon: Newspaper, path: "/hub/news" },
  { key: "admin", label: "Admin", icon: Shield, path: "/hub/admin", ownerOnly: true },
];

const MOCK_NOTIFICATIONS = [
  { id: "1", text: "New training module: Closing on First Call", time: "1h ago" },
  { id: "2", text: "James closed £4,200 Tenerife deal", time: "2h ago" },
  { id: "3", text: "TUI commission update available", time: "3h ago" },
  { id: "4", text: "Monthly focus destination changed to Antalya", time: "5h ago" },
];

export function HubShell({
  children,
  role = "Senior Agent",
  onRoleChange,
}: {
  children: React.ReactNode;
  role?: HubRole;
  onRoleChange?: (r: HubRole) => void;
}) {
  const [location, navigate] = useLocation();
  const { data: currentUser } = useCurrentUser();
  const userName = currentUser?.name || "User";
  const userInitials = userName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const userImage = (currentUser as any)?.image || null;
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAskAi, setShowAskAi] = useState(false);

  const toggleTheme = useCallback(() => setTheme((t) => (t === "light" ? "dark" : "light")), []);
  const isDark = theme === "dark";

  const activeKey = NAV_ITEMS.find((item) => location === item.path)?.key
    || NAV_ITEMS.find((item) => location.startsWith(item.path) && item.path !== "/hub")?.key
    || "profiles";

  const filteredNav = NAV_ITEMS.filter((item) => {
    if ((item as any).ownerOnly && role !== "Owner") return false;
    return true;
  });

  return (
    <div className={cn(isDark ? "dark" : "", "min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300")}>
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col" data-testid="nav-hub-sidebar">
        <div className="flex grow flex-col gap-y-4 overflow-y-auto border-r border-slate-200 bg-white px-5 pb-4 pt-6 dark:border-slate-800 dark:bg-slate-900">
          <Link href="/hub" className="flex items-center gap-3 px-2" data-testid="link-hub-brand">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-900 dark:text-white" data-testid="text-hub-title">TheHUB</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Travel Intelligence</div>
            </div>
          </Link>

          <div className="mt-2 px-2">
            <select
              value={role}
              onChange={(e) => onRoleChange?.(e.target.value as HubRole)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              data-testid="select-hub-role"
            >
              {(["Owner", "Senior Agent", "Trainee"] as HubRole[]).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <nav className="mt-2 flex flex-1 flex-col gap-1">
            {filteredNav.map((item) => {
              const isActive = activeKey === item.key;
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.path}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                  )}
                  data-testid={`nav-hub-${item.key}`}
                >
                  <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500")} />
                  <span className="truncate">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="hub-nav-indicator"
                      className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              data-testid="nav-hub-back-crm"
            >
              <LogOut className="h-[18px] w-[18px] text-slate-400" />
              <span>Back to CRM</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80 sm:px-6" data-testid="nav-hub-topbar">
          <button
            type="button"
            className="lg:hidden -m-2.5 p-2.5 text-slate-700 dark:text-slate-300"
            onClick={() => setSidebarOpen(true)}
            data-testid="button-hub-menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex flex-1 items-center gap-4">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search TheHUB..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-lg border-slate-200 bg-slate-50 pl-9 text-sm dark:border-slate-700 dark:bg-slate-800"
                data-testid="input-hub-search"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="h-9 w-9 p-0 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
              data-testid="button-hub-theme"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }}
                className="relative h-9 w-9 p-0 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                data-testid="button-hub-notifications"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
              </Button>
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: -5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                    className="absolute right-0 top-12 z-50 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-800"
                    data-testid="dropdown-hub-notifications"
                  >
                    <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Notifications</div>
                    <div className="space-y-3">
                      {MOCK_NOTIFICATIONS.map((n) => (
                        <div key={n.id} className="flex items-start gap-3">
                          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                          <div>
                            <p className="text-sm text-slate-700 dark:text-slate-300">{n.text}</p>
                            <p className="text-xs text-slate-400">{n.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative">
              <button
                onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white shadow-sm overflow-hidden"
                data-testid="button-hub-profile"
              >
                {userImage ? <img src={userImage} alt={userName} className="h-full w-full object-cover" /> : userInitials}
              </button>
              <AnimatePresence>
                {showProfile && (
                  <motion.div
                    initial={{ opacity: 0, y: -5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                    className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800"
                    data-testid="dropdown-hub-profile"
                  >
                    <div className="px-3 py-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{userName}</p>
                      <p className="text-xs text-slate-500">{currentUser?.role || role}</p>
                    </div>
                    <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
                    <Link href="/hub/profiles" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700">
                      <User className="h-4 w-4" /> My Profile
                    </Link>
                    <Link href="/hub" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700">
                      <Settings className="h-4 w-4" /> Settings
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8" onClick={() => { setShowNotifications(false); setShowProfile(false); }}>
          {children}
        </main>
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: -288 }}
              animate={{ x: 0 }}
              exit={{ x: -288 }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 lg:hidden"
              data-testid="nav-hub-mobile-sidebar"
            >
              <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">TheHUB</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-2 text-slate-500">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex flex-col gap-1 p-4">
                {filteredNav.map((item) => {
                  const isActive = activeKey === item.key;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.key}
                      href={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                        isActive
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                          : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                      )}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowAskAi(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 items-center gap-2 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 px-5 text-white shadow-lg shadow-blue-500/30 transition-shadow hover:shadow-xl hover:shadow-blue-500/40"
        data-testid="button-hub-ai-assistant"
        aria-label="Ask AI"
      >
        <Sparkles className="h-5 w-5" />
        <span className="text-sm font-semibold">Ask AI</span>
      </motion.button>

      <AskAiDialog open={showAskAi} onOpenChange={setShowAskAi} />
    </div>
  );
}
