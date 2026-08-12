import type { SsWebhookEvent } from "./sendseven-webhook.types";

// Debounce for inbound customer messages.
//
// People text the way they talk: "Egypt for a week, cheap all inclusive" …
// "3 people" … "from Newcastle". Each lands as its own webhook, so answering
// every one produces a thread of near-duplicate replies — and each reply is
// written without the detail that arrived a second later.
//
// So a conversation's reply is held for a moment after its last message, and
// only the LATEST message is answered. The transcript the turn reads already
// contains the earlier ones, so nothing the customer said is lost — they are
// answered together, in one reply, the way a human agent would.
//
// Deliberately in-process (a Map + timers), matching the existing in-process
// holding pen for test-flow attachment bytes. The alternative — a queue or
// scheduler — is a lot of machinery for a few seconds of delay. The trade-off
// is honest: a process restart inside the debounce window drops that pending
// reply. The window is seconds, the customer's message is still in the inbox
// for an agent, and the supersede check in reply-worker remains as a second
// line of defence, so this is a better bargain than the duplicates.

// How long to wait after the customer's LAST message before replying. Long
// enough to catch a burst of quick follow-ups, short enough that a single
// message still feels like a prompt reply.
const DEBOUNCE_MS = 6_000;
// Never hold a reply longer than this in total, however long they keep typing —
// a customer writing message after message still gets an answer.
const MAX_WAIT_MS = 20_000;

interface PendingReply {
  timer: NodeJS.Timeout;
  // When this burst started — the cap is measured from here, not from the
  // latest message, so continuous typing can't defer a reply indefinitely.
  firstQueuedAt: number;
}

const pending = new Map<string, PendingReply>();

export type InboundRunner = (orgId: string, event: SsWebhookEvent) => Promise<void>;

/** Queue the AI's reply to an inbound message, replacing any reply still
 *  pending for the same conversation. Returns immediately — the run happens on
 *  a timer, and its failures are logged rather than thrown (nothing is waiting
 *  on them; the webhook was acked long before). */
export function scheduleInboundReply(
  orgId: string,
  conversationId: string,
  event: SsWebhookEvent,
  run: InboundRunner,
): void {
  const existing = pending.get(conversationId);
  const firstQueuedAt = existing?.firstQueuedAt ?? Date.now();
  if (existing) {
    clearTimeout(existing.timer);
    console.log(`[reply-debounce] conv ${conversationId} newer message arrived — replacing the pending reply`);
  }

  // Whatever is left of the cap, capped again by the per-message wait.
  const remainingOfCap = Math.max(0, MAX_WAIT_MS - (Date.now() - firstQueuedAt));
  const delay = Math.min(DEBOUNCE_MS, remainingOfCap);

  const timer = setTimeout(() => {
    pending.delete(conversationId);
    void run(orgId, event).catch((err) => {
      console.error(`[reply-debounce] conv ${conversationId} reply failed:`, err instanceof Error ? err.message : err);
    });
  }, delay);
  // Don't hold the process open purely for a pending reply.
  timer.unref?.();

  pending.set(conversationId, { timer, firstQueuedAt });
}

/** Test seam: drop every pending reply without running it. */
export function clearPendingReplies(): void {
  for (const { timer } of pending.values()) clearTimeout(timer);
  pending.clear();
}

export const REPLY_DEBOUNCE_MS = DEBOUNCE_MS;
export const REPLY_DEBOUNCE_MAX_WAIT_MS = MAX_WAIT_MS;
