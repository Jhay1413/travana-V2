import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock every dependency so the tests exercise suggestAiReply's own control
// flow — especially its SIDE-EFFECT-FREE contract (reply text out, nothing
// written or sent).

vi.mock("../ai-conversation/ai-conversation.brain", () => ({
  buildTranscript: vi.fn((_messages: unknown, latest: string) => `Customer: ${latest}`),
  hasSubstantiveSignal: vi.fn(() => false),
  kbExceedsBudget: vi.fn(() => false),
  generateTurn: vi.fn(async () => ({
    hand_off: false,
    intent: "enquiry",
    slots: { destinations: ["Tenerife"] },
    client: {},
    reply: "Suggested reply text",
  })),
}));

vi.mock("../ai-embeddings/ai-embeddings.service", () => ({
  aiEmbeddingsService: { retrieve: vi.fn(async () => []) },
}));

vi.mock("../bot-config/bot-config.repository", () => ({
  botConfigRepository: { findByOrg: vi.fn(async () => null) },
}));

vi.mock("../conversations/conversations.repository", () => ({
  conversationsRepository: { getById: vi.fn(async () => ({ contact: { name: "Tracy Smith" } })) },
}));

vi.mock("../knowledge-base/knowledge-base.repository", () => ({
  knowledgeBaseRepository: { list: vi.fn(async () => []) },
}));

vi.mock("../messages/messages.repository", () => ({
  messagesRepository: {
    list: vi.fn(async () => ({ items: [] })),
    send: vi.fn(),
    createInternalNote: vi.fn(),
  },
}));

vi.mock("../neon-client/neon-client.service", () => ({
  neonClientService: { getNeonClientById: vi.fn(async () => ({ id: "client-1", firstName: "Tracy" })) },
}));

vi.mock("./deal-context.service", () => ({
  hydrateDealReplyContext: vi.fn(async () => ({ title: "Xmas in Amsterdam", hotelName: "Volkshotel" })),
}));

vi.mock("./conversation-state.repository", () => ({
  conversationStateRepository: {
    find: vi.fn(async () => null),
    update: vi.fn(),
    setNeedsHuman: vi.fn(),
    ensure: vi.fn(),
  },
}));

vi.mock("./identity.service", () => ({
  systemScope: vi.fn((orgId: string) => ({ orgId })),
  // Default: the contact isn't linked to anyone.
  findExistingClientReadOnly: vi.fn(async () => null),
}));

import { suggestAiReply } from "./suggest-reply.service";
import { generateTurn } from "../ai-conversation/ai-conversation.brain";
import { conversationStateRepository } from "./conversation-state.repository";
import { findExistingClientReadOnly } from "./identity.service";
import { hydrateDealReplyContext } from "./deal-context.service";
import { conversationsRepository } from "../conversations/conversations.repository";
import { messagesRepository } from "../messages/messages.repository";

const ORG_ID = "org-1";
const CONV_ID = "conv-1";

const MESSAGES = [
  { id: "m1", direction: "inbound", text: "Hi, Tenerife in August please", created_at: "2026-08-01T10:00:00Z" },
  { id: "m2", direction: "outbound", text: "Lovely! How many nights?", created_at: "2026-08-01T10:01:00Z" },
  { id: "m3", direction: "inbound", text: "10 nights", created_at: "2026-08-01T10:02:00Z" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(conversationStateRepository.find).mockResolvedValue(null);
  vi.mocked(messagesRepository.list).mockResolvedValue({ items: MESSAGES } as never);
});

