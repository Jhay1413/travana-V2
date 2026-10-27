import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./messages.repository", () => ({
  messagesRepository: { send: vi.fn(), createInternalNote: vi.fn() },
}));
vi.mock("../user/user.repository", () => ({ userRepository: { findById: vi.fn() } }));
vi.mock("../usage/usage.service", () => ({ usageService: { recordSendsevenSend: vi.fn() } }));
vi.mock("../../realtime/realtime.service", () => ({ realtimeService: { publish: vi.fn() } }));
vi.mock("../conversations/conversations.service", () => ({
  conversationsService: { autoAssignReplier: vi.fn() },
}));
vi.mock("../sendseven-webhook/sendseven-webhook.service", () => ({
  sendsevenWebhookService: { pauseAiForStaffReply: vi.fn() },
}));

import { messagesService } from "./messages.service";
import { messagesRepository } from "./messages.repository";
import { userRepository } from "../user/user.repository";

const sender = { id: "u1", firstName: "Ann", lastName: "Lee", name: "ann", image: "a.png" };
const agentMeta = { source: "travana-agent", agent: { id: "u1", name: "Ann Lee", avatar: "a.png" } };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(messagesRepository.send).mockResolvedValue({ id: "m1", conversation_id: "c1" } as never);
  vi.mocked(messagesRepository.createInternalNote).mockResolvedValue({ id: "n1", conversation_id: "c1" } as never);
  vi.mocked(userRepository.findById).mockResolvedValue(sender as never);
});

describe("messagesService.createInternalNote", () => {
  it("stamps the sender's name on meta", async () => {
    await messagesService.createInternalNote("o1", { conversation_id: "c1", text: "hi" }, "u1");
    expect(messagesRepository.createInternalNote).toHaveBeenCalledWith({
      conversation_id: "c1",
      text: "hi",
      meta: agentMeta,
    });
  });

  it("sends the body unchanged without a sender", async () => {
    const body = { conversation_id: "c1", text: "hi" };
    await messagesService.createInternalNote("o1", body);
    expect(userRepository.findById).not.toHaveBeenCalled();
    expect(messagesRepository.createInternalNote).toHaveBeenCalledWith(body);
  });

  it("still creates the note when the user lookup fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(userRepository.findById).mockRejectedValue(new Error("db down"));
    const body = { conversation_id: "c1", text: "hi" };
    await expect(messagesService.createInternalNote("o1", body, "u1")).resolves.toBeDefined();
    expect(messagesRepository.createInternalNote).toHaveBeenCalledWith(body);
  });
});

describe("messagesService.send", () => {
  it("still stamps the sender and preserves existing meta", async () => {
    await messagesService.send("o1", { conversation_id: "c1", text: "yo", meta: { x: 1 } }, "u1");
    expect(messagesRepository.send).toHaveBeenCalledWith({
      conversation_id: "c1",
      text: "yo",
      meta: { x: 1, ...agentMeta },
    });
  });
});
