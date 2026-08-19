import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Blocks,
  ChevronRight,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRoles } from "@/hooks/use-role";
import { useCurrentUser, useUnreadNotifications } from "@/hooks/queries";
import { getNavForRoles, isNavItem, type NavBadgeKey, type NavItem, type NavSection } from "@/config/nav";
import { useTicketsByUser, countMyActiveTickets } from "@/features/tickets";
// Imported from the module rather than the feature barrel on purpose: the
// barrel re-exports ConversationsInbox, and since the sidebar lives in the main
// bundle (not a lazy route) that pulled the whole inbox in with it — +221KB on
// the entry chunk, measured. Keep this deep import.
import { useConversationBadgeCounts, unreadBadgeCount } from "@/features/conversations/api/use-conversations-queries";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { Sheet, SheetPortal, SheetTrigger } from "@/components/ui/sheet";

const COLLAPSED_KEY = "sidebar-collapsed";

// Travana platform logo shown at the top of the rail (and in the mobile
// header). Replaced by the organisation logo when one is set.
export function BrandMark() {
  return (
    <img
      src="/Travana-Platform-Logo-White.png"
      alt="Travana"
      className="h-7 w-auto max-w-full object-contain"
    />
  );
}

function useSidebarCollapsed() {
  // The icon rail is the default on every visit; expanding is remembered only
  // for the current tab (sessionStorage), so a fresh load always shows the rail.
  const [collapsed, setCollapsed] = useState(() => {
    try { return sessionStorage.getItem(COLLAPSED_KEY) !== "false"; } catch { return true; }
  });
  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { sessionStorage.setItem(COLLAPSED_KEY, String(next)); } catch {}
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
          "relative grid h-10 w-10 place-items-center rounded-lg border transition",
          active
            ? "border-white/30 bg-white/15 text-white"
            : "border-white/15 text-[#8FA0B5] hover:border-white/25 hover:bg-white/10 hover:text-white"
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} />
        {showBadge && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-[#2E3D50]"
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
        "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition no-underline",
        active
          ? "bg-white/15 text-white"
          : "bg-transparent text-white/65 hover:bg-white/10 hover:text-white"
      )}
    >
      <div className="flex items-center gap-3">
        <Icon
          className={cn("h-4.5 w-4.5 shrink-0", active ? "text-white" : "text-[#8FA0B5]")}
          strokeWidth={1.75}
          aria-hidden
        />
        <span className="text-sm font-medium">{item.label}</span>
      </div>
      <div className="flex items-center gap-2">
        {showBadge && (
          <span
            className="inline-flex min-w-[28px] items-center justify-center rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white shadow-sm"
            data-testid={`badge-nav-${item.badge}`}
            aria-label={`${count} ${item.label}`}
          >
            {badgeLabel}
          </span>
        )}
        <ChevronRight
          className={cn("h-4 w-4", active ? "text-white/70" : "text-white/30")}
        />
      </div>
    </Link>
  );
}

// Direct items only — labelled sub-sections (Data Management, Organisation…)
// are skipped so the rail stays a short list.
function collectUnlabelledLeaves(entries: Array<NavItem | NavSection>): NavItem[] {
  const out: NavItem[] = [];
  for (const e of entries) {
    if (isNavItem(e)) out.push(e);
    else if (!e.label) out.push(...collectUnlabelledLeaves(e.items));
  }
  return out;
}

