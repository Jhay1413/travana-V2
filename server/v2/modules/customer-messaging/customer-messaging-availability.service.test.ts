import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../neon-client/neon-client.service", () => ({ neonClientService: { viewNeonClientById: vi.fn() } }));
vi.mock("../channels/channels.service", () => ({ channelsService: { listChannels: vi.fn() } }));
vi.mock("../contact-link/contact-link.repository", () => ({ contactLinkRepository: { findByClient: vi.fn() } }));
vi.mock("../whatsapp-templates/whatsapp-settings.service", () => ({ whatsappSettingsService: { getQuote: vi.fn(), getPinReset: vi.fn() } }));
vi.mock("../../utils/sendseven", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../utils/sendseven")>()), isSendSevenConfigured: vi.fn() }));
vi.mock("../sms/sms.service", () => ({
  isSmsConfigured: vi.fn(),
  normalisePhone: (raw: string | null | undefined) => (raw && raw.replace(/\D/g, "").length >= 10 ? `+44${raw.replace(/\D/g, "").slice(-10)}` : null),
}));
vi.mock("./customer-messaging.service", () => {
  class SettingsUnavailableError extends Error {}
  return { customerMessagingService: { getAutoChannel: vi.fn() }, SettingsUnavailableError };
});

import { customerMessagingAvailabilityService as svc, DEVICE_NOTE, UNAVAILABLE } from "./customer-messaging-availability.service";
import { neonClientService } from "../neon-client/neon-client.service";
import { channelsService } from "../channels/channels.service";
import { contactLinkRepository } from "../contact-link/contact-link.repository";
import { whatsappSettingsService } from "../whatsapp-templates/whatsapp-settings.service";
import { isSendSevenConfigured } from "../../utils/sendseven";
import { isSmsConfigured } from "../sms/sms.service";
import { customerMessagingService, SettingsUnavailableError } from "./customer-messaging.service";
import type { Scope } from "../../utils/scope";

const scope = (over: Partial<Scope> = {}): Scope => ({ orgId: "o1", branchId: null, orgRole: "agent", orgRoles: ["agent"], userId: "u1", branchType: null, ownsHomeworkerBranch: false, ...over });
const client = (over: Record<string, unknown> = {}) => ({ id: "c1", phoneNumber: "07700900123", smsOptIn: true, ...over }) as never;
const channel = { id: "ch1", channel_type: "whatsapp", is_active: true, is_verified: true };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(neonClientService.viewNeonClientById).mockResolvedValue(client());
  vi.mocked(isSendSevenConfigured).mockReturnValue(true);
  vi.mocked(isSmsConfigured).mockReturnValue(true);
  vi.mocked(channelsService.listChannels).mockResolvedValue([channel] as never);
  vi.mocked(whatsappSettingsService.getQuote).mockResolvedValue({ channelId: null, templateName: null } as never);
  vi.mocked(whatsappSettingsService.getPinReset).mockResolvedValue({ channelId: null, templateName: "signin" } as never);
  vi.mocked(contactLinkRepository.findByClient).mockResolvedValue(null as never);
  vi.mocked(customerMessagingService.getAutoChannel).mockResolvedValue("whatsapp");
});

const ask = (purpose: "quote_link" | "portal_sign_in", s: Scope = scope()) => svc.getAvailability({ clientId: "c1", purpose }, s);

describe("availability: the default channel", () => {
  it("is the agency's setting", async () => {
    vi.mocked(customerMessagingService.getAutoChannel).mockResolvedValue("sms");
    expect((await ask("quote_link")).defaultChannel).toBe("sms");
  });
  it("is WhatsApp when the setting was never stored (getAutoChannel's own default)", async () => {
    expect((await ask("quote_link")).defaultChannel).toBe("whatsapp");
  });
  it("falls back to WhatsApp when the setting cannot be read, without failing the request", async () => {
    vi.mocked(customerMessagingService.getAutoChannel).mockRejectedValue(new SettingsUnavailableError());
    expect((await ask("quote_link")).defaultChannel).toBe("whatsapp");
  });
});

describe("availability: both channels usable", () => {
  it("quote link: both available, no reasons", async () => {
    const r = await ask("quote_link");
    expect(r.channels).toEqual({ whatsapp: { available: true }, sms: { available: true } });
  });
  it("sign-in link with a template: both available", async () => {
    expect((await ask("portal_sign_in")).channels.whatsapp).toEqual({ available: true });
  });
});

