import crypto from "node:crypto";
import { AppError } from "../../utils/error-handler";
import { hasAnyRole, type Scope } from "../../utils/scope";
import { runWithSendSevenConfigAsync } from "../../utils/sendseven";
import { conversationIntegrationService } from "../conversation-integration/conversation-integration.service";
import { conversationsRepository } from "../conversations/conversations.repository";
import { messagesRepository } from "../messages/messages.repository";
import { neonClientService } from "../neon-client/neon-client.service";
import { conversationStateRepository } from "../sendseven-webhook/conversation-state.repository";
import { clientDisplayName, systemScope } from "../sendseven-webhook/identity.service";
import { createNewTestClient, resolveOrCreateTestClient } from "./internal-chat-identity.service";
import { internalChatRepository } from "./internal-chat.repository";
import type { SsMessage } from "../messages/messages.types";

// Forks a REAL SendSeven conversation into a test_flow session, so staff can
// preview "what would the AI reply next here?" by continuing the conversation
// AS the client — without anything ever reaching the real customer or the
// real conversation's state.
//
// Fidelity vs safety, in one place:
// - The transcript is copied using the SAME window the real reply worker
//   feeds the AI (messages since the conversation's state row began, capped) —
//   so the forked AI sees what the real AI would see.
// - The enquiry state (status + slots) and the SAFE subset of the rolling
//   context are copied, so mid-enquiry conversations resume mid-enquiry.
// - The linked client is NEVER used directly: any enquiry/ticket the test
//   session creates must land on a synthetic record, so the fork clones the
//   client into a TEST-badged twin (same display name, synthetic phone). The
//   phone is synthetic PRECISELY so the real flow's phone-based identity
//   matching can never resolve a real customer onto the test twin. The cost:
//   the admin bot sees the twin's (empty) records, not the real client's.
// - needsHuman is deliberately NOT copied — a handed-off conversation is
//   exactly the one staff most want to probe ("what WOULD it say?"), so the
//   sandbox always answers; the live hand-off state is surfaced back to the
//   UI (realNeedsHuman) so the tester knows the real AI is currently silent.
// - context fields pointing at REAL records (enquiryId, enquiryOwnerUserId,
//   availabilityTaskId, beneficiary.clientId, pendingAttachmentRefs) are NOT
//   copied, so the test flow can never write to them (e.g. the
//   awaiting_availability step creating a callback task on the real enquiry).

const TEST_FLOW_ROLES = ["org_admin", "platform_admin"] as const;
// A page of recent history to seed — the test-flow driver itself only feeds
// its last 20 into the AI (its HISTORY_LIMIT), same as the real worker.
const SEED_HISTORY_LIMIT = 30;
// Context keys safe to carry into the sandbox: flow flags and accumulated
// text only — never ids of real records (see the header comment).
const SAFE_CONTEXT_KEYS = [
  "lastReply",
  "groupedAskSent",
  "askCount",
  "domain",
  "ticketOpened",
  "adminAsked",
  "adminActionable",
  "holidayImageInfo",
  "onBehalfOfName",
] as const;

// Deterministic synthetic UK-looking phone for the TEST twin, derived from the
// conversation id — stable so re-forking the same conversation reuses the same
// twin (resolveOrCreateTestClient is a name-aware find-or-create on it).
function syntheticPhone(conversationId: string): string {
  const hex = crypto.createHash("sha1").update(conversationId).digest("hex");
  const digits = (BigInt(`0x${hex.slice(0, 12)}`) % 1_000_000_000n).toString().padStart(9, "0");
  return `07${digits}`;
}

export interface ForkSessionResult {
  sessionId: string;
  seededMessages: number;
  // Whether the LIVE conversation is currently handed off to a human — the
  // sandbox ignores it (see header comment), but the tester should know the
  // real AI would stay silent right now.
  realNeedsHuman: boolean;
}

