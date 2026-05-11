import { useCallback, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  Command,
  LifeBuoy,
  Mail,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/hooks/use-role";
import { useCurrentUser, useUnreadNotifications } from "@/hooks/queries";
import { getNavForRole, type NavItem, type NavSection } from "@/config/nav";

const CONNECT_CHANNELS: Array<{ key: string; label: string; icon: React.ComponentType<{ className?: string }>; awaiting: number }> = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageSquare, awaiting: 43 },
  { key: "facebook", label: "Facebook", icon: Users, awaiting: 2 },
  { key: "instagram", label: "Instagram", icon: Sparkles, awaiting: 0 },
  { key: "email", label: "Email", icon: Mail, awaiting: 9 },
];

const COLLAPSED_KEY = "sidebar-collapsed";

function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === "true"; } catch { return false; }
  });
  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch {}
      return next;
    });
  }, []);
  return [collapsed, toggle] as const;
}

function isActive(currentPath: string, currentSearch: string, itemPath: string): boolean {
  const [path, query] = itemPath.split("?");
  if (query) {
    const itemParams = new URLSearchParams(query);
    const currentParams = new URLSearchParams(currentSearch);
    let match = true;
    itemParams.forEach((v, k) => {
      if (currentParams.get(k) !== v) match = false;
    });
    if (!match) return false;
    return currentPath === (path || "/");
  }
  if (itemPath === "/") return currentPath === "/" && !currentSearch;
  return currentPath === itemPath || currentPath.startsWith(itemPath + "/");
}

