import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { useRole } from "@/hooks/use-role";
import { useCurrentUser, useUsers } from "@/hooks/queries";
import { toUiConversation } from "../../../map";
import {
  conversationsKeys,
  unreadBadgeCount,
  useConversationBadgeCounts,
  useConversations,
} from "../../../api/use-conversations-queries";
import { useInboxes } from "../../../api/use-inboxes";
import type { Conversation, ConversationMessage, ConversationTag } from "../../../types";
import {
  EMPTY_FILTERS,
  channelCounts,
  readSortPreference,
  rowStatus,
  serverParamsFor,
  writeSortPreference,
  type InboxFilters,
  type QuickChip,
  type SortPreference,
} from "../lib";
import { useInboxDrafts } from "./use-inbox-drafts";
import { useInboxDeepLink } from "./use-inbox-deep-link";
import { deriveRows, isDone, mergeById, tabToQuery, type InboxListTab } from "./derive-rows";

// Client-side overlay for the interactions the messages/send endpoints don't
// cover yet (list-only scope): locally-sent replies and open/close toggles.
// Keyed by conversation id; merged onto the server data below.
export type Overlay = Record<string, { extraMessages: ConversationMessage[]; snoozed?: boolean }>;

const SEARCH_DEBOUNCE_MS = 250;
const NOW_TICK_MS = 60_000;

function readStoredSort(): SortPreference {
  try {
    const store = typeof window === "undefined" ? null : window.localStorage;
    return readSortPreference(store ?? { getItem: () => null });
  } catch {
    // Accessing localStorage can throw (blocked storage): fall back to defaults.
    return readSortPreference({ getItem: () => null });
  }
}


