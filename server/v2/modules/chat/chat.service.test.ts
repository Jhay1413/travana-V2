import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./chat.repository", () => ({
  chatRepository: {
    isParticipant: vi.fn(),
    createMessage: vi.fn(),
    findParticipantsByConversation: vi.fn(),
    updateLastRead: vi.fn(),
    findMessagesByConversation: vi.fn(),
    findConversationsByUserId: vi.fn(),
    getUnreadCounts: vi.fn(),
    getLastMessages: vi.fn(),
  },
}));
vi.mock("../notification/notification.repository", () => ({
  notificationRepository: { create: vi.fn() },
}));
vi.mock("../../../services/portal-chat-bridge", () => ({
  bridgeAgentReplyToPortal: vi.fn(),
  isPortalSender: vi.fn(() => false),
}));

import { chatService } from "./chat.service";
import { chatRepository } from "./chat.repository";

const stored = () => vi.mocked(chatRepository.createMessage).mock.calls[0][0].content;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(chatRepository.isParticipant).mockResolvedValue(true);
  vi.mocked(chatRepository.createMessage).mockResolvedValue({} as never);
  vi.mocked(chatRepository.findParticipantsByConversation).mockResolvedValue([]);
});

describe("chatService.sendMessage sanitising", () => {
  it("strips script, onerror and javascript: URLs", async () => {
    await chatService.sendMessage(
      "c1",
      "u1",
      '<p>hi</p><script>alert(1)</script><img src=x onerror="alert(1)"><a href="javascript:alert(1)">x</a>',
    );
    expect(stored()).not.toMatch(/script|onerror|javascript:|<img/i);
    expect(stored()).toContain("<p>hi</p>");
  });

  it("keeps b/i/ul/a with https", async () => {
    await chatService.sendMessage("c1", "u1", '<b>b</b><i>i</i><ul><li>x</li></ul><a href="https://x.com">l</a>');
    expect(stored()).toContain("<b>b</b>");
    expect(stored()).toContain("<i>i</i>");
    expect(stored()).toContain("<ul><li>x</li></ul>");
    expect(stored()).toContain('href="https://x.com"');
  });

  it("escapes a bare <", async () => {
    await chatService.sendMessage("c1", "u1", "a < b");
    expect(stored()).toBe("a &lt; b");
  });

  it("rejects a message that is empty after sanitising", async () => {
    await expect(chatService.sendMessage("c1", "u1", "<script>x</script>")).rejects.toThrow("Message cannot be empty");
    expect(chatRepository.createMessage).not.toHaveBeenCalled();
  });

  it("allows an empty body when a file is attached", async () => {
    await chatService.sendMessage("c1", "u1", "", { fileUrl: "/f", fileName: "f", fileType: "t", fileSize: 1 });
    expect(stored()).toBe("");
  });
});

describe("chatService sanitising on read", () => {
  const dirty = '<p>a &amp; b</p><script>x</script><img src=x onerror="y">';

  it("cleans message content in getMessages and keeps order", async () => {
    vi.mocked(chatRepository.updateLastRead).mockResolvedValue(undefined as never);
    vi.mocked(chatRepository.findMessagesByConversation).mockResolvedValue([
      { id: "2", content: dirty },
      { id: "1", content: "plain &amp; ok" },
    ] as never);
    const out = await chatService.getMessages("c1", "u1");
    expect(out.map((m) => m.id)).toEqual(["1", "2"]);
    expect(out[0].content).toBe("plain &amp; ok");
    expect(out[1].content).toBe("<p>a &amp; b</p>");
  });

  it("cleans lastMessage content in getConversations", async () => {
    vi.mocked(chatRepository.findConversationsByUserId).mockResolvedValue([{ id: "c1" }, { id: "c2" }] as never);
    vi.mocked(chatRepository.getUnreadCounts).mockResolvedValue([]);
    vi.mocked(chatRepository.getLastMessages).mockResolvedValue([{ conversation_id: "c1", content: dirty }] as never);
    const out = await chatService.getConversations("u1");
    expect(out[0].lastMessage?.content).toBe("<p>a &amp; b</p>");
    expect(out[1].lastMessage).toBeNull();
  });
});