describe("availability: WhatsApp is offered whenever the customer has a phone (every customer stays reachable)", () => {
  it("homeworker: available for both purposes, with the on-your-device note, and SendSeven is never asked", async () => {
    const hw = scope({ orgRole: "homeworker", orgRoles: ["homeworker"] });
    for (const purpose of ["quote_link", "portal_sign_in"] as const) {
      expect((await ask(purpose, hw)).channels.whatsapp).toEqual({ available: true, note: DEVICE_NOTE });
    }
    expect(channelsService.listChannels).not.toHaveBeenCalled();
  });
  it("a homeworker who also holds another role is still a homeworker", async () => {
    const r = await ask("quote_link", scope({ orgRole: "agent", orgRoles: ["agent", "homeworker"] }));
    expect(r.channels.whatsapp.note).toBe(DEVICE_NOTE);
  });
  it("no phone on file blocks both channels, with the reason", async () => {
    vi.mocked(neonClientService.viewNeonClientById).mockResolvedValue(client({ phoneNumber: "" }));
    const r = await ask("quote_link");
    expect(r.channels.whatsapp).toEqual({ available: false, reason: UNAVAILABLE.noPhone });
    expect(r.channels.sms).toEqual({ available: false, reason: UNAVAILABLE.noPhone });
  });
  it("WhatsApp not connected: still available, with the note", async () => {
    vi.mocked(isSendSevenConfigured).mockReturnValue(false);
    for (const purpose of ["quote_link", "portal_sign_in"] as const) {
      expect((await ask(purpose)).channels.whatsapp).toEqual({ available: true, note: DEVICE_NOTE });
    }
  });
  it("no active WhatsApp number: available with the note", async () => {
    vi.mocked(channelsService.listChannels).mockResolvedValue([] as never);
    expect((await ask("quote_link")).channels.whatsapp).toEqual({ available: true, note: DEVICE_NOTE });
  });
  it("SendSeven unreachable: available with the note, not an error", async () => {
    vi.mocked(channelsService.listChannels).mockRejectedValue(new Error("down"));
    expect((await ask("quote_link")).channels.whatsapp).toEqual({ available: true, note: DEVICE_NOTE });
  });
  it("quote link without a template is available with no note (an open chat may still take it)", async () => {
    expect((await ask("quote_link")).channels.whatsapp).toEqual({ available: true });
  });
  it("sign-in link with no template and no chat is available with the on-your-device note", async () => {
    vi.mocked(whatsappSettingsService.getPinReset).mockResolvedValue({ channelId: null, templateName: null } as never);
    expect((await ask("portal_sign_in")).channels.whatsapp).toEqual({ available: true, note: DEVICE_NOTE });
  });
  it("sign-in link with no template but a linked chat goes through the inbox: no note", async () => {
    vi.mocked(whatsappSettingsService.getPinReset).mockResolvedValue({ channelId: null, templateName: null } as never);
    vi.mocked(contactLinkRepository.findByClient).mockResolvedValue({ sendsevenContactId: "ct1" } as never);
    expect((await ask("portal_sign_in")).channels.whatsapp).toEqual({ available: true });
  });
});

describe("availability: a failing read degrades, it never errors", () => {
  it("a failing settings read gives WhatsApp-on-your-device, not an error", async () => {
    vi.mocked(whatsappSettingsService.getQuote).mockRejectedValue(new Error("settings down"));
    vi.mocked(whatsappSettingsService.getPinReset).mockRejectedValue(new Error("settings down"));
    for (const purpose of ["quote_link", "portal_sign_in"] as const) {
      expect((await ask(purpose)).channels.whatsapp).toEqual({ available: true, note: DEVICE_NOTE });
    }
  });
  it("a failing chat-link read gives WhatsApp-on-your-device for the sign-in link", async () => {
    vi.mocked(whatsappSettingsService.getPinReset).mockResolvedValue({ channelId: null, templateName: null } as never);
    vi.mocked(contactLinkRepository.findByClient).mockRejectedValue(new Error("db down"));
    expect((await ask("portal_sign_in")).channels.whatsapp).toEqual({ available: true, note: DEVICE_NOTE });
  });
});

describe("availability: SMS reasons", () => {
  it("provider not configured", async () => {
    vi.mocked(isSmsConfigured).mockReturnValue(false);
    expect((await ask("quote_link")).channels.sms).toEqual({ available: false, reason: UNAVAILABLE.smsNotConfigured });
  });
  it("customer opted out (today's rule for staff texts)", async () => {
    vi.mocked(neonClientService.viewNeonClientById).mockResolvedValue(client({ smsOptIn: false }));
    const r = await ask("portal_sign_in");
    expect(r.channels.sms).toEqual({ available: false, reason: UNAVAILABLE.optedOut });
    expect(r.channels.whatsapp.available).toBe(true);
  });
});

describe("availability: access", () => {
  it("uses the client page's own access rule, so another agency's client is a 404 before anything is read", async () => {
    const { AppError } = await import("../../utils/error-handler");
    vi.mocked(neonClientService.viewNeonClientById).mockRejectedValue(new AppError("Client not found", 404));
    await expect(ask("quote_link")).rejects.toMatchObject({ statusCode: 404 });
    expect(neonClientService.viewNeonClientById).toHaveBeenCalledWith("c1", expect.objectContaining({ orgId: "o1" }));
    expect(channelsService.listChannels).not.toHaveBeenCalled();
  });
  it("needs an organisation in scope", async () => {
    await expect(ask("quote_link", scope({ orgId: "" }))).rejects.toMatchObject({ statusCode: 400 });
  });
});
