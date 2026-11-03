import { describe, expect, it } from "vitest";
import { buildThread, groupByDay } from "./thread-model";
import type { TicketReply } from "@/features/reply";
import type { Ticket } from "../types";

const ticket: Ticket = {
  id: "t1",
  clientId: "c1",
  userId: "u1",
  assignedTo: null,
  type: "Sales",
  status: "Open",
  priority: "Medium",
  subject: "S",
  description: "<p>Hello</p>",
  dueDate: null,
  createdAt: "2026-10-10T09:00:00Z",
  updatedAt: null,
  resolvedAt: null,
  userName: "Tina Love",
  likeCount: 2,
  likedByMe: true,
};

function reply(id: string, at: string, over: Partial<TicketReply> = {}): TicketReply {
  return {
    id,
    ticketId: "t1",
    userId: "u2",
    parentReplyId: null,
    content: id,
    createdAt: at,
    updatedAt: null,
    likeCount: 0,
    likedByMe: false,
    ...over,
  };
}

const users = [
  { id: "u1", name: "Tina Love", image: "t.png" },
  { id: "u2", name: "James Love", image: null },
];

describe("buildThread", () => {
  it("starts with the description as the ticket's own note", () => {
    const [first] = buildThread(ticket, [], users);
    expect(first.note).toMatchObject({ id: "ticket-t1", reply: null, authorName: "Tina Love", authorImage: "t.png", likeCount: 2, likedByMe: true });
  });

  it("skips the description note when there is none", () => {
    expect(buildThread({ ...ticket, description: null }, [], users)).toEqual([]);
  });

  it("adds an opening note for ticket-level files when there is no description", () => {
    const noDesc = { ...ticket, description: null };
    const [first] = buildThread(noDesc, [], users, true);
    expect(first.note).toMatchObject({ id: "ticket-t1", content: "Opened the ticket", authorName: "Tina Love", reply: null });
    expect(buildThread(noDesc, [], users, false)).toEqual([]);
  });

  it("nests replies one level deep, oldest first", () => {
    const items = buildThread(ticket, [
      reply("child2", "2026-10-11T12:00:00Z", { parentReplyId: "top" }),
      reply("top", "2026-10-11T10:00:00Z"),
      reply("child1", "2026-10-11T11:00:00Z", { parentReplyId: "top" }),
      reply("later", "2026-10-12T10:00:00Z"),
    ], users);
    expect(items.map((i) => i.note.id)).toEqual(["ticket-t1", "top", "later"]);
    expect(items[1].children.map((c) => c.id)).toEqual(["child1", "child2"]);
    expect(items[1].note.authorName).toBe("James Love");
  });

  it("shows a reply with a missing parent at top level", () => {
    const items = buildThread(ticket, [reply("orphan", "2026-10-11T10:00:00Z", { parentReplyId: "gone" })], users);
    expect(items.map((i) => i.note.id)).toEqual(["ticket-t1", "orphan"]);
  });

  it("falls back to Unknown for an author it cannot find", () => {
    const items = buildThread({ ...ticket, description: null }, [reply("r", "2026-10-11T10:00:00Z", { userId: "nobody" })], users);
    expect(items[0].note.authorName).toBe("Unknown");
  });
});

describe("groupByDay", () => {
  it("starts a new group whenever the day label changes", () => {
    const items = buildThread(ticket, [
      reply("a", "2026-10-10T10:00:00Z"),
      reply("b", "2026-10-11T10:00:00Z"),
      reply("c", "2026-10-11T12:00:00Z"),
    ], users);
    const groups = groupByDay(items, (iso) => iso.slice(0, 10));
    expect(groups.map((g) => [g.day, g.items.map((i) => i.note.id)])).toEqual([
      ["2026-10-10", ["ticket-t1", "a"]],
      ["2026-10-11", ["b", "c"]],
    ]);
  });
});
