import { useCallback, useEffect, useRef, useState } from "react";
import type { ComposerDraft, ComposerHandle } from "../composer";
import { appendQuestion } from "./append-question";

/** Green "Enquiry created from this chat" bar shown above the composer. */
export interface CreatedEnquiryBar {
  title: string;
  href: string;
}

export const EMPTY_DRAFT: ComposerDraft = { tab: "reply", reply: "", note: "" };

/**
 * Unsent composer content per conversation, the "Draft" list tags, and the
 * enquiry-created bar. The composer owns its live textarea state and reports
 * changes (debounced) through handleDraftChange; the ref is the source of
 * truth so drafts survive thread switches without re-rendering the inbox per
 * keystroke. Session-scoped: not kept across reloads.
 */
export function useInboxDrafts(selectedId: string | null) {
  const draftsRef = useRef<Record<string, ComposerDraft>>({});
  // Conversation id → the draft text shown as a "Draft" tag in the list. It only
  // flips on two rare events: a tag appears when the user navigates away from a
  // thread with unsent text, and retires when they resume typing in it or the
  // draft empties out.
  const [draftTags, setDraftTags] = useState<Record<string, string>>({});
  // Set by the mounted composer, so text can be pushed in without remounting it.
  const composerRef = useRef<ComposerHandle | null>(null);

  // Tag the thread the user just left if they walked away mid-sentence. Done on
  // the way out rather than while typing so the open thread never labels itself.
  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    const left = prevSelectedRef.current;
    prevSelectedRef.current = selectedId;
    if (!left || left === selectedId) return;
    const d = draftsRef.current[left];
    const text = d ? d.reply || d.note : "";
    if (!text) return;
    setDraftTags((tags) => (tags[left] === text ? tags : { ...tags, [left]: text }));
  }, [selectedId]);

  // Record the draft and retire the tag once the user picks the thread back up.
  const handleDraftChange = useCallback((conversationId: string, draft: ComposerDraft) => {
    // An empty draft in a non-default mode (e.g. Internal note) is still worth keeping.
    if (draft.reply || draft.note || draft.tab !== "reply") draftsRef.current[conversationId] = draft;
    else delete draftsRef.current[conversationId];

    // No inbox re-render per keystroke: this only changes state while a tag is showing.
    setDraftTags((tags) => {
      if (!(conversationId in tags)) return tags;
      const next = { ...tags };
      delete next[conversationId];
      return next;
    });
  }, []);

  const draftFor = (conversationId: string): ComposerDraft => draftsRef.current[conversationId] ?? EMPTY_DRAFT;

  // Conversation id -> enquiry created from it this session (drives the thread bar).
  const [createdEnquiries, setCreatedEnquiries] = useState<Record<string, CreatedEnquiryBar>>({});
  const markEnquiryCreated = useCallback((conversationId: string, bar: CreatedEnquiryBar) => {
    setCreatedEnquiries((prev) => ({ ...prev, [conversationId]: bar }));
  }, []);
  const dismissEnquiryBar = useCallback((conversationId: string) => {
    setCreatedEnquiries((prev) => {
      if (!(conversationId in prev)) return prev;
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
  }, []);

  /**
   * Puts a drafted question into the conversation's reply box and switches it
   * to Reply. The draft store is written first (so it survives if the composer
   * is not mounted), then the live composer is told, keeping attachments, the
   * Luna banner and any open sheet intact.
   */
  const askClient = useCallback(
    (conversationId: string, text: string) => {
      const current = draftsRef.current[conversationId] ?? EMPTY_DRAFT;
      const reply = appendQuestion(current.reply, text);
      handleDraftChange(conversationId, { tab: "reply", reply, note: current.note });
      composerRef.current?.setReplyText(reply);
    },
    [handleDraftChange],
  );

  return {
    draftTags, handleDraftChange, draftFor, composerRef,
    createdEnquiries, markEnquiryCreated, dismissEnquiryBar, askClient,
  };
}
