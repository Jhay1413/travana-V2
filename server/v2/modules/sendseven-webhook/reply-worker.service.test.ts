import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Module mocks ────────────────────────────────────────────────────────────
// handleInbound() orchestrates a lot of modules — mock every direct dependency
// with a minimal, controllable stand-in (same approach as identity.service.test.ts)
// so the tests below exercise the driver's OWN control flow (claims, reuse of
// the onboarding turn) rather than any of their internals.

vi.mock("../../utils/sendseven", () => ({
  runWithSendSevenConfigAsync: vi.fn((_config: unknown, fn: () => Promise<unknown>) => fn()),
}));

vi.mock("../../realtime/realtime.service", () => ({
  realtimeService: { publish: vi.fn() },
}));

vi.mock("../ai-embeddings/ai-embeddings.service", () => ({
  aiEmbeddingsService: { retrieve: vi.fn(async () => []) },
}));

vi.mock("../ai-conversation/ai-conversation.brain", () => ({
  buildEnquirySummary: vi.fn(() => "summary"),
  buildTranscript: vi.fn((_messages: unknown, latest: string) => `Customer: ${latest}`),
  decideDeterministicRoute: vi.fn(() => "classify"),
  // Mirrors the real fail-safe: no triage → document.
  effectiveAttachmentKind: vi.fn((kind: unknown) => kind ?? "document"),
  generateDocumentReceivedAsk: vi.fn(async () => "Got the file — can I grab your name and phone number so I can log it?"),
  triageImageAttachments: vi.fn(async () => null),
  generateBeneficiaryAsk: vi.fn(async () => "Who's this for, and what's their number?"),
  generateGeneralReply: vi.fn(async () => "Happy to help!"),
  generateTransitionReply: vi.fn(async () => "Great, when suits a callback?"),
  generateTurn: vi.fn(),
  hasSubstantiveSignal: vi.fn(() => false),
  inferHolidayTypeFromText: vi.fn(() => null),
  isAcknowledgement: vi.fn(() => false),
  kbExceedsBudget: vi.fn(() => false),
  looksLikeActionableAdmin: vi.fn(() => false),
  looksLikeAdminAsk: vi.fn(() => false),
  mergeSlots: vi.fn((prior: Record<string, unknown>, next: Record<string, unknown>) => ({ ...prior, ...next })),
  missingCoreFieldsFor: vi.fn(() => []),
  missingFieldsFor: vi.fn(() => []),
  parseAvailabilityTime: vi.fn(async () => new Date("2026-08-01")),
  shouldCreateEnquiryNow: vi.fn(() => false),
  shouldForceTicketNow: vi.fn(() => false),
  similarReply: vi.fn(() => false),
}));

vi.mock("../ai-conversation/conversation-router", () => ({
  classifyConversationRoute: vi.fn(async () => "general"),
}));

vi.mock("../bot-config/bot-config.repository", () => ({
  botConfigRepository: { findByOrg: vi.fn(async () => null) },
}));

vi.mock("../conversation-integration/conversation-integration.repository", () => ({
  conversationIntegrationRepository: { findByOrg: vi.fn(async () => ({ autoReplyMode: "draft" })) },
}));

vi.mock("../conversation-integration/conversation-integration.service", () => ({
  conversationIntegrationService: { resolveConfig: vi.fn(async () => ({ baseUrl: "https://example.com", token: "tok" })) },
}));

vi.mock("../knowledge-base/knowledge-base.repository", () => ({
  knowledgeBaseRepository: { list: vi.fn(async () => []) },
}));

vi.mock("../messages/messages.repository", () => ({
  messagesRepository: {
    list: vi.fn(async () => ({ items: [] })),
    send: vi.fn(async () => ({ id: "sent-1" })),
    createInternalNote: vi.fn(async () => ({ id: "note-1" })),
    downloadAttachment: vi.fn(async () => ({ buffer: Buffer.from("") })),
  },
}));

