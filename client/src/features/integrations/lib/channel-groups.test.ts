import { describe, expect, it } from "vitest";
import type { SsChannel } from "@/features/conversations";
import { groupChannelsByType, groupStatus } from "./channel-groups";
import type { ChannelHealth } from "../types";

const ch = (over: Partial<SsChannel>): SsChannel => ({ id: "c1", channel_type: "whatsapp", name: "Main", is_active: true, ...over });

describe("groupChannelsByType", () => {
  it("lists connectable types in the fixed order, even with no channels", () => {
    const groups = groupChannelsByType(["instagram", "whatsapp"], []);
    expect(groups.map((g) => g.type)).toEqual(["whatsapp", "instagram"]);
    expect(groups.every((g) => g.connectable && g.channels.length === 0)).toBe(true);
  });

  it("puts each channel under its type regardless of case", () => {
    const groups = groupChannelsByType(["whatsapp", "messenger"], [ch({ id: "a", channel_type: "WhatsApp" }), ch({ id: "b", channel_type: "whatsapp" })]);
    expect(groups[0]).toMatchObject({ type: "whatsapp", channels: [{ id: "a" }, { id: "b" }] });
    expect(groups[1].channels).toEqual([]);
  });

  it("appends non-connectable types the org already has, after the connectable ones", () => {
    const groups = groupChannelsByType(["whatsapp"], [ch({ id: "e", channel_type: "email" }), ch({ id: "w" })]);
    expect(groups.map((g) => [g.type, g.connectable])).toEqual([
      ["whatsapp", true],
      ["email", false],
    ]);
  });

  it("keeps unknown connectable types after the known ones", () => {
    const groups = groupChannelsByType(["viber", "whatsapp"], []);
    expect(groups.map((g) => g.type)).toEqual(["whatsapp", "viber"]);
  });
});

describe("groupStatus", () => {
  const health: ChannelHealth = {
    has_errors: true,
    error_count: 1,
    integrations: [
      { id: "bad", name: "Main", channel_type: "whatsapp", integration_type: null, connection_status: "disconnected", last_error: "token_invalidated", last_error_at: null, email_address: null },
    ],
  };

  it("is Not connected with no channels", () => {
    expect(groupStatus([])).toEqual({ kind: "none", label: "Not connected", tone: "plain" });
  });

  it("prefers reconnect over everything else", () => {
    expect(groupStatus([ch({ id: "ok" }), ch({ id: "bad" })], health).kind).toBe("needs_reconnect");
  });

  it("then setup incomplete", () => {
    expect(groupStatus([ch({ id: "ok" }), ch({ id: "x", activation_status: "AVAILABLE" })]).kind).toBe("setup_incomplete");
  });

  it("counts connected channels in the label", () => {
    expect(groupStatus([ch({ id: "a" }), ch({ id: "b" })]).label).toBe("2 connected");
    expect(groupStatus([ch({ id: "a" })]).label).toBe("Connected");
  });

  it("is Inactive when every channel is inactive", () => {
    expect(groupStatus([ch({ id: "a", is_active: false })])).toMatchObject({ kind: "inactive", tone: "plain" });
  });
});
