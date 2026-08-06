import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks for every dependency the fork touches — the tests here exercise the
// fork's OWN logic: what gets seeded, what state is (and isn't) copied, and
// the auto-turn that answers a conversation ending on a customer message.

vi.mock("../../utils/sendseven", () => ({
  runWithSendSevenConfigAsync: vi.fn((_cfg: unknown, fn: () => Promise<unknown>) => fn()),
}));

vi.mock("../conversation-integration/conversation-integration.service", () => ({
  conversationIntegrationService: { resolveConfig: vi.fn(async () => ({ baseUrl: "https://x", token: "t" })) },
}));

vi.mock("../conversations/conversations.repository", () => ({
  conversationsRepository: { getById: vi.fn(async () => ({ id: "conv-1", contact: { name: "Tracy Smith" } })) },
}));

vi.mock("../messages/messages.repository", () => ({
  messagesRepository: { list: vi.fn(async () => ({ items: [] })) },
}));

vi.mock("../neon-client/neon-client.service", () => ({
  neonClientService: { getNeonClientById: vi.fn(async () => null) },
}));

vi.mock("../sendseven-webhook/conversation-state.repository", () => ({
  conversationStateRepository: { find: vi.fn(async () => null) },
}));

vi.mock("../sendseven-webhook/identity.service", () => ({
  clientDisplayName: vi.fn(() => "Real Client"),
  systemScope: vi.fn((orgId: string) => ({ orgId })),
}));

vi.mock("./internal-chat-identity.service", () => ({
  resolveOrCreateTestClient: vi.fn(async () => ({ status: "resolved", clientId: "test-twin-1" })),
  createNewTestClient: vi.fn(async () => "test-twin-2"),
}));

vi.mock("./internal-chat-testflow.service", () => ({
  internalChatTestflowService: { runTestFlowTurn: vi.fn(async () => ({ replyMessage: { id: "m-reply" } })) },
}));

vi.mock("./internal-chat.repository", () => ({
  internalChatRepository: {
    createSession: vi.fn(async () => ({ id: "sess-1", orgId: "org-1" })),
    updateSession: vi.fn(async () => ({ id: "sess-1", orgId: "org-1", clientId: "test-twin-1" })),
    createMessage: vi.fn(async () => ({ id: "m-1" })),
  },
}));

import { forkSessionFromConversation } from "./internal-chat-fork.service";
import { internalChatRepository } from "./internal-chat.repository";
import { internalChatTestflowService } from "./internal-chat-testflow.service";
import { messagesRepository } from "../messages/messages.repository";
import type { Scope } from "../../utils/scope";

const ORG_ID = "org-1";
const CONV_ID = "conv-1";
const SCOPE = { orgId: ORG_ID, userId: "staff-1", orgRoles: ["org_admin"], orgRole: "org_admin", branchId: null } as unknown as Scope;

const AGENT_MSG = { id: "m1", direction: "outbound", text: "Hi Tracy, how can I help?", created_at: "2026-08-01T10:00:00Z" };
const CUSTOMER_MSG = { id: "m2", direction: "inbound", text: "Tenerife in August please", created_at: "2026-08-01T10:01:00Z" };

// Seeded (history) messages only — excludes the provenance system_note and any
// message the driver persists itself.
function seededUserAndAssistant() {
  return vi.mocked(internalChatRepository.createMessage).mock.calls
    .map((c) => c[0])
    .filter((m) => m.role !== "system_note");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(internalChatRepository.createSession).mockResolvedValue({ id: "sess-1", orgId: ORG_ID } as never);
  vi.mocked(internalChatRepository.updateSession).mockResolvedValue({ id: "sess-1", orgId: ORG_ID } as never);
  vi.mocked(internalChatTestflowService.runTestFlowTurn).mockResolvedValue({ replyMessage: { id: "m-reply" } } as never);
});

describe("forkSessionFromConversation — auto-reply when the conversation ends on a customer message", () => {
  it("answers the trailing customer message immediately (and doesn't seed it twice)", async () => {
    vi.mocked(messagesRepository.list).mockResolvedValue({ items: [AGENT_MSG, CUSTOMER_MSG] } as never);

    const result = await forkSessionFromConversation(SCOPE, CONV_ID);

    expect(result.autoReplied).toBe(true);
    // The trailing customer message is handed to the driver (which persists it
    // itself), so only the earlier history is seeded directly.
    expect(internalChatTestflowService.runTestFlowTurn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(internalChatTestflowService.runTestFlowTurn).mock.calls[0][1]).toBe("Tenerife in August please");
    const seeded = seededUserAndAssistant();
    expect(seeded).toHaveLength(1);
    expect(seeded[0]).toMatchObject({ role: "assistant", content: "Hi Tracy, how can I help?" });
  });

  it("does NOT auto-reply when the last message is ours (nothing new to answer)", async () => {
    vi.mocked(messagesRepository.list).mockResolvedValue({ items: [CUSTOMER_MSG, { ...AGENT_MSG, created_at: "2026-08-01T10:02:00Z" }] } as never);

    const result = await forkSessionFromConversation(SCOPE, CONV_ID);

    expect(result.autoReplied).toBe(false);
    expect(internalChatTestflowService.runTestFlowTurn).not.toHaveBeenCalled();
    // Both messages are seeded as history.
    expect(seededUserAndAssistant()).toHaveLength(2);
  });

  it("still returns a usable session (with the customer message seeded) when the auto-turn fails", async () => {
    vi.mocked(messagesRepository.list).mockResolvedValue({ items: [AGENT_MSG, CUSTOMER_MSG] } as never);
    vi.mocked(internalChatTestflowService.runTestFlowTurn).mockRejectedValue(new Error("AI service down"));

    const result = await forkSessionFromConversation(SCOPE, CONV_ID);

    expect(result.sessionId).toBe("sess-1");
    expect(result.autoReplied).toBe(false);
    // The customer's message is persisted by the fallback so the transcript
    // still ends where the real conversation does.
    expect(seededUserAndAssistant()).toContainEqual(
      expect.objectContaining({ role: "user", content: "Tenerife in August please" }),
    );
  });

  it("rejects a conversation belonging to another org", async () => {
    const { conversationStateRepository } = await import("../sendseven-webhook/conversation-state.repository");
    vi.mocked(conversationStateRepository.find).mockResolvedValue({ conversationId: CONV_ID, orgId: "other-org" } as never);

    await expect(forkSessionFromConversation(SCOPE, CONV_ID)).rejects.toMatchObject({ statusCode: 404 });
    expect(internalChatRepository.createSession).not.toHaveBeenCalled();
  });

  it("is gated to org admins", async () => {
    const agentScope = { ...SCOPE, orgRoles: ["agent"], orgRole: "agent" } as unknown as Scope;

    await expect(forkSessionFromConversation(agentScope, CONV_ID)).rejects.toMatchObject({ statusCode: 403 });
  });
});
