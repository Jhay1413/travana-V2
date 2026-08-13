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
  // Defaults: the answer names a real time, so neither fallback applies.
  isOpenAvailability: vi.fn(() => false),
  saysToday: vi.fn(() => false),
  kbExceedsBudget: vi.fn(() => false),
  looksLikeActionableAdmin: vi.fn(() => false),
  looksLikeAdminAsk: vi.fn(() => false),
  mergeSlots: vi.fn((prior: Record<string, unknown>, next: Record<string, unknown>) => ({ ...prior, ...next })),
  missingCoreFieldsFor: vi.fn(() => []),
  missingFieldsFor: vi.fn(() => []),
  parseAvailabilityTime: vi.fn(async () => new Date("2026-08-01")),
  // Default: the customer gave a time, not a request to keep it on messages.
  prefersMessagingOverCall: vi.fn(() => false),
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
  taskService: {
    create: vi.fn(async () => ({ id: "task-1" })),
    update: vi.fn(async () => ({ id: "task-1" })),
    listByEntity: vi.fn(async () => []),
  },
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
import { realtimeService } from "../../realtime/realtime.service";
import { taskService } from "../task/task.service";
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
  const MINUTES = 60 * 1000;

  const handedOff = (reason: string, idleMs: number) =>
    makeState({ needsHuman: true, context: { handoffReason: reason } as never, updatedAt: new Date(Date.now() - idleMs) });

  it("stays silent when an agent switched the AI off, whatever the customer says", async () => {
    vi.mocked(conversationStateRepository.find).mockResolvedValue(handedOff("manual_disable", 30 * DAYS));
    vi.mocked(classifyConversationRoute).mockResolvedValue("sales");

    await replyWorker.handleInbound(ORG_ID, makeEvent({ text: "looking for Tenerife in August" }));

    expect(generateTurn).not.toHaveBeenCalled();
    expect(messagesRepository.send).not.toHaveBeenCalled();
    expect(messagesRepository.createInternalNote).not.toHaveBeenCalled();
    // An explicit "off" is never overridden by intent — the router isn't even consulted.
    expect(classifyConversationRoute).not.toHaveBeenCalled();
    expect(conversationStateRepository.update).not.toHaveBeenCalledWith("conv-1", expect.objectContaining({ needsHuman: false }));
  });

  it("stays out of an exchange the agent is actively having (inside the cool-off)", async () => {
    vi.mocked(conversationStateRepository.find).mockResolvedValue(handedOff("human_reply", 10 * MINUTES));

    await replyWorker.handleInbound(ORG_ID, makeEvent({ text: "I haven't received my call" }));

    expect(classifyConversationRoute).not.toHaveBeenCalled();
    expect(messagesRepository.createInternalNote).not.toHaveBeenCalled();
  });

  it("stays silent on mere chatter — that belongs to the agent's exchange", async () => {
    vi.mocked(conversationStateRepository.find).mockResolvedValue(handedOff("human_reply", 3 * DAYS));
    vi.mocked(classifyConversationRoute).mockResolvedValue("general");

    await replyWorker.handleInbound(ORG_ID, makeEvent({ text: "ok" }));

    expect(generateTurn).not.toHaveBeenCalled();
    expect(messagesRepository.createInternalNote).not.toHaveBeenCalled();
    // The hand-off is left untouched for the agent.
    expect(conversationStateRepository.update).not.toHaveBeenCalledWith("conv-1", expect.objectContaining({ needsHuman: false }));
  });

  it("resumes on a NEW admin intent after a human hand-off (\"I haven't received my call\")", async () => {
    vi.mocked(conversationStateRepository.find).mockResolvedValue(handedOff("human_reply", 3 * DAYS));
    vi.mocked(classifyConversationRoute).mockResolvedValue("admin");

    await replyWorker.handleInbound(ORG_ID, makeEvent({ text: "Hi I haven't received my call" }));

    // Clean slate first, so the previous enquiry can't leak into the new matter.
    expect(conversationStateRepository.update).toHaveBeenCalledWith(
      "conv-1",
      expect.objectContaining({ needsHuman: false, enquiryStatus: null, enquirySlots: {}, enquiryId: null, context: null }),
    );
  });

  it("resumes on a NEW sales intent after a human hand-off", async () => {
    vi.mocked(conversationStateRepository.find).mockResolvedValue(handedOff("human_reply", 3 * DAYS));
    vi.mocked(classifyConversationRoute).mockResolvedValue("sales");

    await replyWorker.handleInbound(ORG_ID, makeEvent({ text: "can you look at Tenerife for us next May" }));

    expect(conversationStateRepository.update).toHaveBeenCalledWith(
      "conv-1",
      expect.objectContaining({ needsHuman: false, enquiryStatus: null }),
    );
  });

  it("applies the same rule to an AI-caused hand-off (enquiry logged, customer comes back)", async () => {
    vi.mocked(conversationStateRepository.find).mockResolvedValue(handedOff("enquiry_scheduled", 2 * DAYS));
    vi.mocked(classifyConversationRoute).mockResolvedValue("general");

    await replyWorker.handleInbound(ORG_ID, makeEvent({ text: "thanks" }));

    expect(messagesRepository.createInternalNote).not.toHaveBeenCalled();
  });

  it("resumes without a router call once the thread is genuinely abandoned", async () => {
    vi.mocked(conversationStateRepository.find).mockResolvedValue(handedOff("human_reply", 8 * DAYS));

    await replyWorker.handleInbound(ORG_ID, makeEvent());

    expect(classifyConversationRoute).not.toHaveBeenCalledWith(expect.objectContaining({ enquiryInFlight: false, transcript: "hello there" }));
    expect(conversationStateRepository.update).toHaveBeenCalledWith(
      "conv-1",
      expect.objectContaining({ needsHuman: false, enquiryStatus: null, enquirySlots: {}, enquiryId: null, context: null }),
    );
    expect(messagesRepository.createInternalNote).toHaveBeenCalledTimes(1);
  });

  it("treats a hand-off with no recorded reason (pre-existing rows) as a human one", async () => {
    vi.mocked(conversationStateRepository.find).mockResolvedValue(
      makeState({ needsHuman: true, context: null, updatedAt: new Date(Date.now() - 10 * MINUTES) }),
    );

    await replyWorker.handleInbound(ORG_ID, makeEvent());

    // Inside the cool-off → silent, exactly like an explicit human_reply.
    expect(messagesRepository.createInternalNote).not.toHaveBeenCalled();
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

// A customer who never answers "what time suits?" must not leave the enquiry
// with no task at all — invisible in every task list. The follow-up task is
// raised (undated) at enquiry creation and FILLED IN when they answer, so
// there is exactly one task either way.
describe("handleInbound — follow-up task lifecycle", () => {
  it("raises an undated follow-up task the moment the enquiry is created", async () => {
    const { shouldCreateEnquiryNow, hasSubstantiveSignal } = await import("../ai-conversation/ai-conversation.brain");
    vi.mocked(classifyConversationRoute).mockResolvedValue("sales");
    vi.mocked(hasSubstantiveSignal).mockReturnValue(true);
    vi.mocked(shouldCreateEnquiryNow).mockReturnValue(true);
    vi.mocked(generateTurn).mockResolvedValue({
      hand_off: false, intent: "enquiry", complete: true, slots: { destinations: ["Albufeira"] },
      client: {}, beneficiary: { onBehalf: false }, reply: "lovely",
    } as never);

    await replyWorker.handleInbound(ORG_ID, makeEvent({ text: "Albufeira, 7 nights, 2 adults, £900" }));

    expect(taskService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "enquiry",
        entityId: "enq-1",
        title: "Call back — awaiting preferred time from client",
        dueDate: null,
        completed: false,
      }),
      expect.anything(),
    );
    // The id is carried so the answer turn fills THIS task in.
    const updates = vi.mocked(conversationStateRepository.update).mock.calls;
    const ctx = updates[updates.length - 1][1].context as { availabilityTaskId?: string };
    expect(ctx.availabilityTaskId).toBe("task-1");
  });

  it("fills in that task when the time arrives instead of creating a second one", async () => {
    // An enquiry in flight routes to sales (the real router short-circuits
    // on enquiryInFlight; the mock needs telling).
    vi.mocked(classifyConversationRoute).mockResolvedValue("sales");
    vi.mocked(conversationStateRepository.ensure).mockResolvedValue(
      makeState({
        enquiryStatus: "awaiting_availability",
        enquiryId: "enq-1",
        context: { enquiryOwnerUserId: "user-1", availabilityTaskId: "task-1" } as never,
      }),
    );

    await replyWorker.handleInbound(ORG_ID, makeEvent({ text: "around 11 please" }));

    expect(taskService.update).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({ title: "Call back — client available around 11 please" }),
      expect.anything(),
    );
    expect(taskService.create).not.toHaveBeenCalled();
  });

  it("recovers the enquiry's existing task when the context lost its id — never a second task", async () => {
    vi.mocked(classifyConversationRoute).mockResolvedValue("sales");
    vi.mocked(taskService.listByEntity).mockResolvedValue([
      { id: "task-placeholder", completed: false, dueDate: null },
    ] as never);
    vi.mocked(conversationStateRepository.ensure).mockResolvedValue(
      makeState({
        enquiryStatus: "awaiting_availability",
        enquiryId: "enq-1",
        // Context has the owner but NOT availabilityTaskId — the observed case.
        context: { enquiryOwnerUserId: "user-1" } as never,
      }),
    );

    await replyWorker.handleInbound(ORG_ID, makeEvent({ text: "anytime" }));

    expect(taskService.update).toHaveBeenCalledWith("task-placeholder", expect.anything(), expect.anything());
    expect(taskService.create).not.toHaveBeenCalled();
  });

  it("falls back to creating one when there is no placeholder (older conversations)", async () => {
    vi.mocked(taskService.listByEntity).mockResolvedValue([] as never);
    // An enquiry in flight routes to sales (the real router short-circuits
    // on enquiryInFlight; the mock needs telling).
    vi.mocked(classifyConversationRoute).mockResolvedValue("sales");
    vi.mocked(conversationStateRepository.ensure).mockResolvedValue(
      makeState({
        enquiryStatus: "awaiting_availability",
        enquiryId: "enq-1",
        context: { enquiryOwnerUserId: "user-1" } as never,
      }),
    );

    await replyWorker.handleInbound(ORG_ID, makeEvent({ text: "around 11 please" }));

    expect(taskService.update).not.toHaveBeenCalled();
    expect(taskService.create).toHaveBeenCalledTimes(1);
  });
});

