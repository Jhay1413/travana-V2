import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./messages.repository", () => ({
  messagesRepository: { send: vi.fn(), createInternalNote: vi.fn(), list: vi.fn(), getById: vi.fn() },
}));
vi.mock("./inbox-note-author.repository", () => ({
  inboxNoteAuthorRepository: { create: vi.fn(), findByMessageIds: vi.fn() },
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
import { inboxNoteAuthorRepository } from "./inbox-note-author.repository";
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
  it("does not stamp meta and records the author row", async () => {
    vi.mocked(messagesRepository.createInternalNote).mockResolvedValue({
      id: "n1", conversation_id: "c1", meta: { note_id: "note-9" },
    } as never);
    const body = { conversation_id: "c1", text: "hi" };
    await messagesService.createInternalNote("o1", body, "u1");
    expect(messagesRepository.createInternalNote).toHaveBeenCalledWith(body);
    expect(userRepository.findById).not.toHaveBeenCalled();
    expect(inboxNoteAuthorRepository.create).toHaveBeenCalledWith({
      orgId: "o1", sendsevenMessageId: "n1", sendsevenNoteId: "note-9", conversationId: "c1", userId: "u1",
    });
  });

  it("stores a null note id when SendSeven returns none", async () => {
    await messagesService.createInternalNote("o1", { conversation_id: "c1", text: "hi" }, "u1");
    expect(inboxNoteAuthorRepository.create).toHaveBeenCalledWith(expect.objectContaining({ sendsevenNoteId: null }));
  });

  it("skips the author row without a sender", async () => {
    await messagesService.createInternalNote("o1", { conversation_id: "c1", text: "hi" });
    expect(inboxNoteAuthorRepository.create).not.toHaveBeenCalled();
  });

  it("still returns the note when the author insert fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(inboxNoteAuthorRepository.create).mockRejectedValue(new Error("db down"));
    await expect(
      messagesService.createInternalNote("o1", { conversation_id: "c1", text: "hi" }, "u1"),
    ).resolves.toMatchObject({ id: "n1" });
  });
});

describe("messagesService.list", () => {
  const author = { sendsevenMessageId: "n1", userId: "u1", firstName: "Ann", lastName: "Lee", name: "ann", image: "a.png" };
  const page = (items: unknown[]) => ({ items, pagination: { total: items.length } });

  it("enriches internal notes with the stored author in one lookup, leaving others untouched", async () => {
    const note = { id: "n1", is_internal: true, meta: { note_id: "x", sent_by_user_name: "james@travana.app" } };
    const noteByMeta = { id: "n2", meta: { is_internal_note: true } };
    const plain = { id: "m1", is_internal: false, meta: { a: 1 } };
    vi.mocked(messagesRepository.list).mockResolvedValue(page([note, noteByMeta, plain]) as never);
    vi.mocked(inboxNoteAuthorRepository.findByMessageIds).mockResolvedValue([author] as never);

    const out = await messagesService.list("o1", { conversationId: "c1" });

    expect(inboxNoteAuthorRepository.findByMessageIds).toHaveBeenCalledTimes(1);
    expect(inboxNoteAuthorRepository.findByMessageIds).toHaveBeenCalledWith("o1", expect.arrayContaining(["n1", "n2"]));
    expect(out.items[0]).toEqual({ ...note, meta: { ...note.meta, ...agentMeta } });
    expect(out.items[1]).toBe(noteByMeta);
    expect(out.items[2]).toBe(plain);
  });

  it("matches a stored note id against the thread message's meta.note_id", async () => {
    const msg = { id: "msg-9", is_internal: false, meta: { is_internal_note: true, note_id: "note-9" } };
    vi.mocked(messagesRepository.list).mockResolvedValue(page([msg]) as never);
    vi.mocked(inboxNoteAuthorRepository.findByMessageIds).mockResolvedValue([
      { sendsevenMessageId: "note-9", sendsevenNoteId: null, userId: "u1", firstName: "Ann", lastName: "Lee", name: "ann", image: null },
    ] as never);

    const out = await messagesService.list("o1", {});

    expect(inboxNoteAuthorRepository.findByMessageIds).toHaveBeenCalledWith("o1", ["msg-9", "note-9"]);
    expect(out.items[0].meta).toMatchObject({ source: "travana-agent", agent: { id: "u1", name: "Ann Lee" }, note_id: "note-9" });
  });

  it("skips the lookup when the page has no internal notes", async () => {
    vi.mocked(messagesRepository.list).mockResolvedValue(page([{ id: "m1" }]) as never);
    await messagesService.list("o1", {});
    expect(inboxNoteAuthorRepository.findByMessageIds).not.toHaveBeenCalled();
  });

  it("returns the page unchanged when the author lookup fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const items = [{ id: "n1", is_internal: true }];
    vi.mocked(messagesRepository.list).mockResolvedValue(page(items) as never);
    vi.mocked(inboxNoteAuthorRepository.findByMessageIds).mockRejectedValue(new Error("db down"));
    const out = await messagesService.list("o1", {});
    expect(out.items[0]).toBe(items[0]);
  });
});

describe("messagesService.getById", () => {
  it("enriches an internal note scoped to the org", async () => {
    vi.mocked(messagesRepository.getById).mockResolvedValue({ id: "n1", is_internal: true } as never);
    vi.mocked(inboxNoteAuthorRepository.findByMessageIds).mockResolvedValue([
      { sendsevenMessageId: "n1", userId: "u1", firstName: "Ann", lastName: "Lee", name: "ann", image: null },
    ] as never);
    const out = await messagesService.getById("o1", "n1");
    expect(inboxNoteAuthorRepository.findByMessageIds).toHaveBeenCalledWith("o1", ["n1"]);
    expect(out.meta).toEqual({ source: "travana-agent", agent: { id: "u1", name: "Ann Lee", avatar: null } });
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
