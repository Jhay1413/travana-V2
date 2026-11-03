import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./channels.repository", () => ({
  channelsRepository: {
    listChannels: vi.fn(),
    channelTypes: vi.fn(),
    createConnectToken: vi.fn(),
    channelHealth: vi.fn(),
    delegateConnect: vi.fn(),
    deleteChannel: vi.fn(),
    whatsappStatus: vi.fn(),
    isConfigured: vi.fn(),
  },
}));

import { AppError } from "../../utils/error-handler";
import { channelsService } from "./channels.service";
import { channelsRepository } from "./channels.repository";

beforeEach(() => vi.clearAllMocks());

describe("channelsService", () => {
  it("listChannels forwards forCompose", async () => {
    vi.mocked(channelsRepository.listChannels).mockResolvedValue([]);
    expect(await channelsService.listChannels(true)).toEqual([]);
    expect(channelsRepository.listChannels).toHaveBeenCalledWith(true);
  });

  it("channelTypes returns the repository result", async () => {
    const t = { available: [], coming_soon: [], all_types: [] };
    vi.mocked(channelsRepository.channelTypes).mockResolvedValue(t);
    expect(await channelsService.channelTypes()).toBe(t);
  });

  it("createConnectToken forwards the body including expiry, uses and partner name", async () => {
    const body = { allowed_channel_types: ["whatsapp"], expires_in_hours: 24, max_uses: 3, partner_name: "P" };
    const r = { id: "t1", connect_url: "u", token: "x", expires_at: "e", allowed_channel_types: ["whatsapp"] };
    vi.mocked(channelsRepository.createConnectToken).mockResolvedValue(r);
    expect(await channelsService.createConnectToken(body)).toBe(r);
    expect(channelsRepository.createConnectToken).toHaveBeenCalledWith(body);
  });

  it("channelHealth returns the repository result", async () => {
    const h = { has_errors: true, error_count: 1, integrations: [] };
    vi.mocked(channelsRepository.channelHealth).mockResolvedValue(h);
    expect(await channelsService.channelHealth()).toBe(h);
  });

  it("delegateConnect forwards the body", async () => {
    const body = { email: "a@b.co", channel_types: ["instagram"], note: "hi" };
    const r = { success: true, token_id: "t", connect_url: "u", expires_at: "e", email_sent: true, sent_to: "a@b.co" };
    vi.mocked(channelsRepository.delegateConnect).mockResolvedValue(r);
    expect(await channelsService.delegateConnect(body)).toBe(r);
    expect(channelsRepository.delegateConnect).toHaveBeenCalledWith(body);
  });

  it("deleteChannel and whatsappStatus forward the id", async () => {
    vi.mocked(channelsRepository.deleteChannel).mockResolvedValue({});
    vi.mocked(channelsRepository.whatsappStatus).mockResolvedValue({ ok: 1 });
    await channelsService.deleteChannel("c1");
    expect(channelsRepository.deleteChannel).toHaveBeenCalledWith("c1");
    expect(await channelsService.whatsappStatus("c2")).toEqual({ ok: 1 });
    expect(channelsRepository.whatsappStatus).toHaveBeenCalledWith("c2");
  });

  it("workspaceStatus returns { provisioned } from the repository", async () => {
    vi.mocked(channelsRepository.isConfigured).mockReturnValue(false);
    expect(await channelsService.workspaceStatus()).toEqual({ provisioned: false });
    vi.mocked(channelsRepository.isConfigured).mockReturnValue(true);
    expect(await channelsService.workspaceStatus()).toEqual({ provisioned: true });
  });

  describe("channel type rules", () => {
    beforeEach(() => {
      vi.mocked(channelsRepository.createConnectToken).mockResolvedValue({} as never);
      vi.mocked(channelsRepository.delegateConnect).mockResolvedValue({} as never);
    });

    it("lower-cases and drops unsupported types for connect tokens", async () => {
      await channelsService.createConnectToken({ allowed_channel_types: ["WhatsApp", "sms", "instagram"] });
      expect(channelsRepository.createConnectToken).toHaveBeenCalledWith({
        allowed_channel_types: ["whatsapp", "instagram"],
      });
    });

    it("lower-cases and drops unsupported types for delegate connect", async () => {
      await channelsService.delegateConnect({ email: "a@b.co", channel_types: ["Telegram", "sms"] });
      expect(channelsRepository.delegateConnect).toHaveBeenCalledWith({ email: "a@b.co", channel_types: ["telegram"] });
    });

    it("throws a 400 AppError when nothing connectable remains", async () => {
      const p = channelsService.createConnectToken({ allowed_channel_types: ["sms"] });
      await expect(p).rejects.toBeInstanceOf(AppError);
      await expect(p).rejects.toMatchObject({ statusCode: 400 });
      await expect(channelsService.delegateConnect({ email: "a@b.co", channel_types: ["email"] })).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(channelsRepository.createConnectToken).not.toHaveBeenCalled();
      expect(channelsRepository.delegateConnect).not.toHaveBeenCalled();
    });

    it("forwards the other fields untouched", async () => {
      const body = {
        allowed_channel_types: ["whatsapp"],
        partner_name: "P",
        expires_in_hours: 12,
        max_uses: 2,
        partner_redirect_url: "https://x.co/a",
      };
      await channelsService.createConnectToken(body);
      expect(channelsRepository.createConnectToken).toHaveBeenCalledWith(body);
    });
  });
});