vi.mock("../neon-client/neon-client.service", () => ({
  // Default: the linked client IS opted in to AI auto-reply — the gate is
  // default-OFF, so most driver tests need an opted-in client to proceed.
  neonClientService: { getNeonClientById: vi.fn(async () => ({ id: "known-client-1", aiReplyEnabled: true })) },
}));

vi.mock("./conversation-state.repository", () => ({
  conversationStateRepository: {
    find: vi.fn(async () => null),
    ensure: vi.fn(),
    update: vi.fn(async () => undefined),
    setNeedsHuman: vi.fn(async () => undefined),
    claimStatusTransition: vi.fn(async () => true),
  },
}));

vi.mock("./sendseven-webhook.repository", () => ({
  sendsevenWebhookRepository: {
    markOurMessage: vi.fn(async () => undefined),
    claimAdminTurn: vi.fn(async () => true),
    releaseAdminTurnClaim: vi.fn(async () => undefined),
    claimReplyTurn: vi.fn(async () => true),
    releaseReplyTurnClaim: vi.fn(async () => undefined),
  },
}));

vi.mock("./enquiry-auto-create.service", () => ({
  resolveAndCreateEnquiry: vi.fn(async () => ({ enquiryId: "enq-1", ownerUserId: "user-1" })),
}));

vi.mock("../conversations/conversations.repository", () => ({
  conversationsRepository: { getById: vi.fn(async () => ({ id: "conv-1", created_at: "2026-08-05T00:00:00Z" })) },
}));

vi.mock("./identity.service", () => ({
  extractPhoneNumber: vi.fn(() => null),
  resolveClientForOnboarding: vi.fn(async () => ({ status: "resolved", clientId: "new-client-id" })),
  // Default: no number in the transcript to recover an identity from.
  resolveClientFromTranscript: vi.fn(async () => null),
  resolveExistingClient: vi.fn(async () => null),
  resolveOrCreateByDetails: vi.fn(async () => ({ status: "resolved", clientId: "new-client-id" })),
  systemScope: vi.fn((orgId: string) => ({ orgId, branchId: null, orgRole: "org_admin", orgRoles: ["org_admin"], userId: null })),
}));

vi.mock("../task/task.service", () => ({
  taskService: { create: vi.fn(async () => ({ id: "task-1" })) },
}));

vi.mock("./admin-agent.service", () => ({
  adminAgent: { answer: vi.fn(async () => null) },
}));

import { cleanTravellerName, replyWorker } from "./reply-worker.service";
import { conversationsRepository } from "../conversations/conversations.repository";
import { decideDeterministicRoute, generateTurn } from "../ai-conversation/ai-conversation.brain";
import { classifyConversationRoute } from "../ai-conversation/conversation-router";
import { conversationStateRepository } from "./conversation-state.repository";
import { sendsevenWebhookRepository } from "./sendseven-webhook.repository";
import { conversationIntegrationRepository } from "../conversation-integration/conversation-integration.repository";
import { messagesRepository } from "../messages/messages.repository";
import { neonClientService } from "../neon-client/neon-client.service";
import { adminAgent } from "./admin-agent.service";
import type { SsWebhookEvent } from "./sendseven-webhook.types";
import type { SendsevenConversationState } from "@shared/schema";

