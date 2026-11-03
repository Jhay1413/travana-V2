import { describe, it, expect } from "vitest";
import { markSentValidator, saveWhatsappTemplateSettingsValidator } from "./quote-share.validator";

const id = "3f2b8c1e-5d4a-4e6b-9c7d-1a2b3c4d5e6f";
const parse = (body: unknown, params: unknown = { id }) => markSentValidator.safeParse({ params, body });

describe("markSentValidator", () => {
  it.each(["link", "sms", "email", "whatsapp"])("accepts sentVia %s", (sentVia) => {
    expect(parse({ sentVia }).success).toBe(true);
  });

  it("rejects an unknown channel", () => {
    const r = parse({ sentVia: "carrier-pigeon" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.errors[0].message).toContain("sentVia must be one of");
  });

  it("rejects a missing sentVia, the old via key and extra keys", () => {
    expect(parse({}).success).toBe(false);
    expect(parse({ via: "link" }).success).toBe(false);
    expect(parse({ sentVia: "link", extra: 1 }).success).toBe(false);
  });

  it("rejects a non-uuid id", () => {
    expect(parse({ sentVia: "link" }, { id: "x" }).success).toBe(false);
  });
});

describe("saveWhatsappTemplateSettingsValidator", () => {
  const ok = { templateName: "quote_ready", templateLanguage: "en_GB", channelId: "ch1", variables: { "1": { source: "client_first_name" }, "2": { source: "custom", text: "Hi" } } };
  const parse = (body: unknown) => saveWhatsappTemplateSettingsValidator.safeParse({ body });

  it("accepts a full config and an all-null clear", () => {
    expect(parse(ok).success).toBe(true);
    expect(parse({ templateName: null, templateLanguage: null, channelId: null, variables: {} }).success).toBe(true);
  });

  it("rejects an empty channelId string", () => {
    expect(parse({ ...ok, channelId: "" }).success).toBe(false);
  });

  it("rejects bad template names, languages and extra keys", () => {
    expect(parse({ ...ok, templateName: "Quote Ready" }).success).toBe(false);
    expect(parse({ ...ok, templateName: "" }).success).toBe(false);
    expect(parse({ ...ok, templateName: "a".repeat(513) }).success).toBe(false);
    expect(parse({ ...ok, templateLanguage: "e" }).success).toBe(false);
    expect(parse({ ...ok, extra: 1 }).success).toBe(false);
  });

  it("rejects non-numeric keys, unknown sources and custom without text", () => {
    expect(parse({ ...ok, variables: { a: { source: "quote_link" } } }).success).toBe(false);
    expect(parse({ ...ok, variables: { "1": { source: "nope" } } }).success).toBe(false);
    expect(parse({ ...ok, variables: { "1": { source: "custom" } } }).success).toBe(false);
    expect(parse({ ...ok, variables: { "1": { source: "custom", text: "" } } }).success).toBe(false);
    expect(parse({ ...ok, variables: { "1": { source: "custom", text: "x".repeat(201) } } }).success).toBe(false);
  });
});