export function useInboxState() {
  const [tab, setTab] = useState<InboxListTab>("open");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [chip, setChip] = useState<QuickChip>("all");
  const [filters, setFilters] = useState<InboxFilters>(EMPTY_FILTERS);
  const [sort, setSortState] = useState<SortPreference>(readStoredSort);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedIdRaw] = useState<string | null>(null);
  // The list scope (tab/page/search/filters) in force when the selection was
  // last set; lets the keeper tell "the list changed under me" from "the server
  // dropped my row because opening it marked it read".
  const scopeKeyRef = useRef("");
  const selectionScopeRef = useRef("");
  const setSelectedId = useCallback((id: string | null) => {
    selectionScopeRef.current = scopeKeyRef.current;
    setSelectedIdRaw(id);
  }, []);
  const [overlay, setOverlay] = useState<Overlay>({});
  const [testAiOpen, setTestAiOpen] = useState(false);
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [clientPaneOpen, setClientPaneOpen] = useState(false);
  const [inboxId, setInboxId] = useState<string | null>(null); // null = All Messages
  const [forcedUnread, setForcedUnread] = useState<Set<string>>(() => new Set());
  const [now, setNow] = useState(() => new Date());
  // Conversation id → ISO timestamp of when the user last opened it. Clears the
  // unread dot locally the instant a conversation is opened, without waiting on
  // (or depending on) SendSeven accepting the mark-read PATCH.
  const [seenAt, setSeenAt] = useState<Record<string, string>>({});

  const [location, navigate] = useLocation();

  // Deep links: /conversations?conversation=<id> and ?client=<clientId> (see
  // use-inbox-deep-link.ts). Keyed on wouter's `useSearch`, applied once per
  // value, mirroring the ?holiday= convention in pages/client/index.tsx.
  const urlSearch = useSearch();
  const [newMessageClientId, setNewMessageClientId] = useState<string | null>(null);
  const resetListView = useCallback(() => {
    setChip("all");
    setSearch("");
    setDebouncedSearch("");
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }, []);
  const openNewMessage = useCallback((clientId: string | null) => {
    setNewMessageClientId(clientId);
    setNewMessageOpen(true);
  }, []);
  const deepLink = useInboxDeepLink({ urlSearch, setTab, setSelectedId, resetListView, openNewMessage, tab });
  const { holdSelection } = deepLink;

  // ?new=1 opens the new-message dialog once, then is stripped from the URL.
  useEffect(() => {
    const params = new URLSearchParams(urlSearch);
    if (params.get("new") !== "1") return;
    params.delete("new");
    setNewMessageOpen(true);
    const rest = params.toString();
    navigate(rest ? `${location}?${rest}` : location, { replace: true });
  }, [urlSearch, location, navigate]);

  const { orgRole } = useRole();
  // Same roles as the AI test-flow gate (server-enforced too).
  const canTestAi = orgRole === "org_admin" || orgRole === "platform_admin";

  const { data: currentUser } = useCurrentUser();
  const { data: staffData = [] } = useUsers();
  const staff = useMemo(() => staffData.map((u) => ({ id: u.id, name: u.name || u.email })), [staffData]);

  // Custom inboxes (saved views) from SendSeven drive the inbox switcher.
  const { data: inboxesData } = useInboxes();
  const inboxList = useMemo(
    () =>
      (inboxesData?.items ?? [])
        .filter((i) => i.is_active !== false)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [inboxesData],
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), NOW_TICK_MS);
    return () => clearInterval(t);
  }, []);

  const serverParams = serverParamsFor(filters, chip);
  const pageSize = sort.key === "latest" ? 25 : 50;
  const listQuery = {
    page,
    pageSize,
    inboxId: inboxId ?? undefined,
    search: debouncedSearch || undefined,
    ...serverParams,
  };
  const mainQuery = useConversations({ status: tabToQuery(tab), ...listQuery });
  // "Mark done" is a year-long snooze, which the server's `closed` status never
  // returns, so the Done tab also pulls the snoozed list and isDone() picks the
  // done ones out of it. Limitation: the two are paged independently, so a Done
  // page can hold fewer rows than the page size.
  const onDoneTab = tab === "done";
  const doneSnoozedQuery = useConversations({ status: "snoozed", ...listQuery }, { enabled: onDoneTab });
  const mainData = mainQuery.data;
  const extraData = doneSnoozedQuery.data;
  const data = useMemo(() => {
    if (!mainData || !onDoneTab || !extraData) return mainData;
    return {
      items: mergeById(mainData.items, extraData.items),
      pagination: {
        ...mainData.pagination,
        total_pages: Math.max(mainData.pagination.total_pages, extraData.pagination.total_pages),
        has_next: mainData.pagination.has_next || extraData.pagination.has_next,
      },
    };
  }, [mainData, extraData, onDoneTab]);
  const isLoading = mainQuery.isLoading || (onDoneTab && doneSnoozedQuery.isLoading);
  const isFetching = mainQuery.isFetching || (onDoneTab && doneSnoozedQuery.isFetching);
  const isError = mainQuery.isError || (onDoneTab && doneSnoozedQuery.isError);
  const refetchMain = mainQuery.refetch;
  const refetchDone = doneSnoozedQuery.refetch;
  const refetch = useCallback(
    () => Promise.all([refetchMain(), onDoneTab ? refetchDone() : Promise.resolve()]),
    [refetchMain, refetchDone, onDoneTab],
  );
  const { data: badges } = useConversationBadgeCounts();
  // Count of open conversations: same rule as the sidebar nav badge, see
  // unreadBadgeCount (the name is legacy; it now reflects `open_count`).
  const openCount = unreadBadgeCount(badges);
  const qc = useQueryClient();
  const pagination = data?.pagination;

  // Reset to the first page whenever the query's scope changes.
  useEffect(() => {
    setPage(1);
  }, [tab, inboxId, debouncedSearch, serverParams.assignedTo, serverParams.needsReply, pageSize]);

  // Server items → UI model, then merge the local overlay.
  const conversations = useMemo(() => {
    const base = (data?.items ?? []).map(toUiConversation);
    return base.map((c) => {
      const o = overlay[c.id];
      const merged = o
        ? {
            ...c,
            messages: [...c.messages, ...o.extraMessages],
            preview: o.extraMessages.length > 0 ? o.extraMessages[o.extraMessages.length - 1].body : c.preview,
            lastActivityAt: o.extraMessages.length > 0 ? o.extraMessages[o.extraMessages.length - 1].sentAt : c.lastActivityAt,
            unread: o.extraMessages.length > 0 ? false : c.unread,
            snoozed: o.snoozed ?? c.snoozed,
            // An optimistic unsnooze must also drop the stamp so the row leaves
            // the Snoozed tab before the refetch confirms it.
            snoozedUntil: o.snoozed === false ? null : c.snoozedUntil,
          }
        : c;
      // A conversation only renders as unread if it hasn't been seen since its
      // last activity: clears the dot instantly on open, and re-lights it if a
      // newer message arrives after the user viewed the thread.
      const seen = seenAt[merged.id];
      const unread = merged.unread && (!seen || Date.parse(merged.lastActivityAt) > Date.parse(seen));
      return { ...merged, unread };
    });
  }, [data, overlay, seenAt]);

  const rows = useMemo(
    () => deriveRows(conversations, { tab, filters, chip, sort, forcedUnread, now, selectedId }),
    [conversations, tab, filters, chip, sort, forcedUnread, now, selectedId],
  );

  scopeKeyRef.current = JSON.stringify([tab, inboxId, debouncedSearch, page, chip, filters, pageSize]);

  const activeInbox = inboxId ? (inboxList.find((i) => i.id === inboxId) ?? null) : null;
  // Keep a valid selection: if the current pick fell out of the list, select the
  // first. Skipped while the first page is still loading (`rows` is briefly
  // empty then) and while a deep-linked conversation is being fetched or held
  // (it may sit beyond the loaded page, see use-inbox-deep-link.ts).
  useEffect(() => {
    if (holdSelection(selectedId, scopeKeyRef.current, rows.some((c) => c.id === selectedId))) return;
    if (isLoading) return;
    if (rows.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (selectedId === null) {
      setSelectedId(rows[0].id);
      return;
    }
    if (rows.some((c) => c.id === selectedId)) return;
    // The pick fell out of the rows. Opening a conversation marks it read, so a
    // server-side filter (e.g. Needs reply) can drop it from the page on the next
    // refetch; replacing the selection then would auto-open, and so mark read,
    // the next row, cascading down the list. Only move on when the row is still
    // on the page but off this tab/filters (e.g. just snoozed), or the list
    // scope itself changed.
    const stillOnPage = conversations.some((c) => c.id === selectedId);
    if (stillOnPage || selectionScopeRef.current !== scopeKeyRef.current) setSelectedId(rows[0].id);
  }, [rows, conversations, selectedId, isLoading, holdSelection, setSelectedId]);

  // Last known object for the selection, so the thread stays on screen if the
  // server drops the row from the current page (see the keeper above).
  const selectedCache = useRef<Conversation | null>(null);
  const selectedRaw = useMemo(() => {
    const found =
      conversations.find((c) => c.id === selectedId) ??
      (deepLink.resolved && deepLink.resolved.id === selectedId ? deepLink.resolved : null);
    if (found) selectedCache.current = found;
    return found ?? (selectedId && selectedCache.current?.id === selectedId ? selectedCache.current : null);
  }, [conversations, selectedId, deepLink.resolved]);
  // While a deep link is still opening, show a loading thread instead of
  // whatever happens to be selected (the previous or the latest conversation).
  // A conversation target that is already selected may show straight away.
  const { pending } = deepLink;
  const threadLoading = pending.client || (pending.conversationId !== null && selectedRaw?.id !== pending.conversationId);
  const selected = threadLoading ? null : selectedRaw;

  // Selecting a conversation again retires its local "Mark as unread".
  useEffect(() => {
    if (!selectedId) return;
    setForcedUnread((prev) => {
      if (!prev.has(selectedId)) return prev;
      const next = new Set(prev);
      next.delete(selectedId);
      return next;
    });
  }, [selectedId]);

  const drafts = useInboxDrafts(selectedId);

  const markSeen = useCallback((id: string) => {
    setSeenAt((prev) => ({ ...prev, [id]: new Date().toISOString() }));
  }, []);

  const markUnread = useCallback((id: string) => {
    setForcedUnread((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const setSort = useCallback((pref: SortPreference) => {
    setSortState(pref);
    try {
      if (typeof window !== "undefined") writeSortPreference(window.localStorage, pref);
    } catch {
      // localStorage blocked: the preference just is not persisted.
    }
  }, []);

  const clearOptimistic = (convId: string) =>
    setOverlay((prev) => {
      const cur = prev[convId];
      if (!cur) return prev;
      return { ...prev, [convId]: { ...cur, extraMessages: [] } };
    });

  // Drop the optimistic snoozed override so server data rules again. Leaving it
  // in place would keep overriding every future refetch, e.g. hiding from Open
  // a conversation the provider already reopened because the client replied
  // (reopen_on_message), until a full page reload wiped the state.
  const clearSnoozeOverride = (convId: string) =>
    setOverlay((prev) => {
      const cur = prev[convId];
      if (!cur || cur.snoozed === undefined) return prev;
      return { ...prev, [convId]: { extraMessages: cur.extraMessages } };
    });

  // Await the refetch before clearing so the row doesn't flash back into the
  // old tab in the gap between mutation success and fresh list data. On error,
  // clear immediately: that reverts the optimistic move.
  const settleSnoozeOverride = (convId: string) => ({
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: conversationsKeys.all });
      clearSnoozeOverride(convId);
    },
    onError: () => clearSnoozeOverride(convId),
  });

  // Counts. Unread is the server's unanswered total; needs-reply and "mine"
  // can only be counted on the loaded page. "Mine" compares display names
  // because the UI conversation model carries the assignee's name, not its id.
  const myName = staff.find((s) => s.id === currentUser?.id)?.name ?? currentUser?.name ?? "";
  const chipCounts = {
    unread: badges?.total_unanswered ?? 0,
    needsReply: rows.filter((c) => {
      const kind = rowStatus(c, now).kind;
      return kind === "needs_reply" || kind === "overdue";
    }).length,
    mine: myName ? rows.filter((c) => c.assignee === myName).length : 0,
  };
  // The server's snoozed count includes "Mark done" year-long snoozes. We can
  // only subtract the done ones on the loaded snoozed page, so the badge is
  // still slightly high when done-snoozes sit on other pages or other tabs.
  const snoozedCount =
    badges === undefined
      ? undefined
      : Math.max(0, badges.snoozed_count - (tab === "snoozed" ? conversations.filter((c) => c.snoozed && isDone(c, now)).length : 0));
  const channelCountsByType = useMemo(() => channelCounts(conversations), [conversations]);
  const unassignedCount = conversations.filter((c) => !c.assignee).length;
  const tagOptions = useMemo(() => {
    const byId = new Map<string, ConversationTag>();
    for (const c of conversations) for (const t of c.tags ?? []) byId.set(t.id, t);
    return [...byId.values()];
  }, [conversations]);

  return {
    tab, setTab, search, setSearch, chip, setChip, filters, setFilters, sort, setSort,
    page, setPage, pagination, isLoading, isFetching, isError, refetch,
    inboxId, setInboxId, inboxList, activeInbox,
    selectedId, setSelectedId, selected, threadLoading, rows, conversations, now,
    overlay, setOverlay, clearOptimistic, clearSnoozeOverride, settleSnoozeOverride,
    seenAt, markSeen, forcedUnread, markUnread,
    ...drafts,
    testAiOpen, setTestAiOpen,
    newMessageOpen, setNewMessageOpen, newMessageClientId, setNewMessageClientId, clientPaneOpen, setClientPaneOpen,
    canTestAi, openCount, snoozedCount, badges,
    currentUser: currentUser ? { id: currentUser.id, name: myName || currentUser.name } : null,
    staff, chipCounts, channelCounts: channelCountsByType, unassignedCount, tagOptions,
  };
}

export type InboxState = ReturnType<typeof useInboxState>;