// Message bursts: customers routinely send two or three messages seconds apart
// ("...for a week cheap all inclusive", then "3 people"). Each is its own
// webhook with its own message id, so the per-message claim cannot dedupe them
// — observed: the same "pop me your name and phone number" ask sent twice.
describe("handleInbound — burst of messages produces ONE reply", () => {
  const older = { id: "msg-1", direction: "inbound", text: "Egypt for a week, cheap all inclusive", created_at: "2026-08-09T21:25:00.000Z" };
  const newer = { id: "msg-2", direction: "inbound", text: "3 people", created_at: "2026-08-09T21:25:20.000Z" };

  beforeEach(() => {
    vi.mocked(conversationStateRepository.ensure).mockResolvedValue(makeState({ clientId: null, aiOverride: "enabled" }));
    vi.mocked(messagesRepository.list).mockResolvedValue({ items: [older, newer] } as never);
    vi.mocked(generateTurn).mockResolvedValue({
      hand_off: false, intent: "enquiry", slots: {}, client: {}, beneficiary: { onBehalf: false },
      reply: "Can you pop me your name and best phone number?",
    } as never);
  });

  it("stays quiet on the earlier message once a newer one has arrived", async () => {
    vi.mocked(classifyConversationRoute).mockResolvedValue("sales");

    await replyWorker.handleInbound(ORG_ID, makeEvent({ id: "msg-1", text: older.text }));

    expect(messagesRepository.createInternalNote).not.toHaveBeenCalled();
    expect(messagesRepository.send).not.toHaveBeenCalled();
  });

  it("replies to the LATEST message of the burst", async () => {
    vi.mocked(classifyConversationRoute).mockResolvedValue("sales");

    await replyWorker.handleInbound(ORG_ID, makeEvent({ id: "msg-2", text: newer.text }));

    expect(messagesRepository.createInternalNote).toHaveBeenCalledTimes(1);
  });

  it("still replies when the customer sent only one message", async () => {
    vi.mocked(classifyConversationRoute).mockResolvedValue("sales");
    vi.mocked(messagesRepository.list).mockResolvedValue({ items: [older] } as never);

    await replyWorker.handleInbound(ORG_ID, makeEvent({ id: "msg-1", text: older.text }));

    expect(messagesRepository.createInternalNote).toHaveBeenCalledTimes(1);
  });

  it("replies anyway if the supersede lookup fails (never leaves them unanswered)", async () => {
    vi.mocked(classifyConversationRoute).mockResolvedValue("sales");
    vi.mocked(messagesRepository.list)
      .mockResolvedValueOnce({ items: [older] } as never)  // the turn's own history fetch
      .mockRejectedValueOnce(new Error("SendSeven down"));  // the supersede check
    await replyWorker.handleInbound(ORG_ID, makeEvent({ id: "msg-1", text: older.text }));

    expect(messagesRepository.createInternalNote).toHaveBeenCalledTimes(1);
  });
});

