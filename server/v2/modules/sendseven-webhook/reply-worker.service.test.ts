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
  buildPhoneConflictReply: vi.fn(() => "Can you confirm that number's yours?"),
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
  neonClientService: { getNeonClientById: vi.fn(async () => null) },
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

vi.mock("./identity.service", () => ({
  createNewClientAndLink: vi.fn(async () => "new-client-id"),
  extractPhoneNumber: vi.fn(() => null),
  insertClient: vi.fn(async () => "new-client-id"),
  resolveClientForOnboarding: vi.fn(async () => ({ status: "resolved", clientId: "new-client-id" })),
  resolveExistingClient: vi.fn(async () => null),
  resolveOrCreateByDetails: vi.fn(async () => ({ status: "resolved", clientId: "new-client-id" })),
  samePhoneNumber: vi.fn(() => false),
  systemScope: vi.fn((orgId: string) => ({ orgId, branchId: null, orgRole: "org_admin", orgRoles: ["org_admin"], userId: null })),
}));

vi.mock("../task/task.service", () => ({
  taskService: { create: vi.fn(async () => ({ id: "task-1" })) },
}));

vi.mock("./admin-agent.service", () => ({
  adminAgent: { answer: vi.fn(async () => null) },
}));

import { cleanTravellerName, replyWorker } from "./reply-worker.service";
import { decideDeterministicRoute, generateTurn } from "../ai-conversation/ai-conversation.brain";
import { classifyConversationRoute } from "../ai-conversation/conversation-router";
import { conversationStateRepository } from "./conversation-state.repository";
import { sendsevenWebhookRepository } from "./sendseven-webhook.repository";
import { messagesRepository } from "../messages/messages.repository";
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
    vi.mocked(conversationStateRepository.ensure).mockResolvedValue(makeState({ clientId: null }));

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
    vi.mocked(conversationStateRepository.ensure).mockResolvedValue(makeState({ clientId: null }));
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