// cleanTravellerName drops generic stand-ins the model may report as a
// traveller's name ("my friend", "your friend", "someone") so we never create
// a CRM client literally called "friend" — we ask for a real name instead.
describe("cleanTravellerName", () => {
  it("rejects generic references with an optional determiner", () => {
    expect(cleanTravellerName("my friend")).toBeUndefined();
    expect(cleanTravellerName("your friend")).toBeUndefined();
    expect(cleanTravellerName("the guy")).toBeUndefined();
    expect(cleanTravellerName("a mate")).toBeUndefined();
    expect(cleanTravellerName("his colleague")).toBeUndefined();
    expect(cleanTravellerName("their partner")).toBeUndefined();
    expect(cleanTravellerName("someone")).toBeUndefined();
    expect(cleanTravellerName("somebody")).toBeUndefined();
    expect(cleanTravellerName("client")).toBeUndefined();
    expect(cleanTravellerName("other half")).toBeUndefined();
    expect(cleanTravellerName("co-worker")).toBeUndefined();
    expect(cleanTravellerName("coworker")).toBeUndefined();
  });

  it("is case-insensitive and trims surrounding whitespace", () => {
    expect(cleanTravellerName("  My Friend  ")).toBeUndefined();
    expect(cleanTravellerName("YOUR FRIEND")).toBeUndefined();
    expect(cleanTravellerName("The Guy")).toBeUndefined();
  });

  it("accepts real names", () => {
    expect(cleanTravellerName("James")).toBe("James");
    expect(cleanTravellerName("James Bond")).toBe("James Bond");
    expect(cleanTravellerName("  Maria Santos  ")).toBe("Maria Santos");
  });

  it("does not reject a real name that merely contains a generic word as part of a longer phrase", () => {
    // Only an EXACT generic phrase (with an optional single determiner) is
    // rejected — a name that happens to contain "friend" mid-string is not.
    expect(cleanTravellerName("Friendly Smith")).toBe("Friendly Smith");
    expect(cleanTravellerName("my best friend James")).toBe("my best friend James");
  });

  it("treats undefined/empty/whitespace-only input as absent", () => {
    expect(cleanTravellerName(undefined)).toBeUndefined();
    expect(cleanTravellerName("")).toBeUndefined();
    expect(cleanTravellerName("   ")).toBeUndefined();
  });
});

// ── handleInbound reliability fixes ─────────────────────────────────────────

const ORG_ID = "org-1";

function makeEvent(overrides: Partial<NonNullable<SsWebhookEvent["data"]>["message"]> = {}): SsWebhookEvent {
  return {
    id: "evt-1",
    data: {
      message: {
        id: "msg-1",
        conversation_id: "conv-1",
        channel_id: "chan-1",
        contact_id: "contact-1",
        direction: "inbound",
        message_type: "text",
        text: "hello there",
        ...overrides,
      },
      contact: { id: "contact-1", name: "Some Contact", phone: "07123456789", email: null },
    },
  };
}

function makeState(overrides: Partial<SendsevenConversationState> = {}): SendsevenConversationState {
  return {
    conversationId: "conv-1",
    orgId: ORG_ID,
    contactId: "contact-1",
    clientId: "known-client-1",
    intent: null,
    enquirySlots: null,
    enquiryStatus: null,
    enquiryId: null,
    needsHuman: false,
    handledByHumanAt: null,
    aiOverride: null,
    context: null,
    lastAiReplyAt: null,
    createdAt: new Date("2026-07-20T00:00:00Z"),
    updatedAt: new Date("2026-07-20T00:00:00Z"),
    ...overrides,
  } as SendsevenConversationState;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(conversationStateRepository.find).mockResolvedValue(null);
  vi.mocked(conversationStateRepository.ensure).mockResolvedValue(makeState());
  vi.mocked(conversationStateRepository.update).mockResolvedValue(undefined);
  vi.mocked(conversationStateRepository.claimStatusTransition).mockResolvedValue(true);
  vi.mocked(classifyConversationRoute).mockResolvedValue("general");
  // clearAllMocks keeps implementations — reset mocks that earlier tests
  // replace (the redelivery tests' claimed-set closure, the send-mode
  // override) so they can't leak into later tests.
  vi.mocked(sendsevenWebhookRepository.claimReplyTurn).mockResolvedValue(true);
  vi.mocked(sendsevenWebhookRepository.claimAdminTurn).mockResolvedValue(true);
  vi.mocked(neonClientService.getNeonClientById).mockResolvedValue({ id: "known-client-1", aiReplyEnabled: true } as never);
  vi.mocked(conversationIntegrationRepository.findByOrg).mockResolvedValue({ autoReplyMode: "draft" } as never);
});