// "AI is typing…" — the AI turn can take several seconds, so the inbox is told
// it is composing. The clear is the part that matters: an indicator that
// sticks after a failure is worse than none at all.
describe("handleInbound — AI typing indicator", () => {
  const typingEvents = () =>
    vi.mocked(realtimeService.publish).mock.calls
      .map((c) => c[1] as { type: string; typing?: { actor: string; stopped?: boolean } })
      .filter((e) => e.type === "typing");

  it("announces it is composing and clears when the turn finishes", async () => {
    await replyWorker.handleInbound(ORG_ID, makeEvent());

    const events = typingEvents();
    expect(events[0]).toMatchObject({ typing: { actor: "ai" } });
    expect(events[0].typing?.stopped).toBeFalsy();
    expect(events[events.length - 1]).toMatchObject({ typing: { actor: "ai", stopped: true } });
  });

  it("clears the indicator even when the turn throws", async () => {
    vi.mocked(classifyConversationRoute).mockRejectedValue(new Error("router down"));

    await expect(replyWorker.handleInbound(ORG_ID, makeEvent())).rejects.toThrow("router down");

    expect(typingEvents().at(-1)).toMatchObject({ typing: { actor: "ai", stopped: true } });
  });

  it("says nothing at all when the AI is not going to reply", async () => {
    // Not opted in → the turn returns before composing anything.
    vi.mocked(conversationStateRepository.ensure).mockResolvedValue(makeState({ clientId: null }));

    await replyWorker.handleInbound(ORG_ID, makeEvent());

    expect(typingEvents()).toHaveLength(0);
  });
});
