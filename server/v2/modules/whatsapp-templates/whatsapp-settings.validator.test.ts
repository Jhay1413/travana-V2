import { describe, it, expect } from "vitest";
import { quoteTemplateSettingsBody, updateTemplateSettingsBody } from "./whatsapp-settings.validator";

const base = { templateName: "general_update", templateLanguage: "en", channelId: "ch1" };
const clear = { templateName: null, templateLanguage: null, channelId: null, variables: {} };

describe("updateTemplateSettingsBody", () => {
  const parse = (body: unknown) => updateTemplateSettingsBody.safeParse(body);
  const msg = (r: ReturnType<typeof parse>) => (r.success ? null : r.error.issues.map((i) => i.message));

  it("accepts exactly one message placeholder", () => {
    expect(parse({ ...base, variables: { "1": { source: "client_first_name" }, "2": { source: "message" } } }).success).toBe(true);
  });

  it("rejects no message placeholder", () => {
    expect(msg(parse({ ...base, variables: { "1": { source: "client_first_name" } } }))).toContain("One placeholder must hold the agent's message");
    expect(parse({ ...base, variables: {} }).success).toBe(false);
  });

  it("rejects two message placeholders", () => {
    expect(msg(parse({ ...base, variables: { "1": { source: "message" }, "2": { source: "message" } } }))).toContain(
      "Only one placeholder can hold the agent's message",
    );
  });

  it("accepts a clear without any message placeholder", () => {
    expect(parse(clear).success).toBe(true);
  });

  it("rejects quote_link", () => {
    expect(parse({ ...base, variables: { "1": { source: "quote_link" }, "2": { source: "message" } } }).success).toBe(false);
  });

  it("still enforces the shared rules", () => {
    const ok = { "1": { source: "message" } };
    expect(parse({ ...base, variables: ok, extra: 1 }).success).toBe(false);
    expect(parse({ ...base, templateName: "Bad Name", variables: ok }).success).toBe(false);
    expect(parse({ ...base, variables: { a: { source: "message" } } }).success).toBe(false);
    expect(parse({ ...base, variables: { ...ok, "2": { source: "custom" } } }).success).toBe(false);
  });
});

describe("quoteTemplateSettingsBody", () => {
  const parse = (body: unknown) => quoteTemplateSettingsBody.safeParse(body);

  it("accepts quote_link and no message placeholder", () => {
    expect(parse({ ...base, templateName: "quote_ready", variables: { "1": { source: "quote_link" } } }).success).toBe(true);
    expect(parse(clear).success).toBe(true);
  });

  it("rejects the message source", () => {
    expect(parse({ ...base, variables: { "1": { source: "message" } } }).success).toBe(false);
  });
});
