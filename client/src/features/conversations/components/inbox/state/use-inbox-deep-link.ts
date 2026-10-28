import { useCallback, useEffect, useRef, useState } from "react";
import { toUiConversation } from "../../../map";
import { useClientContactLink } from "../../../api/use-contact-link";
import { useConversation, useConversations } from "../../../api/use-conversations-queries";
import type { Conversation } from "../../../types";
import { parseInboxDeepLink, pickConversationToOpen, tabForConversation } from "../lib";
import type { InboxListTab } from "./derive-rows";

export interface InboxDeepLinkOptions {
  urlSearch: string;
  setTab: (tab: InboxListTab) => void;
  setSelectedId: (id: string | null) => void;
  /** Clears search, chips, filters and paging so the target is not hidden. */
  resetListView: () => void;
  openNewMessage: (clientId: string | null) => void;
  /** Drops `?client=` from the URL (used when there is nothing to open). */
  clearClientParam: () => void;
  /** The tab currently shown; a late by-id resolve must not override a user's change. */
  tab: InboxListTab;
}

/**
 * Resolves `?conversation=<id>` and `?client=<clientId>` into a selection.
 *
 * A conversation target is always fetched by id, so it opens even when it sits
 * beyond the first loaded page; the inbox tab is switched to the one it lives
 * in. A client target goes clientId -> contact link -> that contact's
 * conversations -> the most recent open one (else the most recent of any
 * status); a linked client with none opens the new-message dialog pre-filled.
 * A client with no contact link just lands on the plain inbox.
 */
export function useInboxDeepLink(opts: InboxDeepLinkOptions) {
  const { urlSearch, setTab, setSelectedId, resetListView, openNewMessage, clearClientParam, tab } = opts;
  const [targetId, setTargetId] = useState<string | null>(null);
  const [clientTarget, setClientTarget] = useState<string | null>(null);
  // The deep-linked conversation as fetched by id; stands in for the selection
  // when the list page does not contain it.
  const [resolved, setResolved] = useState<Conversation | null>(null);
  const appliedConversation = useRef<string | null>(null);
  const appliedClient = useRef<string | null>(null);
  const keepScope = useRef<string | null>(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  const startConversation = useCallback(
    (id: string) => {
      resetListView();
      setTab("open");
      setResolved(null);
      keepScope.current = null;
      setTargetId(id);
      setSelectedId(id);
    },
    [resetListView, setTab, setSelectedId],
  );

  useEffect(() => {
    const { conversationId, clientId } = parseInboxDeepLink(urlSearch);
    if (conversationId && conversationId !== appliedConversation.current) {
      appliedConversation.current = conversationId;
      startConversation(conversationId);
    }
    if (clientId && clientId !== appliedClient.current) {
      appliedClient.current = clientId;
      setClientTarget(clientId);
    }
  }, [urlSearch, startConversation]);

  const byId = useConversation(targetId);
  useEffect(() => {
    if (!targetId) return;
    if (byId.data && byId.data.id === targetId) {
      const ui = toUiConversation(byId.data);
      setResolved(ui);
      // startConversation put the inbox on "open"; any other tab now means the
      // user changed scope while the fetch was pending, so leave it alone.
      if (tabRef.current === "open") setTab(tabForConversation(ui, new Date()));
      setTargetId(null);
    } else if (byId.isError) {
      setTargetId(null);
    }
  }, [targetId, byId.data, byId.isError, setTab]);

  const link = useClientContactLink(clientTarget);
  const contactId = link.data?.contactId ?? null;
  const contactConversations = useConversations({ contactId: contactId ?? undefined, pageSize: 50 }, { enabled: !!contactId });
  useEffect(() => {
    if (!clientTarget) return;
    if (link.isError) {
      setClientTarget(null);
      return;
    }
    if (link.isSuccess && !contactId) {
      setClientTarget(null);
      clearClientParam();
      return;
    }
    if (!contactId) return;
    if (contactConversations.isError) {
      setClientTarget(null);
      return;
    }
    const data = contactConversations.data;
    if (!data || contactConversations.isPlaceholderData) return;
    setClientTarget(null);
    const pick = pickConversationToOpen(data.items.map(toUiConversation), new Date());
    if (pick) startConversation(pick.id);
    else openNewMessage(clientTarget);
  }, [clientTarget, link.isError, link.isSuccess, contactId, contactConversations.data, contactConversations.isError, contactConversations.isPlaceholderData, openNewMessage, clearClientParam, startConversation]);

  /**
   * True while the selection must not be replaced by the keeper: the target is
   * still being fetched, or it was fetched by id, is not on the current page,
   * and the list scope has not changed since.
   */
  const holdSelection = useCallback(
    (selectedId: string | null, scopeKey: string, inRows: boolean): boolean => {
      if (targetId) return true;
      if (!resolved || resolved.id !== selectedId || inRows) return false;
      if (keepScope.current === null) keepScope.current = scopeKey;
      return keepScope.current === scopeKey;
    },
    [targetId, resolved],
  );

  return { resolved, holdSelection };
}