// The icon rail shows only the agent menu's icons: the "Agent" role group when
// the user has several roles, otherwise the top-level loose items of their nav.
function railItems(sections: NavSection[]): NavItem[] {
  const agent = sections.find((s) => s.id === "role-agent" || s.id === "main");
  if (agent) {
    const items = collectUnlabelledLeaves(agent.items);
    if (items.length > 0) return items;
  }
  const loose = sections.filter((s) => !s.label).flatMap((s) => collectUnlabelledLeaves(s.items));
  if (loose.length > 0) return loose;
  return sections[0] ? collectUnlabelledLeaves(sections[0].items) : [];
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
        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition bg-transparent text-white/70 hover:bg-white/10 hover:text-white"
        data-testid={`nav-section-${section.id}`}
      >
        <div className="flex items-center gap-3">
          {SectionIcon ? (
            <SectionIcon className="h-4.5 w-4.5 shrink-0 text-[#8FA0B5]" strokeWidth={1.75} aria-hidden />
          ) : null}
          <span className="text-sm font-semibold">{section.label}</span>
        </div>
        <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight className="h-4 w-4 text-white/30" />
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
  // Org branding disabled while the Travana logo is forced (see brand block below).
  // const { data: currentOrganization } = useCurrentOrganization();
  const { data: hubUnreadNotifs } = useUnreadNotifications(currentUser?.id || "");
  const hubUnreadCount = useMemo(() => {
    if (!hubUnreadNotifs || !Array.isArray(hubUnreadNotifs)) return 0;
    return hubUnreadNotifs.filter((n: any) =>
      n.type === "hub_post" || n.type === "hub_like" || n.type === "hub_share" || n.type === "hub_mention"
    ).length;
  }, [hubUnreadNotifs]);

  // Count of open tickets the current agent is on, shown as a badge on the
  // "Tickets" nav item. countMyActiveTickets is the same predicate the tickets
  // page applies for its default "Me / Active" view, so this number and that
  // list can't disagree — see features/tickets/lib/ticket-filters.
  //
  // The endpoint returns `assignedTo = me OR userId = me`, which is exactly the
  // superset the predicate narrows, so counting here matches counting the page's
  // org-wide fetch.
  const { data: assignedTickets } = useTicketsByUser(currentUser?.id || "");
  const ticketCount = useMemo(
    () => countMyActiveTickets(assignedTickets, currentUser?.id),
    [assignedTickets, currentUser?.id],
  );
  // Conversations awaiting a reply, shown as a badge on the "Inbox" nav
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
        "flex flex-col bg-[#2E3D50]",
        // The rail spans the full viewport height, from the logo at its top to
        // the bottom. `sticky` (not `fixed`): the aside still needs to occupy
        // width in the flex row, and sticky travels within it without being
        // taken out of flow.
        sticky ? "sticky top-0 h-screen" : "h-full",
        collapsed ? "items-center px-2 pb-3" : "px-3 pb-3"
      )}
    >
      {/* Brand — sits at the top of the rail, in line with the header bar
          beside it (same h-14 height so the two rows align). */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center",
          collapsed ? "justify-center" : "gap-3 px-1"
        )}
      >
        {/* Org-logo override disabled for now — always show the Travana logo.
        {currentOrganization?.logoUrl ? (
          <img
            src={currentOrganization.logoUrl}
            alt={currentOrganization.name || "Logo"}
            className={cn("w-auto object-contain", collapsed ? "h-8 max-w-[52px]" : "h-9 max-w-[180px]")}
            data-testid="img-brand-logo"
          />
        ) : ( ... )}
        */}
        <BrandMark />
        {!collapsed && (
          <span className="title-serif truncate text-sm font-semibold text-white" data-testid="text-brand-name">
            {currentUser?.orgName || "Travana"}
          </span>
        )}
      </div>

      {/* The one growing child, so a nav taller than the screen (org admin has
          the most sections) scrolls inside the panel rather than pushing the
          bottom controls out of view. min-h-0 is required — without it this
          flex child won't shrink below its content and the panel overflows. */}
      <nav
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overflow-x-hidden",
          collapsed ? "scrollbar-none flex flex-col items-center gap-1.5" : "space-y-1",
        )}
      >
        {collapsed
          ? railItems(sections).map((item) => (
              <ItemRow
                key={item.path + item.label}
                item={item}
                active={isActive(currentPath, currentSearch, item.path)}
                collapsed
                count={badgeCountFor(item, badgeCounts)}
              />
            ))
          : sections.map((section) => (
              <SectionBlock
                key={section.id}
                section={section}
                currentPath={currentPath}
                currentSearch={currentSearch}
                collapsed={false}
                expandedIds={expandedSections}
                onToggle={toggleSection}
                badgeCounts={badgeCounts}
              />
            ))}
      </nav>

      {/* Sits below the scrolling nav, so on a tall screen it rests at the
          bottom of the panel and stays reachable without scrolling. */}
      {!collapsed && (
        <>
          <div className="my-3 h-px shrink-0 bg-white/10" />
          <Link
            href="/hub"
            className="flex shrink-0 items-center justify-between rounded-xl px-3 py-2.5 text-left transition hover:bg-white/10 no-underline"
            data-testid="link-hub"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <Blocks className="h-4.5 w-4.5 text-[#8FA0B5]" strokeWidth={1.75} />
                {hubUnreadCount > 0 && (
                  <span
                    className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white shadow-sm"
                    data-testid="badge-hub-unread"
                  >
                    {hubUnreadCount > 99 ? "99+" : hubUnreadCount}
                  </span>
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-white/90" data-testid="text-support-title">TheHub</div>
                <div className="text-xs text-white/50" data-testid="text-support-sub">
                  Profile, News & Training
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-white/40" />
          </Link>
        </>
      )}

      {onToggleCollapsed && (
        <div className={cn("shrink-0 pt-2", collapsed ? "" : "flex justify-start")}>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="grid h-10 w-10 place-items-center rounded-lg border border-white/20 text-white/70 transition hover:bg-white/10 hover:text-white"
            title={collapsed ? "Expand sidebar" : "Minimise sidebar"}
            data-testid={collapsed ? "button-expand-sidebar" : "button-collapse-sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        </div>
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
        collapsed ? "w-16" : "w-[280px]"
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
          className="xl:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/85 transition hover:bg-white/10 hover:text-white"
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
          className="fixed inset-y-0 left-0 z-50 h-full w-[300px] sm:max-w-[300px] overflow-hidden bg-[#2E3D50] transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
        >
          <SidenavInner collapsed={false} sticky={false} />
        </SheetPrimitive.Content>
      </SheetPortal>
    </Sheet>
  );
}
