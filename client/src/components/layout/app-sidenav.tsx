import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  Command,
  LifeBuoy,
  Mail,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRoles } from "@/hooks/use-role";
import { useCurrentUser, useUnreadNotifications, useCurrentOrganization } from "@/hooks/queries";
import { getNavForRoles, isNavItem, type NavBadgeKey, type NavItem, type NavSection } from "@/config/nav";
import { useTicketsByUser } from "@/features/tickets";
// Imported from the module rather than the feature barrel on purpose: the
// barrel re-exports ConversationsInbox, and since the sidebar lives in the main
// bundle (not a lazy route) that pulled the whole inbox in with it — +221KB on
// the entry chunk, measured. Keep this deep import.
import { useConversationBadgeCounts, unreadBadgeCount } from "@/features/conversations/api/use-conversations-queries";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { Sheet, SheetPortal, SheetTrigger } from "@/components/ui/sheet";

const CONNECT_CHANNELS: Array<{ key: string; label: string; icon: React.ComponentType<{ className?: string }>; awaiting: number; href?: string }> = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageSquare, awaiting: 43 },
  { key: "facebook", label: "Facebook", icon: Users, awaiting: 2 },
  { key: "instagram", label: "Instagram", icon: Sparkles, awaiting: 0 },
  { key: "email", label: "Email", icon: Mail, awaiting: 9, href: "/email" },
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

function ItemRow({ item, active, collapsed, count = 0 }: { item: NavItem; active: boolean; collapsed: boolean; count?: number }) {
  const Icon = item.icon;
  const showBadge = count > 0;
  const badgeLabel = count > 99 ? "99+" : String(count);

  if (collapsed) {
    return (
      <Link
        href={item.path}
        title={item.label}
        data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
        className={cn(
          "relative grid h-10 w-10 place-items-center rounded-xl transition",
          active
            ? "bg-black/10 text-black dark:bg-white/15 dark:text-white"
            : "text-black/50 hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/7 dark:hover:text-white"
        )}
      >
        <Icon className="h-4 w-4" />
        {showBadge && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-black"
            data-testid={`badge-nav-${item.badge}`}
          >
            {badgeLabel}
          </span>
        )}
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
      <div className="flex items-center gap-2">
        {showBadge && (
          <span
            className="inline-flex min-w-[28px] items-center justify-center rounded-full border border-red-700 bg-red-600 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white shadow-sm"
            data-testid={`badge-nav-${item.badge}`}
            aria-label={`${count} ${item.label}`}
          >
            {badgeLabel}
          </span>
        )}
        <ChevronRight
          className={cn(
            "h-4 w-4",
            active ? "text-black/50 dark:text-white/70" : "text-black/35 dark:text-white/40"
          )}
        />
      </div>
    </Link>
  );
}

function collectLeafItems(entries: Array<NavItem | NavSection>): NavItem[] {
  const leaves: NavItem[] = [];
  for (const entry of entries) {
    if (isNavItem(entry)) {
      leaves.push(entry);
    } else {
      leaves.push(...collectLeafItems(entry.items));
    }
  }
  return leaves;
}

function collectLabelledSectionIds(entries: Array<NavItem | NavSection>): string[] {
  const ids: string[] = [];
  for (const entry of entries) {
    if (isNavItem(entry)) continue;
    if (entry.label) ids.push(entry.id);
    ids.push(...collectLabelledSectionIds(entry.items));
  }
  return ids;
}

// The labelled section whose items contain the current route (for accordion default).
function findActiveSectionId(
  entries: Array<NavItem | NavSection>,
  currentPath: string,
  currentSearch: string,
): string | null {
  for (const entry of entries) {
    if (isNavItem(entry)) continue;
    if (entry.label) {
      const leaves = collectLeafItems(entry.items);
      if (leaves.some((it) => isActive(currentPath, currentSearch, it.path))) return entry.id;
    }
    const nested = findActiveSectionId(entry.items, currentPath, currentSearch);
    if (nested) return nested;
  }
  return null;
}

// Map each labelled section id -> its nearest labelled-section ancestor (or null
// for top level). Used so the accordion only collapses same-level siblings,
// never a parent. Unlabelled sections are transparent (don't change parentage).
function buildSectionParentMap(
  entries: Array<NavItem | NavSection>,
  parent: string | null = null,
  map: Map<string, string | null> = new Map(),
): Map<string, string | null> {
  for (const entry of entries) {
    if (isNavItem(entry)) continue;
    if (entry.label) {
      map.set(entry.id, parent);
      buildSectionParentMap(entry.items, entry.id, map);
    } else {
      buildSectionParentMap(entry.items, parent, map);
    }
  }
  return map;
}