function ItemRow({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon;

  if (collapsed) {
    return (
      <Link
        href={item.path}
        title={item.label}
        data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
        className={cn(
          "grid h-10 w-10 place-items-center rounded-xl transition",
          active
            ? "bg-black/10 text-black dark:bg-white/15 dark:text-white"
            : "text-black/50 hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/7 dark:hover:text-white"
        )}
      >
        <Icon className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <Link
      href={item.path}
      data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
      className={cn(
        "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition no-underline",
        active
          ? "bg-black/5 text-black dark:bg-white/10 dark:text-white"
          : "bg-transparent text-black/65 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/7 dark:hover:text-white"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-lg border",
            active
              ? "border-black/10 bg-black/5 dark:border-white/15 dark:bg-white/10"
              : "border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
          )}
          aria-hidden
        >
          <Icon className="h-4 w-4 text-black/70 dark:text-white/80" />
        </span>
        <span className="text-sm font-medium">{item.label}</span>
      </div>
      <ChevronRight
        className={cn(
          "h-4 w-4",
          active ? "text-black/50 dark:text-white/70" : "text-black/35 dark:text-white/40"
        )}
      />
    </Link>
  );
}

function SectionBlock({
  section,
  currentPath,
  currentSearch,
  collapsed,
  expanded,
  onToggle,
}: {
  section: NavSection;
  currentPath: string;
  currentSearch: string;
  collapsed: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (collapsed) {
    return (
      <>
        {section.items.map((item) => (
          <ItemRow
            key={item.path + item.label}
            item={item}
            active={isActive(currentPath, currentSearch, item.path)}
            collapsed
          />
        ))}
      </>
    );
  }

  if (!section.label) {
    return (
      <div className="space-y-1">
        {section.items.map((item) => (
          <ItemRow
            key={item.path + item.label}
            item={item}
            active={isActive(currentPath, currentSearch, item.path)}
            collapsed={false}
          />
        ))}
      </div>
    );
  }

  const SectionIcon = section.icon;
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition bg-transparent text-black/65 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/7 dark:hover:text-white"
        data-testid={`nav-section-${section.id}`}
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5" aria-hidden>
            {SectionIcon ? <SectionIcon className="h-4 w-4 text-black/70 dark:text-white/80" /> : null}
          </span>
          <span className="text-sm font-semibold">{section.label}</span>
        </div>
        <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight className="h-4 w-4 text-black/35 dark:text-white/40" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden pl-4"
          >
            <div className="space-y-1">
              {section.items.map((item) => (
                <ItemRow
                  key={item.path + item.label}
                  item={item}
                  active={isActive(currentPath, currentSearch, item.path)}
                  collapsed={false}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AppSidenav() {
  const { orgRole } = useRole();
  const [location] = useLocation();
  const sections = getNavForRole(orgRole);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const [expandedSections, setExpandedSections] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem("admin-nav-expanded");
      return saved ? JSON.parse(saved) : sections.filter((s) => s.label).map((s) => s.id);
    } catch {
      return sections.filter((s) => s.label).map((s) => s.id);
    }
  });

  const { data: currentUser } = useCurrentUser();
  const { data: hubUnreadNotifs } = useUnreadNotifications(currentUser?.id || "");
  const hubUnreadCount = useMemo(() => {
    if (!hubUnreadNotifs || !Array.isArray(hubUnreadNotifs)) return 0;
    return hubUnreadNotifs.filter((n: any) =>
      n.type === "hub_post" || n.type === "hub_like" || n.type === "hub_share" || n.type === "hub_mention"
    ).length;
  }, [hubUnreadNotifs]);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { sessionStorage.setItem("admin-nav-expanded", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const currentPath = location.split("?")[0] || "/";
  const currentSearch = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";

  return (
    <aside
      className={cn(
        "hidden xl:block shrink-0 transition-all duration-250",
        collapsed ? "w-[72px]" : "w-[320px]"
      )}
      data-testid="app-sidenav"
    >
      <div
        className={cn(
          "glass ringed grain sticky top-4 rounded-3xl transition-all duration-250",
          collapsed ? "p-2" : "p-4"
        )}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <div
              className="relative grid h-11 w-11 place-items-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
              data-testid="img-brand-mark"
            >
              <Command className="h-5 w-5 text-black/70 dark:text-white/85" />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="relative grid h-11 w-11 place-items-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
                data-testid="img-brand-mark"
              >
                <Command className="h-5 w-5 text-black/70 dark:text-white/85" />
                <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/5 dark:ring-white/5" />
              </div>
              <div className="min-w-0">
                <div className="title-serif truncate text-sm font-semibold" data-testid="text-brand-name">
                  {currentUser?.orgName || "Travana"}
                </div>
                <div className="truncate text-xs text-black/55 dark:text-white/55" data-testid="text-brand-sub">
                  {currentUser?.branchName || "—"}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={cn("h-px bg-black/10 dark:bg-white/10", collapsed ? "my-2" : "my-4")} />

        <nav className={collapsed ? "flex flex-col items-center gap-1" : "space-y-1"}>
          {sections.map((section) => (
            <SectionBlock
              key={section.id}
              section={section}
              currentPath={currentPath}
              currentSearch={currentSearch}
              collapsed={collapsed}
              expanded={expandedSections.includes(section.id)}
              onToggle={() => toggleSection(section.id)}
            />
          ))}

          {collapsed && (
            <>
              <div className="my-1 h-px w-8 bg-black/10 dark:bg-white/10" />
              <Link
                href="/hub"
                title="TheHub"
                data-testid="link-hub"
                className="relative grid h-10 w-10 place-items-center rounded-xl text-black/50 hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/7 dark:hover:text-white transition"
              >
                <LifeBuoy className="h-4 w-4" />
                {hubUnreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                    {hubUnreadCount > 99 ? "99+" : hubUnreadCount}
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="grid h-10 w-10 place-items-center rounded-xl text-black/40 hover:bg-black/5 hover:text-black dark:text-white/40 dark:hover:bg-white/7 dark:hover:text-white transition"
                title="Expand sidebar"
                data-testid="button-expand-sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </>
          )}
        </nav>

        {!collapsed && (
          <>
            <div className="my-4 h-px bg-black/10 dark:bg-white/10" />

            <div className="grid gap-2">
              <Link
                href="/hub"
                className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-3 py-3 text-left transition hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 no-underline"
                data-testid="link-hub"
              >
                <div className="flex items-center gap-3">
                  <div className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                    <LifeBuoy className="h-4 w-4 text-black/70 dark:text-white/80" />
                    {hubUnreadCount > 0 && (
                      <span
                        className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white shadow-sm"
                        data-testid="badge-hub-unread"
                      >
                        {hubUnreadCount > 99 ? "99+" : hubUnreadCount}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold" data-testid="text-support-title">TheHub</div>
                    <div className="text-xs text-black/55 dark:text-white/55" data-testid="text-support-sub">
                      Profile, News & Training
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-black/45 dark:text-white/60" />
              </Link>
            </div>

            <div className="my-4 h-px bg-black/10 dark:bg-white/10" />

            <div className="flex items-center gap-3 px-3">
              <div
                className="relative grid h-11 w-11 place-items-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
                data-testid="img-connect-mark"
              >
                <MessageSquare className="h-5 w-5 text-black/70 dark:text-white/85" />
                <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/5 dark:ring-white/5" />
              </div>
              <div className="min-w-0">
                <div className="title-serif truncate text-sm font-semibold" data-testid="text-connect-name">
                  Connect
                </div>
                <div className="truncate text-xs text-black/55 dark:text-white/55" data-testid="text-connect-sub">
                  Channels & conversations
                </div>
              </div>
            </div>

            <div
              className="mt-3 mb-1 h-px bg-black/10 dark:bg-white/10"
              data-testid="separator-connect"
            />

            <div className="space-y-1" data-testid="section-connect">
              {CONNECT_CHANNELS.map(({ key, label, icon: Icon, awaiting }) => {
                const isActiveChannel = currentSearch === `s=connect-${key}`;
                return (
                  <Link
                    key={key}
                    href={`/?s=connect-${key}`}
                    className={cn(
                      "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition no-underline",
                      isActiveChannel
                        ? "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                        : "bg-transparent text-black/65 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/7 dark:hover:text-white"
                    )}
                    data-testid={`nav-connect-${key}`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "inline-flex h-8 w-8 items-center justify-center rounded-xl border",
                          isActiveChannel
                            ? "border-black/10 bg-black/5 dark:border-white/15 dark:bg-white/10"
                            : "border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
                        )}
                        aria-hidden
                      >
                        <Icon className="h-4 w-4 text-black/70 dark:text-white/80" />
                      </span>
                      <span className="text-sm font-medium" data-testid={`text-connect-label-${key}`}>
                        {label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {awaiting > 0 && (
                        <span
                          className={cn(
                            "inline-flex min-w-[28px] items-center justify-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                            isActiveChannel
                              ? "border-black/10 bg-black/10 text-black dark:border-white/15 dark:bg-white/15 dark:text-white"
                              : "border-black/10 bg-black/5 text-black/70 dark:border-white/10 dark:bg-white/10 dark:text-white/80"
                          )}
                          data-testid={`badge-connect-awaiting-${key}`}
                          aria-label={`${awaiting} awaiting`}
                        >
                          {awaiting}
                        </span>
                      )}
                      <ChevronRight
                        className={cn(
                          "h-4 w-4",
                          isActiveChannel
                            ? "text-black/50 dark:text-white/70"
                            : "text-black/35 dark:text-white/40"
                        )}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="my-4 h-px bg-black/10 dark:bg-white/10" />

            <button
              type="button"
              onClick={toggleCollapsed}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition text-black/50 hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/7 dark:hover:text-white"
              data-testid="button-collapse-sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
              <span className="text-sm font-medium">Minimise</span>
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