export async function forkSessionFromConversation(scope: Scope, conversationId: string): Promise<ForkSessionResult> {
  if (!hasAnyRole(scope.orgRoles, [...TEST_FLOW_ROLES])) {
    throw new AppError("Only an org admin can start a test flow session", 403);
  }
  const orgId = scope.orgId;
  const cfg = await conversationIntegrationService.resolveConfig(orgId);
  if (!cfg) {
    throw new AppError("Connect this org's SendSeven workspace before testing a conversation", 400);
  }

  // The state row (if any) is org-stamped — reject a cross-org id outright.
  // A conversation with no state row yet is still forkable: the message fetch
  // below runs against THIS org's SendSeven workspace, so a foreign id just
  // comes back empty/404 there.
  const state = await conversationStateRepository.find(conversationId);
  if (state && state.orgId !== orgId) throw new AppError("Conversation not found", 404);

  let items: SsMessage[];
  // The conversation's SendSeven contact name — seeded into the session
  // context so the sandbox AI can address the customer by name even with no
  // CRM link (mirrors the real reply worker, which reads it off each webhook
  // event). Best-effort: a failed conversation fetch never blocks the fork.
  let contactName: string | null = null;
  try {
    const [list, conv] = await runWithSendSevenConfigAsync(cfg, () =>
      Promise.all([
        messagesRepository.list({ conversationId, page: 1, pageSize: SEED_HISTORY_LIMIT }),
        conversationsRepository.getById(conversationId).catch(() => null),
      ]),
    );
    items = Array.isArray(list.items) ? list.items : [];
    const rawName = (conv?.contact as { name?: unknown } | null | undefined)?.name;
    contactName = typeof rawName === "string" && rawName.trim() ? rawName.trim() : null;
  } catch (err) {
    console.error(`[internal-chat-fork] conv ${conversationId} message fetch failed:`, err instanceof Error ? err.message : err);
    throw new AppError("Conversation not found", 404);
  }

  // Mirror the reply worker's session window: only messages since our state
  // row began (60s skew buffer), so the fork sees what the real AI would see.
  // Internal notes (drafts, hand-off markers) and empty/attachment-only
  // messages are excluded — the transcript keeps real text only.
  const since = state?.createdAt ? new Date(state.createdAt).getTime() - 60_000 : 0;
  const seedable = items
    .filter((m) => !m.is_internal && m.text?.trim())
    .filter((m) => !m.created_at || new Date(m.created_at).getTime() >= since)
    .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));

  // Clone the linked client into a TEST twin (or run as an unknown contact
  // when there's no linked client / the clone fails — the sandbox then
  // exercises the onboarding gate, which is also representative).
  let cloneClientId: string | null = null;
  if (state?.clientId) {
    const real = await neonClientService.getNeonClientById(state.clientId, systemScope(orgId)).catch(() => null);
    if (real) {
      const fullName = clientDisplayName(real) || "Test Client";
      const phone = syntheticPhone(conversationId);
      try {
        const resolution = await resolveOrCreateTestClient(orgId, scope.userId, { fullName, phone });
        cloneClientId =
          resolution.status === "phone_conflict"
            ? await createNewTestClient(orgId, scope.userId, { fullName, phone })
            : resolution.clientId;
      } catch (err) {
        console.error(`[internal-chat-fork] conv ${conversationId} test-twin clone failed (continuing as unknown contact):`, err);
      }
    }
  }

  const session = await internalChatRepository.createSession({
    orgId,
    userId: scope.userId,
    mode: "test_flow",
    isTest: true,
  });

  const srcContext = (state?.context ?? null) as Record<string, unknown> | null;
  const seededContext: Record<string, unknown> = {};
  if (srcContext) {
    for (const key of SAFE_CONTEXT_KEYS) {
      if (srcContext[key] !== undefined) seededContext[key] = srcContext[key];
    }
  }
  if (contactName) seededContext.contactName = contactName;
  await internalChatRepository.updateSession(session.id, orgId, {
    clientId: cloneClientId,
    // enquiryId is deliberately NOT copied: without it, the sandbox's
    // awaiting_availability step confirms but skips the (real-record)
    // callback-task write — same reply, no side effect.
    enquiryStatus: state?.enquiryStatus ?? null,
    enquirySlots: state?.enquirySlots ?? null,
    context: Object.keys(seededContext).length ? seededContext : null,
  });

  // Seed the transcript with original timestamps so order (and the driver's
  // recency window) match reality. Sequential inserts keep insertion order as
  // a tiebreaker for same-ms rows.
  for (const m of seedable) {
    await internalChatRepository.createMessage({
      sessionId: session.id,
      role: m.direction === "outbound" ? "assistant" : "user",
      content: m.text!.trim(),
      createdAt: m.created_at ? new Date(m.created_at) : undefined,
    });
  }
  // Provenance marker — system_note is excluded from the AI transcript by the
  // test-flow driver and hidden by the chat UI, but keeps the DB row
  // self-describing.
  await internalChatRepository.createMessage({
    sessionId: session.id,
    role: "system_note",
    content: `Forked from SendSeven conversation ${conversationId} for AI testing (${seedable.length} messages seeded).`,
  });

  console.log(
    `[internal-chat-fork] conv ${conversationId} → test session ${session.id} ` +
      `(org ${orgId}, ${seedable.length} messages, clone=${cloneClientId ?? "none"}, status=${state?.enquiryStatus ?? "none"}, realNeedsHuman=${!!state?.needsHuman})`,
  );
  return { sessionId: session.id, seededMessages: seedable.length, realNeedsHuman: !!state?.needsHuman };
}
