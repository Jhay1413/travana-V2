/**
 * What the "Message <agent>" sheet holds between screens. Every portal page mounts its own sheet provider, so a draft kept
 * in component state would vanish on each page change. It lives here instead, in a small module-level store:
 *  - the draft (extras, text, reply-by) and the subject the customer chose ("It's about"),
 *  - the bubbles this session has sent.
 * Kept per signed-in customer (and per sign-in: the key includes the end of the session token), and forgotten on sign-out
 * (`signOutPortal`) alongside the told-deals store. Nothing is written to storage: closing the tab forgets it.
 */
import { EMPTY_DRAFT, type MessageDraft } from "./message-sheet";

export interface SentBubble {
  about: string;
  extras: string;
  text: string;
  at: string;
}

export interface MessageSheetState {
  draft: MessageDraft;
  /** The chosen "It's about" key (`booking:<id>`, `quote:<id>`, `quote-token:<token>` or `other`), or null when none was chosen. */
  about: string | null;
  thread: readonly SentBubble[];
}

const EMPTY_STATE: MessageSheetState = { draft: EMPTY_DRAFT, about: null, thread: [] };

const byCustomer = new Map<string, MessageSheetState>();

/** The store key for the signed-in customer: their id plus the end of this session's token (a new sign-in is a new key). */
export function messageSheetKey(clientId: string | null, token: string | null): string {
  return `${clientId ?? ""}|${(token ?? "").slice(-24)}`;
}

const isEmpty = (s: MessageSheetState): boolean =>
  s.about === null && s.thread.length === 0 && s.draft.text === "" && s.draft.extras.length === 0 && s.draft.via === EMPTY_DRAFT.via;

export function loadMessageSheetState(key: string): MessageSheetState {
  return byCustomer.get(key) ?? EMPTY_STATE;
}

export function saveMessageSheetState(key: string, state: MessageSheetState): void {
  if (isEmpty(state)) byCustomer.delete(key);
  else byCustomer.set(key, state);
}

/** Forgets every customer's draft and sent bubbles (sign-out). */
export function clearMessageSheetStore(): void {
  byCustomer.clear();
}