describe("handleInbound — general-route reply claim (Fix 1a)", () => {
  it("sends no second reply when the same message is redelivered under a different event_id", async () => {
    // Simulate the real idempotency-table mechanism: the claim is won once per
    // eventId (here namespaced on the message id) and lost on every later call
    // for the same key — exactly like the DB's onConflictDoNothing.
    const claimed = new Set<string>();
    vi.mocked(sendsevenWebhookRepository.claimReplyTurn).mockImplementation(async (messageId: string) => {
      const key = `reply-turn:${messageId}`;
      if (claimed.has(key)) return false;
      claimed.add(key);
      return true;
    });

    const event = makeEvent();

    // First delivery.
    await replyWorker.handleInbound(ORG_ID, event);
    // Redelivery of the SAME message (SendSeven can resend under a different
    // event_id — the driver only sees the message id here, matching the claim
    // key it uses).
    await replyWorker.handleInbound(ORG_ID, event);

    expect(sendsevenWebhookRepository.claimReplyTurn).toHaveBeenCalledTimes(2);
    // draft mode (default mock) → the reply goes out as an internal note.
    expect(messagesRepository.createInternalNote).toHaveBeenCalledTimes(1);
    expect(messagesRepository.send).not.toHaveBeenCalled();
  });

  it("releases the claim when the send itself fails, so a redelivery can retry", async () => {
    const claimed = new Set<string>();
    vi.mocked(sendsevenWebhookRepository.claimReplyTurn).mockImplementation(async (messageId: string) => {
      const key = `reply-turn:${messageId}`;
      if (claimed.has(key)) return false;
      claimed.add(key);
      return true;
    });
    vi.mocked(sendsevenWebhookRepository.releaseReplyTurnClaim).mockImplementation(async (messageId: string) => {
      claimed.delete(`reply-turn:${messageId}`);
    });
    // send mode so sendReply actually calls messagesRepository.send (which we
    // fail on the first delivery only).
    const { conversationIntegrationRepository } = await import("../conversation-integration/conversation-integration.repository");
    vi.mocked(conversationIntegrationRepository.findByOrg).mockResolvedValue({ autoReplyMode: "send" } as never);
    vi.mocked(messagesRepository.send).mockRejectedValueOnce(new Error("SendSeven API down"));

    const event = makeEvent();

    // First delivery: the claim is won but the send throws.
    await expect(replyWorker.handleInbound(ORG_ID, event)).rejects.toThrow("SendSeven API down");
    expect(sendsevenWebhookRepository.releaseReplyTurnClaim).toHaveBeenCalledWith("msg-1");
    expect(claimed.has("reply-turn:msg-1")).toBe(false);

    // Redelivery: the claim is available again (released above) and the send
    // now succeeds — the customer message is NOT permanently unanswered.
    vi.mocked(messagesRepository.send).mockResolvedValue({ id: "sent-2" } as never);
    await replyWorker.handleInbound(ORG_ID, event);

    expect(messagesRepository.send).toHaveBeenCalledTimes(2);
  });
});

