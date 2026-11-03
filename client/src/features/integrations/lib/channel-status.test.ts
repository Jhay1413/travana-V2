import { describe, expect, it } from "vitest";
import { channelLabel, channelStatus, healthFor, channelSubtitle, connectRedirectUrl, connectableTypes } from "./channel-status";
import type { ChannelHealth, ChannelHealthIntegration } from "../types";

const base = { id: "c1", name: "x", channel_type: "whatsapp", is_active: true, activation_status: null, setup_pending_reason: null };
const health = (over: Partial<ChannelHealthIntegration>): ChannelHealth => ({
  has_errors: true,
  error_count: 1,
  integrations: [
    {
      id: "c1",
      name: "x",
      channel_type: "whatsapp",
      integration_type: null,
      connection_status: "disconnected",
      last_error: "token_invalidated",
      last_error_at: null,
      email_address: null,
      ...over,
    },
  ],
});

describe("channelStatus", () => {
  it("is connected when active and complete", () => {
    expect(channelStatus(base, null)).toMatchObject({ kind: "connected", tone: "good" });
  });
  it("flags AVAILABLE activation as setup incomplete", () => {
    expect(channelStatus({ ...base, activation_status: "AVAILABLE" }).kind).toBe("setup_incomplete");
  });
  it("flags a pending reason as setup incomplete", () => {
    expect(channelStatus({ ...base, setup_pending_reason: "coexistence_setup_incomplete" }).kind).toBe("setup_incomplete");
  });
  it("flags invalidated tokens as needs reconnect, matched by id", () => {
    expect(channelStatus(base, health({})).kind).toBe("needs_reconnect");
    expect(channelStatus(base, health({ id: "other", name: "other" })).kind).toBe("connected");
    expect(channelStatus(base, health({ last_error: "other" })).kind).toBe("connected");
  });
  it("is inactive when not active", () => {
    expect(channelStatus({ ...base, is_active: false }).kind).toBe("inactive");
  });
});

describe("healthFor", () => {
  it("matches by id", () => {
    expect(healthFor(base, health({}))?.id).toBe("c1");
  });
  it("matches by channel_type + name when ids differ", () => {
    expect(healthFor(base, health({ id: "zzz" }))?.id).toBe("zzz");
    expect(healthFor(base, health({ id: "zzz", name: "other" }))).toBeUndefined();
    expect(healthFor(base, health({ id: "zzz", channel_type: "instagram" }))).toBeUndefined();
    expect(channelStatus(base, health({ id: "zzz" })).kind).toBe("needs_reconnect");
  });
  it("ignores healthy entries", () => {
    expect(healthFor(base, health({ connection_status: "connected" }))).toBeUndefined();
    expect(healthFor(base, health({ last_error: null }))).toBeUndefined();
    expect(healthFor(base, null)).toBeUndefined();
  });
});

describe("connectableTypes", () => {
  it("filters and orders", () => {
    expect(connectableTypes({ available: ["telegram", "sms", "whatsapp", "instagram"] })).toEqual([
      "whatsapp",
      "instagram",
      "telegram",
    ]);
  });
  it("falls back when empty", () => {
    expect(connectableTypes({ available: [] })).toEqual(["whatsapp", "messenger", "instagram"]);
    expect(connectableTypes(undefined)).toEqual(["whatsapp", "messenger", "instagram"]);
    expect(connectableTypes({ available: ["sms"] })).toEqual(["whatsapp", "messenger", "instagram"]);
  });
});

describe("channelLabel", () => {
  it("maps known types and capitalises others", () => {
    expect(channelLabel("messenger")).toBe("Facebook Messenger");
    expect(channelLabel("WhatsApp")).toBe("WhatsApp");
    expect(channelLabel("telegram")).toBe("Telegram");
    expect(channelLabel("line")).toBe("Line");
  });
});

describe("connectRedirectUrl", () => {
  it("only returns a url on https", () => {
    expect(connectRedirectUrl("https://a.com", "https:")).toBe("https://a.com/agency/integrations");
    expect(connectRedirectUrl("http://localhost:5000", "http:")).toBeUndefined();
  });
});

describe("channelSubtitle", () => {
  const ch = { phone_number_formatted: null, identifier: null, channel_type: "instagram", is_coexistence: false };
  it("prefers phone, then identifier, then type", () => {
    expect(channelSubtitle({ ...ch, phone_number_formatted: "+44 1", identifier: "id" })).toBe("+44 1");
    expect(channelSubtitle({ ...ch, identifier: "id" })).toBe("id");
    expect(channelSubtitle(ch)).toBe("instagram");
  });
  it("appends coexistence", () => {
    expect(channelSubtitle({ ...ch, identifier: "id", is_coexistence: true })).toBe("id · coexistence");
  });
});
