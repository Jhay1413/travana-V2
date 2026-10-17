import { describe, it, expect } from "vitest";
import { aiSuggestReplyValidator, listConversationsQueryValidator } from "./conversations.validator";

const params = { conversation_id: "c1" };

describe("aiSuggestReplyValidator", () => {
  it("accepts an empty or missing body", () => {
    expect(aiSuggestReplyValidator.safeParse({ params, body: {} }).success).toBe(true);
    expect(aiSuggestReplyValidator.safeParse({ params, body: undefined }).success).toBe(true);
  });
  it("accepts a valid tone and count", () => {
    expect(aiSuggestReplyValidator.safeParse({ params, body: { tone: "short", count: 3 } }).success).toBe(true);
  });
  it("rejects an unknown tone", () => {
    expect(aiSuggestReplyValidator.safeParse({ params, body: { tone: "angry" } }).success).toBe(false);
  });
  it("rejects count 4, 0 and non-integers", () => {
    for (const count of [4, 0, 1.5]) {
      expect(aiSuggestReplyValidator.safeParse({ params, body: { count } }).success).toBe(false);
    }
  });
  it("rejects an empty conversation id", () => {
    expect(aiSuggestReplyValidator.safeParse({ params: { conversation_id: "" }, body: {} }).success).toBe(false);
  });
});

describe("listConversationsQueryValidator", () => {
  it("accepts an empty query", () => {
    expect(listConversationsQueryValidator.safeParse({ query: {} }).success).toBe(true);
  });
  it("accepts numeric strings for page/pageSize and boolean strings for needsReply", () => {
    const r = listConversationsQueryValidator.safeParse({ query: { page: "2", pageSize: "25", needsReply: "true", status: "open" } });
    expect(r.success).toBe(true);
  });
  it("accepts the snake_case aliases the client sends", () => {
    const r = listConversationsQueryValidator.safeParse({
      query: { page_size: "25", assigned_to: "u1", needs_reply: "false", inbox_id: "i1", contact_id: "c1" },
    });
    expect(r.success).toBe(true);
  });
  it("rejects invalid snake_case aliases and oversize page sizes", () => {
    expect(listConversationsQueryValidator.safeParse({ query: { needs_reply: "garbage" } }).success).toBe(false);
    expect(listConversationsQueryValidator.safeParse({ query: { assigned_to: "x".repeat(200) } }).success).toBe(false);
    expect(listConversationsQueryValidator.safeParse({ query: { page_size: "101" } }).success).toBe(false);
    expect(listConversationsQueryValidator.safeParse({ query: { pageSize: "101" } }).success).toBe(false);
  });
  it("rejects bad page, needsReply, and over-long search/assignedTo", () => {
    expect(listConversationsQueryValidator.safeParse({ query: { page: "0" } }).success).toBe(false);
    expect(listConversationsQueryValidator.safeParse({ query: { pageSize: "abc" } }).success).toBe(false);
    expect(listConversationsQueryValidator.safeParse({ query: { needsReply: "maybe" } }).success).toBe(false);
    expect(listConversationsQueryValidator.safeParse({ query: { search: "x".repeat(201) } }).success).toBe(false);
    expect(listConversationsQueryValidator.safeParse({ query: { assignedTo: "x".repeat(65) } }).success).toBe(false);
  });
  it("lets unknown keys through", () => {
    const r = listConversationsQueryValidator.safeParse({ query: { page_size: "10", other: "x" } });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.query).toMatchObject({ other: "x" });
  });
});