describe("handleInbound — single generateTurn call on new-lead onboarding (Fix 2)", () => {
  it("calls generateTurn exactly once when name+phone complete onboarding in the same message", async () => {
    vi.mocked(classifyConversationRoute).mockResolvedValue("sales");
    // Unknown contact: no prior state row, and the state ensure() returns a
    // row with no linked client yet.
    vi.mocked(conversationStateRepository.find).mockResolvedValue(null);
    vi.mocked(conversationStateRepository.ensure).mockResolvedValue(makeState({ clientId: null, aiOverride: "enabled" }));

    vi.mocked(generateTurn).mockResolvedValue({
      hand_off: false,
      intent: "enquiry",
      slots: {},
      client: { fullName: "John Smith", phone: "07123456789" },
      beneficiary: { onBehalf: false },
      reply: "Great, I can see you on the system — what can I help you with?",
    } as never);

    const event = makeEvent({ text: "Hi, I'm John Smith, 07123456789, looking for a cruise" });

    await replyWorker.handleInbound(ORG_ID, event);

    expect(generateTurn).toHaveBeenCalledTimes(1);
    // The single call is the onboarding call (client=null, knownClient=false).
    expect(vi.mocked(generateTurn).mock.calls[0][2]).toBeNull();
    expect(vi.mocked(generateTurn).mock.calls[0][6]).toBe(false);
  });
});

// ── Pre-onboarding attachment deferral ──────────────────────────────────────
// A document sent BEFORE the contact is identified can't be downloaded yet (no
// clientId), and the download step only reads the CURRENT message — so the
// onboarding gate stashes the attachment refs in the conversation context, and
// the turn that completes onboarding collects them into the admin/ticket flow.

const PASSPORT_ATTACHMENT = { id: "att-1", filename: "passport.jpg", content_type: "image/jpeg", file_size: 100 };
// Stored ref shape: kind comes from the stash turn's triage — the mocked
// triage returns null, so the fail-safe "document" default applies.
const STORED_PASSPORT_REF = { id: "att-1", filename: "passport.jpg", contentType: "image/jpeg", size: 100, kind: "document" };

describe("handleInbound — pre-onboarding attachment deferral", () => {
  it("turn 1 (unknown contact sends a photo): defers the attachment refs instead of downloading", async () => {
    // Attachments deterministically force the admin route (mirrors the real
    // decideDeterministicRoute).
    vi.mocked(decideDeterministicRoute).mockReturnValueOnce("admin" as never);
    vi.mocked(conversationStateRepository.ensure).mockResolvedValue(makeState({ clientId: null, aiOverride: "enabled" }));
    vi.mocked(messagesRepository.list).mockResolvedValue({
      items: [
        {
          id: "msg-1",
          direction: "inbound",
          text: "",
          created_at: "2026-07-20T00:01:00.000Z",
          attachments: [PASSPORT_ATTACHMENT],
        },
      ],
    } as never);
    // Onboarding turn: the bot asks for name+phone (none given yet).
    vi.mocked(generateTurn).mockResolvedValue({
      hand_off: false,
      intent: "other",
      slots: {},
      client: {},
      beneficiary: { onBehalf: false },
      reply: "Can I grab your name and phone number?",
    } as never);

    // A caption-less photo: no text, media message_type.
    await replyWorker.handleInbound(ORG_ID, makeEvent({ text: "", message_type: "image" }));

    // Bytes ARE downloaded on this turn (the pre-routing vision triage needs
    // them) but with no clientId nothing is ACTIONED: no admin turn, no
    // ticket — the refs are remembered in the persisted context instead
    // (alongside the admin domain carry-over).
    expect(adminAgent.answer).not.toHaveBeenCalled();
    const updates = vi.mocked(conversationStateRepository.update).mock.calls;
    const ctx = updates[updates.length - 1][1].context as {
      pendingAttachmentRefs?: unknown;
      domain?: string;
    };
    expect(ctx.pendingAttachmentRefs).toEqual([STORED_PASSPORT_REF]);
    expect(ctx.domain).toBe("admin");
  });

  it("turn 2 (onboarding completes): collects the deferred attachment into the admin flow and clears the marker", async () => {
    vi.mocked(decideDeterministicRoute).mockReturnValueOnce("admin" as never);
    vi.mocked(conversationStateRepository.ensure).mockResolvedValue(
      makeState({
        clientId: null,
        // Under the default-OFF gate, a pre-onboarding document flow only
        // runs where an agent enabled the conversation.
        aiOverride: "enabled",
        context: { domain: "admin", adminActionable: true, pendingAttachmentRefs: [STORED_PASSPORT_REF] } as never,
      }),
    );
    vi.mocked(messagesRepository.list).mockResolvedValue({
      items: [{ id: "msg-1", direction: "inbound", text: "John Smith 07123456789", created_at: "2026-07-20T00:02:00.000Z" }],
    } as never);
    vi.mocked(messagesRepository.downloadAttachment).mockResolvedValue({ buffer: Buffer.from("img-bytes") } as never);
    // Onboarding completes this turn (name+phone given) → clientId resolves.
    vi.mocked(generateTurn).mockResolvedValue({
      hand_off: false,
      intent: "other",
      slots: {},
      client: { fullName: "John Smith", phone: "07123456789" },
      beneficiary: { onBehalf: false },
      reply: "Thanks John, I can see you on the system.",
    } as never);
    vi.mocked(adminAgent.answer).mockResolvedValue({ reply: "Logged — a colleague will follow up.", ticketOpened: true });

    await replyWorker.handleInbound(ORG_ID, makeEvent({ text: "John Smith 07123456789" }));

    // The deferred file was downloaded and handed to the admin agent (which
    // attaches it to the ticket it opens), with the note naming the file.
    expect(messagesRepository.downloadAttachment).toHaveBeenCalledWith("att-1");
    expect(adminAgent.answer).toHaveBeenCalledTimes(1);
    const answerArgs = vi.mocked(adminAgent.answer).mock.calls[0];
    expect(answerArgs[6]).toContain("passport.jpg"); // attachmentNote
    expect(answerArgs[7]).toHaveLength(1); // pendingAttachments
    expect(answerArgs[7]?.[0]?.filename).toBe("passport.jpg");

    // Consume-once: the marker is gone from the persisted context, so later
    // turns neither re-download nor stay forced onto the admin route.
    const updates = vi.mocked(conversationStateRepository.update).mock.calls;
    const finalCtx = updates[updates.length - 1][1].context as { pendingAttachmentRefs?: unknown; ticketOpened?: boolean };
    expect(finalCtx.pendingAttachmentRefs).toBeUndefined();
    expect(finalCtx.ticketOpened).toBe(true);
  });
});