function ancestorChain(id: string, parentMap: Map<string, string | null>): string[] {
  const chain: string[] = [];
  let cur: string | null = id;
  while (cur) {
    chain.push(cur);
    cur = parentMap.get(cur) ?? null;
  }
  return chain;
}

function badgeCountFor(item: NavItem, badgeCounts: Partial<Record<NavBadgeKey, number>>): number {
  return item.badge ? badgeCounts[item.badge] ?? 0 : 0;
}

function SectionBlock({
  section,
  currentPath,
  currentSearch,
  collapsed,
  expandedIds,
  onToggle,
  badgeCounts,
}: {
  section: NavSection;
  currentPath: string;
  currentSearch: string;
  collapsed: boolean;
  expandedIds: string[];
  onToggle: (id: string) => void;
  badgeCounts: Partial<Record<NavBadgeKey, number>>;
}) {
  if (collapsed) {
    return (
      <>
        {collectLeafItems(section.items).map((item) => (
          <ItemRow
            key={item.path + item.label}
            item={item}
            active={isActive(currentPath, currentSearch, item.path)}
            collapsed
            count={badgeCountFor(item, badgeCounts)}
          />
        ))}
      </>
    );
  }

  const renderChildren = () =>
    section.items.map((child) =>
      isNavItem(child) ? (
        <ItemRow
          key={child.path + child.label}
          item={child}
          active={isActive(currentPath, currentSearch, child.path)}
          collapsed={false}
          count={badgeCountFor(child, badgeCounts)}
        />
      ) : (
        <SectionBlock
          key={child.id}
          section={child}
          currentPath={currentPath}
          currentSearch={currentSearch}
          collapsed={false}
          expandedIds={expandedIds}
          onToggle={onToggle}
          badgeCounts={badgeCounts}
        />
      )
    );

  if (!section.label) {
    return <div className="space-y-1">{renderChildren()}</div>;
  }

  const expanded = expandedIds.includes(section.id);
  const SectionIcon = section.icon;
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => onToggle(section.id)}
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
            <div className="space-y-1">{renderChildren()}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SidenavInner({
  collapsed,
  onToggleCollapsed,
  sticky = true,
}: {
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  sticky?: boolean;
}) {
  const { roles } = useRoles();
  const [location] = useLocation();
  const sections = getNavForRoles(roles);
  const sectionParent = useMemo(() => buildSectionParentMap(sections), [sections]);
  const [expandedSections, setExpandedSections] = useState<string[]>(() => {
    // Accordion: open only the branch containing the current route (the active
    // section plus its ancestors). Fall back to a saved selection, else none.
    const activePath = location.split("?")[0] || "/";
    const activeSearch = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
    const active = findActiveSectionId(sections, activePath, activeSearch);
    if (active) return ancestorChain(active, sectionParent);
    try {
      const saved = sessionStorage.getItem("admin-nav-expanded");
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) return arr;
      }
    } catch {}
    return [];
  });

  const { data: currentUser } = useCurrentUser();
  const { data: currentOrganization } = useCurrentOrganization();
  const { data: hubUnreadNotifs } = useUnreadNotifications(currentUser?.id || "");
  const hubUnreadCount = useMemo(() => {
    if (!hubUnreadNotifs || !Array.isArray(hubUnreadNotifs)) return 0;
    return hubUnreadNotifs.filter((n: any) =>
      n.type === "hub_post" || n.type === "hub_like" || n.type === "hub_share" || n.type === "hub_mention"
    ).length;
  }, [hubUnreadNotifs]);

  // Count of open tickets allocated to the current agent, shown as a badge on
  // the "Tickets" nav item. The endpoint also returns tickets the user created,
  // so filter to ones assigned to them and exclude resolved/closed.
  const { data: assignedTickets } = useTicketsByUser(currentUser?.id || "");
  const ticketCount = useMemo(() => {
    if (!Array.isArray(assignedTickets) || !currentUser?.id) return 0;
    return assignedTickets.filter((t) => {
      if (t.assignedTo !== currentUser.id) return false;
      const s = (t.status || "").toLowerCase();
      return s !== "resolved" && s !== "closed";
    }).length;
  }, [assignedTickets, currentUser?.id]);
  // Conversations awaiting a reply, shown as a badge on the "Conversations" nav
  // item. Shares unreadBadgeCount with the inbox's own header badge so the two
  // can never disagree.
  const { data: conversationBadges } = useConversationBadgeCounts();
  const conversationCount = unreadBadgeCount(conversationBadges);

  const badgeCounts = useMemo<Partial<Record<NavBadgeKey, number>>>(
    () => ({ tickets: ticketCount, conversations: conversationCount }),
    [ticketCount, conversationCount],
  );

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      // Expand the descendant subtree of every id in `seed` into `toClose`.
      const expandSubtree = (seed: string[]) => {
        const set = new Set<string>(seed);
        let changed = true;
        while (changed) {
          changed = false;
          sectionParent.forEach((parent, child) => {
            if (parent && set.has(parent) && !set.has(child)) {
              set.add(child);
              changed = true;
            }
          });
        }
        return set;
      };

      let next: string[];
      if (prev.includes(id)) {
        // Closing: drop this section and any of its open descendants.
        const toClose = expandSubtree([id]);
        next = prev.filter((x) => !toClose.has(x));
      } else {
        // Opening: close same-level siblings (and their subtrees), keep ancestors
        // and unrelated branches, then open this section.
        const parent = sectionParent.get(id) ?? null;
        const siblings = Array.from(sectionParent.keys()).filter(
          (k) => k !== id && (sectionParent.get(k) ?? null) === parent,
        );
        const toClose = expandSubtree(siblings);
        next = prev.filter((x) => !toClose.has(x));
        next.push(id);
      }
      try { sessionStorage.setItem("admin-nav-expanded", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const currentPath = location.split("?")[0] || "/";
  const currentSearch = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";

  return (
    <div
      className={cn(
        "glass ringed grain rounded-3xl transition-all duration-250",
        sticky && "sticky ",
        collapsed ? "p-2" : "p-4"
      )}
    >
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            {onToggleCollapsed && (
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="grid h-10 w-10 place-items-center rounded-xl text-black/40 hover:bg-black/5 hover:text-black dark:text-white/40 dark:hover:bg-white/7 dark:hover:text-white transition"
                title="Expand sidebar"
                data-testid="button-expand-sidebar"
              >
                <PanelLeftOpen className="h-6 w-6" />
              </button>
            )}
            <div
              className="relative grid h-11 w-11 place-items-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
              data-testid="img-brand-mark"
            >
              <Command className="h-5 w-5 text-black/70 dark:text-white/85" />
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {currentOrganization?.logoUrl ? (
                <img
                  src={currentOrganization.logoUrl}
                  alt={currentOrganization.name || currentUser?.orgName || "Logo"}
                  className="h-9 w-auto max-w-full object-contain object-left"
                  data-testid="img-brand-logo"
                />
              ) : (
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
              )}
            </div>
            {onToggleCollapsed && (
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="shrink-0 grid h-9 w-9 place-items-center rounded-xl text-black/40 hover:bg-black/5 hover:text-black dark:text-white/40 dark:hover:bg-white/7 dark:hover:text-white transition"
                title="Minimise sidebar"
                data-testid="button-collapse-sidebar"
              >
                <PanelLeftClose className="h-6 w-6" />
              </button>
            )}
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
              expandedIds={expandedSections}
              onToggle={toggleSection}
              badgeCounts={badgeCounts}
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
              {CONNECT_CHANNELS.map(({ key, label, icon: Icon, awaiting, href }) => {
                const channelHref = href ?? `/?s=connect-${key}`;
                const isActiveChannel = href ? currentPath === href : currentSearch === `s=connect-${key}`;
                return (
                  <Link
                    key={key}
                    href={channelHref}
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

          </>
        )}
    </div>
  );
}

export function AppSidenav() {
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  return (
    <aside
      className={cn(
        "hidden xl:block shrink-0 transition-all duration-250",
        collapsed ? "w-[72px]" : "w-[300px]"
      )}
      data-testid="app-sidenav"
    >
      <SidenavInner collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
    </aside>
  );
}

export function MobileSidenav() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const prevLocationRef = useRef(location);

  useEffect(() => {
    if (location !== prevLocationRef.current) {
      setOpen(false);
      prevLocationRef.current = location;
    }
  }, [location]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open navigation"
          className="xl:hidden inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-black/5 text-black/70 transition hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
          data-testid="button-open-mobile-sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetPortal>
        <SheetPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <SheetPrimitive.Content
          className="fixed inset-y-0 left-0 z-50 h-full w-[320px] sm:max-w-[320px] p-3 transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
        >
          <SidenavInner collapsed={false} sticky={false} />
        </SheetPrimitive.Content>
      </SheetPortal>
    </Sheet>
  );
}
