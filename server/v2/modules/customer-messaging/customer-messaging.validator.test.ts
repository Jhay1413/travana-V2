import { describe, it, expect } from "vitest";
import {
  AUTO_TEMPLATE_SOURCES,
  purposeParamsValidator,
  saveSwitchValidator,
  saveCustomerMessagingSettingsValidator,
  savePurposeTemplateValidator,
} from "./customer-messaging.validator";

const body = (b: unknown) => ({ body: b });

describe("saveCustomerMessagingSettingsValidator", () => {
  it("accepts whatsapp and sms", () => {
    expect(saveCustomerMessagingSettingsValidator.safeParse(body({ autoChannel: "whatsapp" })).success).toBe(true);
    expect(saveCustomerMessagingSettingsValidator.safeParse(body({ autoChannel: "sms" })).success).toBe(true);
  });
  it("rejects anything else, a missing value and extra keys", () => {
    for (const b of [{ autoChannel: "email" }, {}, { autoChannel: "sms", extra: 1 }, { autoChannel: null }]) {
      expect(saveCustomerMessagingSettingsValidator.safeParse(body(b)).success).toBe(false);
    }
  });
});

describe("purposeParamsValidator", () => {
  it("accepts the four message types and nothing else", () => {
    for (const p of ["booking_confirmation", "portal_ready", "balance_reminder", "departure_reminder"]) {
      expect(purposeParamsValidator.safeParse({ params: { purpose: p } }).success).toBe(true);
    }
    for (const p of ["portal_sign_in", "quote", "", "BOOKING_CONFIRMATION"]) {
      expect(purposeParamsValidator.safeParse({ params: { purpose: p } }).success).toBe(false);
    }
  });
});

describe("savePurposeTemplateValidator", () => {
  const valid = (variables: Record<string, unknown>) => ({ templateName: "booking_ok", templateLanguage: "en_GB", channelId: "ch1", variables });

  it("accepts a template whose placeholders are mapped to the allowed sources", () => {
    const v = { "1": { source: "client_first_name" }, "2": { source: "destination" }, "3": { source: "departure_date" }, "4": { source: "custom", text: "Thanks" } };
    expect(savePurposeTemplateValidator("booking_confirmation").safeParse(body(valid(v))).success).toBe(true);
  });

  it("accepts every new source on the types that use them", () => {
    for (const source of AUTO_TEMPLATE_SOURCES.filter((s) => s !== "custom")) {
      expect(savePurposeTemplateValidator("balance_reminder").safeParse(body(valid({ "1": { source } }))).success).toBe(true);
    }
  });

  it("has no money amount source", () => {
    for (const source of ["balance_due", "balance_amount", "amount", "price"]) {
      expect(savePurposeTemplateValidator("balance_reminder").safeParse(body(valid({ "1": { source } }))).success).toBe(false);
    }
    expect(AUTO_TEMPLATE_SOURCES.some((s) => /amount|price|money|balance_due$/.test(s) && s !== "balance_due_date")).toBe(false);
  });

  it("rejects sources that belong to other templates (quote link, sign-in link, agent message)", () => {
    for (const source of ["quote_link", "sign_in_link", "message", "agent_name"]) {
      expect(savePurposeTemplateValidator("departure_reminder").safeParse(body(valid({ "1": { source } }))).success).toBe(false);
    }
  });

  it("requires fixed text for a custom placeholder", () => {
    expect(savePurposeTemplateValidator("departure_reminder").safeParse(body(valid({ "1": { source: "custom" } }))).success).toBe(false);
    expect(savePurposeTemplateValidator("departure_reminder").safeParse(body(valid({ "1": { source: "custom", text: "  " } }))).success).toBe(false);
  });

  it("requires placeholders to be numbered 1..n without gaps", () => {
    const r = savePurposeTemplateValidator("departure_reminder").safeParse(body(valid({ "1": { source: "destination" }, "3": { source: "departure_date" } })));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/no gaps/);
    expect(savePurposeTemplateValidator("departure_reminder").safeParse(body(valid({ "2": { source: "destination" } }))).success).toBe(false);
  });

  it("portal ready must carry the portal link", () => {
    const noLink = savePurposeTemplateValidator("portal_ready").safeParse(body(valid({ "1": { source: "client_first_name" } })));
    expect(noLink.success).toBe(false);
    if (!noLink.success) expect(noLink.error.issues[0].message).toMatch(/portal link/);
    expect(savePurposeTemplateValidator("portal_ready").safeParse(body(valid({ "1": { source: "client_first_name" }, "2": { source: "portal_link" } }))).success).toBe(true);
  });

  it("clearing a template (nulls and no variables) is always allowed, even for portal ready", () => {
    const cleared = { templateName: null, templateLanguage: null, channelId: null, variables: {} };
    for (const p of ["booking_confirmation", "portal_ready", "balance_reminder", "departure_reminder"] as const) {
      expect(savePurposeTemplateValidator(p).safeParse(body(cleared)).success).toBe(true);
    }
  });

  it("rejects bad template names, non-numeric keys and unknown body keys", () => {
    const v = savePurposeTemplateValidator("booking_confirmation");
    expect(v.safeParse(body({ ...valid({}), templateName: "Bad Name" })).success).toBe(false);
    expect(v.safeParse(body(valid({ one: { source: "destination" } }))).success).toBe(false);
    expect(v.safeParse(body({ ...valid({}), extra: true })).success).toBe(false);
  });
});

describe("saveSwitchValidator", () => {
  it("takes a type and a boolean, nothing else", () => {
    expect(saveSwitchValidator.safeParse({ params: { purpose: "balance_reminder" }, body: { active: true } }).success).toBe(true);
    expect(saveSwitchValidator.safeParse({ params: { purpose: "portal_sign_in" }, body: { active: true } }).success).toBe(false);
    expect(saveSwitchValidator.safeParse({ params: { purpose: "portal_ready" }, body: { active: "yes" } }).success).toBe(false);
    expect(saveSwitchValidator.safeParse({ params: { purpose: "portal_ready" }, body: { active: true, extra: 1 } }).success).toBe(false);
  });
});