// ── Hand-off resume gate (handoffReason) ────────────────────────────────────
// Human-owned hand-offs are STICKY: the AI never auto-resumes a conversation a
// real agent replied in (or manually disabled), no matter how long it idles —
// only an inbox re-enable brings it back. AI-caused hand-offs (wound down /
// enquiry completed) auto-resume after RESUME_AFTER_MS (7 days) of inactivity,
// with a clean slate.
describe("handleInbound — hand-off resume gate", () => {
  const DAYS = 24 * 60 * 60 * 1000;

  it("stays silent forever on a human-reply hand-off, even after weeks of idle", async () => {
    vi.mocked(conversationStateRepository.find).mockResolvedValue(
      makeState({ needsHuman: true, context: { handoffReason: "human_reply" } as never, updatedAt: new Date(Date.now() - 30 * DAYS) }),
    );

    await replyWorker.handleInbound(ORG_ID, makeEvent());

    expect(generateTurn).not.toHaveBeenCalled();
    expect(messagesRepository.send).not.toHaveBeenCalled();
    expect(messagesRepository.createInternalNote).not.toHaveBeenCalled();
    // No clean-slate resume write either — the hand-off state is untouched.
    expect(conversationStateRepository.update).not.toHaveBeenCalledWith(
      "conv-1",
      expect.objectContaining({ needsHuman: false }),
    );
  });

  it("treats a hand-off with no recorded reason (pre-existing rows) as human-owned — stays silent", async () => {
    vi.mocked(conversationStateRepository.find).mockResolvedValue(
      makeState({ needsHuman: true, context: null, updatedAt: new Date(Date.now() - 30 * DAYS) }),
    );

    await replyWorker.handleInbound(ORG_ID, makeEvent());

    expect(generateTurn).not.toHaveBeenCalled();
    expect(messagesRepository.createInternalNote).not.toHaveBeenCalled();
  });

  it("stays silent on an AI-caused hand-off that is still inside the resume window", async () => {
    vi.mocked(conversationStateRepository.find).mockResolvedValue(
      makeState({ needsHuman: true, context: { handoffReason: "ai_wound_down" } as never, updatedAt: new Date(Date.now() - 2 * DAYS) }),
    );

    await replyWorker.handleInbound(ORG_ID, makeEvent());

    expect(generateTurn).not.toHaveBeenCalled();
    expect(messagesRepository.createInternalNote).not.toHaveBeenCalled();
  });

  it("resumes with a clean slate on an AI-caused hand-off after the resume window", async () => {
    vi.mocked(conversationStateRepository.find).mockResolvedValue(
      makeState({ needsHuman: true, context: { handoffReason: "enquiry_scheduled" } as never, updatedAt: new Date(Date.now() - 8 * DAYS) }),
    );

    await replyWorker.handleInbound(ORG_ID, makeEvent());

    // Clean-slate reset persisted before processing…
    expect(conversationStateRepository.update).toHaveBeenCalledWith(
      "conv-1",
      expect.objectContaining({ needsHuman: false, enquiryStatus: null, enquirySlots: {}, enquiryId: null, context: null }),
    );
    // …and the turn then processed normally (general route, draft mode → note).
    expect(messagesRepository.createInternalNote).toHaveBeenCalledTimes(1);
  });
});

