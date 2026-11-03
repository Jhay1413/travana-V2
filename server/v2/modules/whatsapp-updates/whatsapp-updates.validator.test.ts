import { describe, it, expect } from "vitest";
import {
  saveUpdateTemplateSettingsValidator,
  sendToClientValidator,
  sendToConversationValidator,
  windowValidator,
} from "./whatsapp-updates.validator";

const C = "22222222-2222-4222-8222-222222222222";

describe("sendToConversationValidator", () => {
  const parse = (body: unknown, params: unknown = { conversationId: "conv1" }) => sendToConversationValidator.safeParse({ params, body });

  it("accepts text and trims it", () => {
    const r = parse({ text: "  hello  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.body.text).toBe("hello");
  });
  it("rejects empty and whitespace-only text", () => {
    expect(parse({ text: "" }).success).toBe(false);
    expect(parse({ text: "   " }).success).toBe(false);
  });
  it("accepts exactly 700 characters and rejects 701", () => {
    expect(parse({ text: "a".repeat(700) }).success).toBe(true);
    expect(parse({ text: "a".repeat(701) }).success).toBe(false);
  });
  it("rejects extra keys, a missing text and an empty conversation id", () => {
    expect(parse({ text: "hi", extra: 1 }).success).toBe(false);
    expect(parse({}).success).toBe(false);
    expect(parse({ text: "hi" }, { conversationId: "" }).success).toBe(false);
  });
});

describe("windowValidator", () => {
  it("needs a conversation id", () => {
    expect(windowValidator.safeParse({ params: { conversationId: "c1" } }).success).toBe(true);
    expect(windowValidator.safeParse({ params: { conversationId: "" } }).success).toBe(false);
  });
});

describe("sendToClientValidator", () => {
  const parse = (body: unknown, params: unknown = { clientId: C }) => sendToClientValidator.safeParse({ params, body });

  it("accepts a channel id and text", () => {
    expect(parse({ channelId: "ch1", text: "hi" }).success).toBe(true);
  });
  it("rejects a non-uuid client id, a missing channel and bad text", () => {
    expect(parse({ channelId: "ch1", text: "hi" }, { clientId: "x" }).success).toBe(false);
    expect(parse({ text: "hi" }).success).toBe(false);
    expect(parse({ channelId: "", text: "hi" }).success).toBe(false);
    expect(parse({ channelId: "ch1", text: "a".repeat(701) }).success).toBe(false);
    expect(parse({ channelId: "ch1", text: "  " }).success).toBe(false);
  });
  it("rejects extra keys", () => {
    expect(parse({ channelId: "ch1", text: "hi", extra: 1 }).success).toBe(false);
  });
});

describe("saveUpdateTemplateSettingsValidator", () => {
  const base = { templateName: "general_update", templateLanguage: "en_GB", channelId: "ch1" };
  const parse = (variables: unknown, over: Record<string, unknown> = {}) =>
    saveUpdateTemplateSettingsValidator.safeParse({ body: { ...base, variables, ...over } });

  it("accepts exactly one message placeholder", () => {
    expect(parse({ "1": { source: "client_first_name" }, "2": { source: "message" } }).success).toBe(true);
  });
  it("rejects zero or two message placeholders", () => {
    expect(parse({ "1": { source: "client_first_name" } }).success).toBe(false);
    expect(parse({ "1": { source: "message" }, "2": { source: "message" } }).success).toBe(false);
  });
  it("rejects quote_link for an update template", () => {
    expect(parse({ "1": { source: "quote_link" }, "2": { source: "message" } }).success).toBe(false);
  });
  it("accepts clearing the template with no placeholders", () => {
    expect(parse({}, { templateName: null, templateLanguage: null, channelId: null }).success).toBe(true);
  });
});