describe("suggestAiReply", () => {
  it("returns the model's reply text, passing the SendSeven contact name through", async () => {
    const suggestion = await suggestAiReply(ORG_ID, CONV_ID, "user-1");

    expect(suggestion).toBe("Suggested reply text");
    const args = vi.mocked(generateTurn).mock.calls[0];
    // No state row → no linked client record…
    expect(args[2]).toBeNull();
    // …but the draft never opens by asking for name/phone: an agent is already
    // in this conversation. See the knownClient argument in suggest-reply.
    expect(args[6]).toBe(true);
    // The contact name rides along as the last param.
    expect(args[9]).toBe("Tracy Smith");
  });

  it("is side-effect-free: nothing sent, nothing persisted", async () => {
    await suggestAiReply(ORG_ID, CONV_ID);

    expect(messagesRepository.send).not.toHaveBeenCalled();
    expect(messagesRepository.createInternalNote).not.toHaveBeenCalled();
    expect(conversationStateRepository.update).not.toHaveBeenCalled();
    expect(conversationStateRepository.setNeedsHuman).not.toHaveBeenCalled();
    expect(conversationStateRepository.ensure).not.toHaveBeenCalled();
  });

  it("feeds the persisted enquiry status/slots into the prompt when a state row exists", async () => {
    vi.mocked(conversationStateRepository.find).mockResolvedValue({
      conversationId: CONV_ID,
      orgId: ORG_ID,
      clientId: "client-1",
      enquiryStatus: "collecting",
      enquirySlots: { destinations: ["Tenerife"] },
    } as never);

    await suggestAiReply(ORG_ID, CONV_ID);

    const args = vi.mocked(generateTurn).mock.calls[0];
    expect(args[2]).toEqual({ id: "client-1", firstName: "Tracy" }); // linked client record
    expect(args[4]).toBe("collecting"); // enquiryStatus
    expect(args[5]).toEqual({ destinations: ["Tenerife"] }); // prior slots
    expect(args[6]).toBe(true); // knownClient
  });

  it("rejects a conversation belonging to another org as not-found", async () => {
    vi.mocked(conversationStateRepository.find).mockResolvedValue({ conversationId: CONV_ID, orgId: "other-org" } as never);

    await expect(suggestAiReply(ORG_ID, CONV_ID)).rejects.toMatchObject({ statusCode: 404 });
    expect(generateTurn).not.toHaveBeenCalled();
  });

  it("400s when the conversation has no usable messages (nothing to reply to)", async () => {
    vi.mocked(messagesRepository.list).mockResolvedValue({
      items: [{ id: "n1", direction: "outbound", text: "internal", is_internal: true, created_at: "2026-08-01T10:00:00Z" }],
    } as never);

    await expect(suggestAiReply(ORG_ID, CONV_ID)).rejects.toMatchObject({ statusCode: 400 });
  });
});

// A conversation an agent has handled all along has no clientId on our state
// row — the live AI never processed it. Observed: the suggestion then asked a
// customer we already have on file to "pop your best phone number over".
describe("suggestAiReply — identity on conversations the live AI never touched", () => {
  beforeEach(() => {
    vi.mocked(conversationStateRepository.find).mockResolvedValue(null);
    vi.mocked(conversationsRepository.getById).mockResolvedValue({
      contact: { id: "contact-1", name: "Martyn S", phone: "07700900123", email: null },
    } as never);
  });

  it("treats a contact linked in the CRM as a known client", async () => {
    vi.mocked(findExistingClientReadOnly).mockResolvedValue("client-9" as never);

    await suggestAiReply(ORG_ID, CONV_ID);

    expect(findExistingClientReadOnly).toHaveBeenCalledWith(ORG_ID, expect.objectContaining({ id: "contact-1" }));
    // knownClient (arg 7) true → the prompt skips the name/phone onboarding ask.
    expect(vi.mocked(generateTurn).mock.calls[0][6]).toBe(true);
    expect(vi.mocked(generateTurn).mock.calls[0][2]).not.toBeNull();
  });

  it("never asks for name and phone, even when the contact is unknown to the CRM", async () => {
    // The whole point of the button on a manual / pre-AI conversation: the
    // agent wants a reply to what was said, not an onboarding script.
    vi.mocked(findExistingClientReadOnly).mockResolvedValue(null as never);

    await suggestAiReply(ORG_ID, CONV_ID);

    expect(vi.mocked(generateTurn).mock.calls[0][6]).toBe(true);
    expect(vi.mocked(generateTurn).mock.calls[0][2]).toBeNull();
  });

  it("prefers the state row's client and does not look up again", async () => {
    vi.mocked(conversationStateRepository.find).mockResolvedValue({ orgId: ORG_ID, clientId: "client-1" } as never);

    await suggestAiReply(ORG_ID, CONV_ID);

    expect(findExistingClientReadOnly).not.toHaveBeenCalled();
    expect(vi.mocked(generateTurn).mock.calls[0][6]).toBe(true);
  });
});

// A guessed pin must not be asserted by the draft either — the button reads the
// live bot's pin, so it has to honour the same "identified vs guessed" verdict.
describe("suggestAiReply — a guessed deal is passed through as unconfirmed", () => {
  const withPin = (source: string) =>
    ({ orgId: ORG_ID, clientId: "client-1", context: { dealRef: { travelDealId: "d1", quoteId: "q1", title: "Xmas in Amsterdam", source } } }) as never;

  it("flags a similarity-matched deal so the draft checks the title first", async () => {
    vi.mocked(conversationStateRepository.find).mockResolvedValue(withPin("vector"));

    await suggestAiReply(ORG_ID, CONV_ID);

    const retrieved = vi.mocked(generateTurn).mock.calls[0][7] as { deal?: { unconfirmed?: boolean } };
    expect(retrieved.deal?.unconfirmed).toBe(true);
  });

  it("leaves an identified deal usable as fact", async () => {
    vi.mocked(conversationStateRepository.find).mockResolvedValue(withPin("marker"));

    await suggestAiReply(ORG_ID, CONV_ID);

    const retrieved = vi.mocked(generateTurn).mock.calls[0][7] as { deal?: { unconfirmed?: boolean } };
    expect(retrieved.deal?.unconfirmed).toBe(false);
  });
});