// ── Default-on for NEW conversations ────────────────────────────────────────
// James's policy: once the org's auto-reply is switched on (autoReplyEnabledAt
// stamped), conversations CREATED in SendSeven after that moment get the AI
// automatically — no per-conversation/client opt-in. Pre-existing conversations
// stay opt-in-only, and an unreadable conversation lookup fails closed.
describe("handleInbound — default-on for new conversations", () => {
  const ENABLED_AT = new Date("2026-08-01T00:00:00Z");

  beforeEach(() => {
    // Not opted in classically: no override, no linked client.
    vi.mocked(conversationStateRepository.ensure).mockResolvedValue(makeState({ clientId: null }));
    vi.mocked(conversationIntegrationRepository.findByOrg).mockResolvedValue({
      autoReplyMode: "draft",
      autoReplyEnabledAt: ENABLED_AT,
    } as never);
  });

  it("participates when the conversation was created AFTER auto-reply was enabled, and caches the verdict", async () => {
    vi.mocked(conversationsRepository.getById).mockResolvedValue({ id: "conv-1", created_at: "2026-08-05T00:00:00Z" } as never);

    await replyWorker.handleInbound(ORG_ID, makeEvent());

    // general route (classify mock) in draft mode → one suggested-reply note.
    expect(messagesRepository.createInternalNote).toHaveBeenCalledTimes(1);
    expect(conversationStateRepository.update).toHaveBeenCalledWith(
      "conv-1",
      expect.objectContaining({ context: expect.objectContaining({ newConversation: true }) }),
    );
  });

  it("stays silent for a conversation created BEFORE auto-reply was enabled", async () => {
    vi.mocked(conversationsRepository.getById).mockResolvedValue({ id: "conv-1", created_at: "2026-07-20T00:00:00Z" } as never);

    await replyWorker.handleInbound(ORG_ID, makeEvent());

    expect(generateTurn).not.toHaveBeenCalled();
    expect(messagesRepository.createInternalNote).not.toHaveBeenCalled();
    // The negative verdict IS cached (it's definitive, not an error).
    expect(conversationStateRepository.update).toHaveBeenCalledWith(
      "conv-1",
      expect.objectContaining({ context: expect.objectContaining({ newConversation: false }) }),
    );
  });

  it("fails closed (silent, uncached) when the conversation lookup fails", async () => {
    vi.mocked(conversationsRepository.getById).mockRejectedValue(new Error("SendSeven down"));

    await replyWorker.handleInbound(ORG_ID, makeEvent());

    expect(messagesRepository.createInternalNote).not.toHaveBeenCalled();
    // No cache write — the next message retries the lookup.
    expect(conversationStateRepository.update).not.toHaveBeenCalledWith(
      "conv-1",
      expect.objectContaining({ context: expect.objectContaining({ newConversation: expect.anything() }) }),
    );
  });

  it("uses the cached verdict without re-fetching the conversation", async () => {
    vi.mocked(conversationStateRepository.ensure).mockResolvedValue(
      makeState({ clientId: null, context: { newConversation: true } as never }),
    );

    await replyWorker.handleInbound(ORG_ID, makeEvent());

    expect(conversationsRepository.getById).not.toHaveBeenCalled();
    expect(messagesRepository.createInternalNote).toHaveBeenCalledTimes(1);
  });

  it("does NOT default-on when autoReplyEnabledAt is missing (pre-column rows / never enabled)", async () => {
    vi.mocked(conversationIntegrationRepository.findByOrg).mockResolvedValue({ autoReplyMode: "draft" } as never);

    await replyWorker.handleInbound(ORG_ID, makeEvent());

    expect(conversationsRepository.getById).not.toHaveBeenCalled();
    expect(messagesRepository.createInternalNote).not.toHaveBeenCalled();
  });
});

// ── AI opt-in gate (default OFF) ────────────────────────────────────────────
// The bot only replies where an agent opted in: a per-conversation override
// or a linked client with aiReplyEnabled. Everything else stays silent.
describe("handleInbound — AI opt-in gate", () => {
  it("stays silent for an unknown contact with no override (the default)", async () => {
    vi.mocked(conversationStateRepository.ensure).mockResolvedValue(makeState({ clientId: null }));

    await replyWorker.handleInbound(ORG_ID, makeEvent());

    expect(generateTurn).not.toHaveBeenCalled();
    expect(messagesRepository.send).not.toHaveBeenCalled();
    expect(messagesRepository.createInternalNote).not.toHaveBeenCalled();
  });

  it("stays silent when the linked client is NOT opted in", async () => {
    vi.mocked(neonClientService.getNeonClientById).mockResolvedValueOnce({ id: "known-client-1", aiReplyEnabled: false } as never);

    await replyWorker.handleInbound(ORG_ID, makeEvent());

    expect(generateTurn).not.toHaveBeenCalled();
    expect(messagesRepository.createInternalNote).not.toHaveBeenCalled();
  });

  it("stays silent when the conversation override is 'disabled', even for an opted-in client", async () => {
    vi.mocked(conversationStateRepository.ensure).mockResolvedValue(makeState({ aiOverride: "disabled" }));

    await replyWorker.handleInbound(ORG_ID, makeEvent());

    expect(generateTurn).not.toHaveBeenCalled();
    expect(messagesRepository.createInternalNote).not.toHaveBeenCalled();
  });

  it("replies when the linked client IS opted in (default mock)", async () => {
    await replyWorker.handleInbound(ORG_ID, makeEvent());
    // general route (classify mock) → one draft note.
    expect(messagesRepository.createInternalNote).toHaveBeenCalledTimes(1);
  });

  it("replies for an unknown contact when the conversation override is 'enabled'", async () => {
    vi.mocked(conversationStateRepository.ensure).mockResolvedValue(makeState({ clientId: null, aiOverride: "enabled" }));
    vi.mocked(classifyConversationRoute).mockResolvedValue("general");

    await replyWorker.handleInbound(ORG_ID, makeEvent());

    expect(messagesRepository.createInternalNote).toHaveBeenCalledTimes(1);
  });
});
