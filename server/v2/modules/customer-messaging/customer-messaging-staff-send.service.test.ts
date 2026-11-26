import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../neon-client/neon-client.repository", () => ({ neonClientRepository: { setPortalPin: vi.fn() } }));
vi.mock("../neon-client/neon-client.service", () => ({ neonClientService: { getNeonClientById: vi.fn() } }));
vi.mock("../organization/organization.repository", () => ({ organizationRepository: { findById: vi.fn() } }));
vi.mock("../portal/portal-auth", () => ({ MAGIC_LINK_TTL_MS: 48 * 3_600_000, STAFF_LINK_TTL_HOURS: 48 }));
vi.mock("../portal/portal-login-token.repository", () => ({
  portalLoginTokenRepository: { create: vi.fn(), retireStaffLinks: vi.fn(), countStaffLinksSince: vi.fn() },
}));
vi.mock("./customer-messaging.repository", () => ({ customerMessagingRepository: { countStaffSignInSince: vi.fn() } }));
vi.mock("../portal/portal-pin-reset-sender", () => ({ sendPinResetWhatsapp: vi.fn() }));
vi.mock("../quote-share/quote-share.service", () => ({ quoteShareService: { verifyAccess: vi.fn() } }));
vi.mock("../quote-share/quote-whatsapp.service", () => ({ quoteWhatsappService: { send: vi.fn() } }));
vi.mock("../sms/sms.repository", () => ({ smsRepository: { findTemplateByCategory: vi.fn() } }));
vi.mock("../sms/sms.service", () => ({
  buildContextForClient: vi.fn(),
  mergeTemplate: (body: string, ctx: Record<string, string>) => body.replace(/\{\{?\s*(\w+)\s*\}?\}/g, (_m, k: string) => ctx[k] ?? ""),
  buildPublicQuoteMessage: vi.fn(),
  isSmsConfigured: vi.fn(),
  normalisePhone: (raw: string | null | undefined) => (raw ? `+44${raw.replace(/\D/g, "").slice(-10)}` : null),
  resolveQuoteToken: vi.fn(),
  sendTrackedSms: vi.fn(),
}));
vi.mock("../user/user.repository", () => ({ userRepository: { findById: vi.fn() } }));
vi.mock("../whatsapp-templates/whatsapp-settings.service", () => ({ whatsappSettingsService: { getQuote: vi.fn(), getPinReset: vi.fn() } }));
vi.mock("../../utils/public-url", () => ({ getPublicBaseUrl: vi.fn() }));
vi.mock("./customer-messaging.service", () => ({ customerMessagingService: { recordOutcome: vi.fn() } }));

import { customerMessagingStaffSendService as svc } from "./customer-messaging-staff-send.service";
import { neonClientRepository } from "../neon-client/neon-client.repository";
import { neonClientService } from "../neon-client/neon-client.service";
import { organizationRepository } from "../organization/organization.repository";
import { portalLoginTokenRepository } from "../portal/portal-login-token.repository";
import { customerMessagingRepository } from "./customer-messaging.repository";
import { STAFF_LINK_DAILY_CAP } from "./customer-messaging-staff-send.service";
import { sendPinResetWhatsapp } from "../portal/portal-pin-reset-sender";
import { quoteShareService } from "../quote-share/quote-share.service";
import { quoteWhatsappService } from "../quote-share/quote-whatsapp.service";
import { smsRepository } from "../sms/sms.repository";
import { buildContextForClient, buildPublicQuoteMessage, isSmsConfigured, resolveQuoteToken, sendTrackedSms } from "../sms/sms.service";
import { userRepository } from "../user/user.repository";
import { whatsappSettingsService } from "../whatsapp-templates/whatsapp-settings.service";
import { getPublicBaseUrl } from "../../utils/public-url";
import { customerMessagingService } from "./customer-messaging.service";
import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";

const QUOTE = "11111111-1111-4111-8111-111111111111";
let counter = 0;
const scope = (over: Partial<Scope> = {}): Scope => ({ orgId: "o1", branchId: null, orgRole: "agent", orgRoles: ["agent"], userId: "u1", branchType: null, ownsHomeworkerBranch: false, ...over });
// A fresh client per test: the 60-second duplicate guards are per process and keyed by client.
const newClient = (over: Record<string, unknown> = {}) => ({ id: `c${++counter}`, firstName: "Sam", surename: "Lee", phoneNumber: "07700900123", smsOptIn: true, portalPin: "hash", ...over });
const record = vi.mocked(customerMessagingService.recordOutcome);

function setup(clientOver: Record<string, unknown> = {}) {
  const c = newClient(clientOver);
  vi.mocked(neonClientService.getNeonClientById).mockResolvedValue(c as never);
  return c;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(isSmsConfigured).mockReturnValue(true);
  vi.mocked(getPublicBaseUrl).mockReturnValue("https://app.example");
  vi.mocked(userRepository.findById).mockResolvedValue({ firstName: "Ann", lastName: "Agent", email: "a@x" } as never);
  vi.mocked(organizationRepository.findById).mockResolvedValue({ name: "Tina Travel" } as never);
  vi.mocked(resolveQuoteToken).mockResolvedValue({ id: QUOTE, token: "tok" });
  vi.mocked(buildPublicQuoteMessage).mockReturnValue({ text: "Hi Sam, your quote is ready", quoteUrl: "https://app.example/view-quote/tok" });
  vi.mocked(sendTrackedSms).mockResolvedValue({ ok: true, providerMessageId: "sid" });
  vi.mocked(portalLoginTokenRepository.create).mockResolvedValue("CODE");
  vi.mocked(portalLoginTokenRepository.countStaffLinksSince).mockResolvedValue(0);
  vi.mocked(buildContextForClient).mockResolvedValue({ first_name: "Sam", company_name: "Tina Travel", portal_credentials: "your email and the PIN we shared" });
  vi.mocked(whatsappSettingsService.getQuote).mockResolvedValue({ templateName: "quote_tpl" } as never);
  vi.mocked(whatsappSettingsService.getPinReset).mockResolvedValue({ templateName: "signin_tpl" } as never);
});

const send = (input: { clientId: string; purpose: "quote_link" | "portal_sign_in"; channel: "whatsapp" | "sms"; quoteId?: string }, s: Scope = scope()) => svc.send(input, "u1", s);

describe("quote link + WhatsApp: the existing quote WhatsApp service, nothing else", () => {
  it("calls quoteWhatsappService.send with this quote, never the SMS provider", async () => {
    const c = setup();
    vi.mocked(quoteWhatsappService.send).mockResolvedValue({ status: "sent", conversationId: "cv1", viaTemplate: true });
    const r = await send({ clientId: c.id, purpose: "quote_link", channel: "whatsapp", quoteId: QUOTE });
    expect(r).toEqual({ status: "sent", channel: "whatsapp", viaTemplate: true });
    expect(quoteWhatsappService.send).toHaveBeenCalledWith(QUOTE, c.id, "u1", expect.objectContaining({ orgId: "o1" }));
    expect(sendTrackedSms).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ purpose: "quote_link", channel: "whatsapp", triggerSource: "staff", actorId: "u1", templateName: "quote_tpl", outcome: { status: "sent" } }));
  });
  it("an in-window text logs no template name", async () => {
    const c = setup();
    vi.mocked(quoteWhatsappService.send).mockResolvedValue({ status: "sent", conversationId: "cv1" });
    expect(await send({ clientId: c.id, purpose: "quote_link", channel: "whatsapp", quoteId: QUOTE })).toEqual({ status: "sent", channel: "whatsapp", viaTemplate: false });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ templateName: null }));
  });
  it("hands the wa.me fallback back unchanged and logs it as staff_fallback, with nothing sent by SMS", async () => {
    const c = setup();
    vi.mocked(quoteWhatsappService.send).mockResolvedValue({ status: "fallback", reason: "window_closed", text: "Hi", quoteUrl: "https://q" });
    const r = await send({ clientId: c.id, purpose: "quote_link", channel: "whatsapp", quoteId: QUOTE });
    expect(r).toEqual({ status: "fallback", channel: "whatsapp", fallback: { reason: "window_closed", text: "Hi", quoteUrl: "https://q" } });
    expect(sendTrackedSms).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ channel: "whatsapp", outcome: { status: "skipped", reason: "staff_fallback" } }));
  });
  it("a failed template still hands over the wa.me fallback (staff_fallback) and keeps the detail", async () => {
    const c = setup();
    vi.mocked(quoteWhatsappService.send).mockResolvedValue({ status: "fallback", reason: "template_failed", text: "Hi", quoteUrl: "u", detail: "rejected" });
    const r = await send({ clientId: c.id, purpose: "quote_link", channel: "whatsapp", quoteId: QUOTE });
    expect(r).toMatchObject({ status: "fallback", fallback: { reason: "template_failed", detail: "rejected" } });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ outcome: { status: "skipped", reason: "staff_fallback" } }));
  });
  it("every reason the quote service falls back for (including a homeworker) reaches the staff member as the fallback, never a 403", async () => {
    for (const reason of ["not_allowed", "not_configured", "no_contact", "no_channel", "window_closed", "template_failed"] as const) {
      const c = setup();
      vi.mocked(quoteWhatsappService.send).mockResolvedValue({ status: "fallback", reason, text: "Hi", quoteUrl: "https://q" });
      const r = await send({ clientId: c.id, purpose: "quote_link", channel: "whatsapp", quoteId: QUOTE }, scope({ orgRole: "homeworker", orgRoles: ["homeworker"] }));
      expect(r).toMatchObject({ status: "fallback", fallback: { reason } });
    }
  });
  it("a provider failure is logged as send_failed and rethrown; an access refusal is not logged", async () => {
    const c = setup();
    vi.mocked(quoteWhatsappService.send).mockRejectedValueOnce(new AppError("boom", 502));
    await expect(send({ clientId: c.id, purpose: "quote_link", channel: "whatsapp", quoteId: QUOTE })).rejects.toMatchObject({ statusCode: 502 });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ outcome: { status: "skipped", reason: "send_failed" } }));
    record.mockClear();
    vi.mocked(quoteWhatsappService.send).mockRejectedValueOnce(new AppError("Access denied", 403));
    await expect(send({ clientId: c.id, purpose: "quote_link", channel: "whatsapp", quoteId: QUOTE })).rejects.toMatchObject({ statusCode: 403 });
    expect(record).not.toHaveBeenCalled();
  });
});

describe("quote link + SMS: the public quote message through the tracked SMS, never WhatsApp", () => {
  it("sends once, with the staff member recorded, and never calls the WhatsApp service", async () => {
    const c = setup();
    const r = await send({ clientId: c.id, purpose: "quote_link", channel: "sms", quoteId: QUOTE });
    expect(r).toEqual({ status: "sent", channel: "sms" });
    expect(sendTrackedSms).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendTrackedSms).mock.calls[0][0]).toMatchObject({ orgId: "o1", clientId: c.id, body: "Hi Sam, your quote is ready", triggeredBy: "u1", triggeredByName: "Ann Agent", triggerSource: "staff.quote-link" });
    expect(quoteWhatsappService.send).not.toHaveBeenCalled();
    expect(quoteShareService.verifyAccess).toHaveBeenCalledWith(QUOTE, "u1", expect.anything());
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ purpose: "quote_link", channel: "sms", triggerSource: "staff", actorId: "u1", outcome: { status: "sent" } }));
  });
  it("signs the text with the customer's own agency name, from the organisation record", async () => {
    const c = setup();
    await send({ clientId: c.id, purpose: "quote_link", channel: "sms", quoteId: QUOTE });
    expect(buildPublicQuoteMessage).toHaveBeenCalledWith(expect.objectContaining({ companyName: "Tina Travel" }));
    vi.mocked(organizationRepository.findById).mockResolvedValue(null);
    const d = setup();
    await send({ clientId: d.id, purpose: "quote_link", channel: "sms", quoteId: QUOTE });
    expect(buildPublicQuoteMessage).toHaveBeenLastCalledWith(expect.objectContaining({ companyName: null }));
  });
  it("a customer who opted out is not texted", async () => {
    const c = setup({ smsOptIn: false });
    const r = await send({ clientId: c.id, purpose: "quote_link", channel: "sms", quoteId: QUOTE });
    expect(r).toMatchObject({ status: "not_sent", channel: "sms", reason: "opted_out", message: "Customer opted out." });
    expect(sendTrackedSms).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ outcome: { status: "skipped", reason: "opted_out" } }));
  });
  it("no phone and SMS not configured are not sent", async () => {
    const noPhone = setup({ phoneNumber: "" });
    expect(await send({ clientId: noPhone.id, purpose: "quote_link", channel: "sms", quoteId: QUOTE })).toMatchObject({ status: "not_sent", reason: "no_phone" });
    const c = setup();
    vi.mocked(isSmsConfigured).mockReturnValue(false);
    expect(await send({ clientId: c.id, purpose: "quote_link", channel: "sms", quoteId: QUOTE })).toMatchObject({ status: "not_sent", reason: "not_configured" });
    expect(sendTrackedSms).not.toHaveBeenCalled();
  });
  it("a provider rejection is not sent and nothing goes out on WhatsApp", async () => {
    const c = setup();
    vi.mocked(sendTrackedSms).mockResolvedValue({ ok: false, error: "rejected" });
    expect(await send({ clientId: c.id, purpose: "quote_link", channel: "sms", quoteId: QUOTE })).toMatchObject({ status: "not_sent", reason: "send_failed" });
    expect(quoteWhatsappService.send).not.toHaveBeenCalled();
    expect(sendPinResetWhatsapp).not.toHaveBeenCalled();
  });
  it("a quote with no link is not sent", async () => {
    const c = setup();
    vi.mocked(resolveQuoteToken).mockResolvedValue(undefined);
    expect(await send({ clientId: c.id, purpose: "quote_link", channel: "sms", quoteId: QUOTE })).toMatchObject({ status: "not_sent", reason: "no_quote_link" });
  });
  it("a second send of the same quote inside a minute is refused (429)", async () => {
    const c = setup();
    await send({ clientId: c.id, purpose: "quote_link", channel: "sms", quoteId: QUOTE });
    await expect(send({ clientId: c.id, purpose: "quote_link", channel: "sms", quoteId: QUOTE })).rejects.toMatchObject({ statusCode: 429 });
    expect(sendTrackedSms).toHaveBeenCalledTimes(1);
  });
  it("requires a quote id", async () => {
    const c = setup();
    await expect(send({ clientId: c.id, purpose: "quote_link", channel: "sms" })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("portal sign-in link + SMS", () => {
  it("mints a 48-hour single-use link labelled staff and texts it with the lifetime in the text, never touching WhatsApp", async () => {
    const c = setup();
    const r = await send({ clientId: c.id, purpose: "portal_sign_in", channel: "sms" });
    expect(r).toEqual({ status: "sent", channel: "sms" });
    expect(portalLoginTokenRepository.create).toHaveBeenCalledWith(c.id, 48 * 3_600_000, "staff");
    const body = vi.mocked(sendTrackedSms).mock.calls[0][0].body;
    expect(body).toContain("https://app.example/portal/login?mt=CODE");
    expect(body).toContain("valid for 48 hours");
    expect(body).not.toContain("1234");
    expect(sendPinResetWhatsapp).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ purpose: "portal_sign_in", channel: "sms", triggerSource: "staff", actorId: "u1" }));
  });
  it("a customer with a PIN keeps it: nothing is written to their PIN", async () => {
    const c = setup({ portalPin: "hash" });
    await send({ clientId: c.id, purpose: "portal_sign_in", channel: "sms" });
    expect(neonClientRepository.setPortalPin).not.toHaveBeenCalled();
  });
  it("a customer with no PIN is flagged to choose one: no PIN hash is written, and never 1234", async () => {
    const c = setup({ portalPin: null });
    await send({ clientId: c.id, purpose: "portal_sign_in", channel: "sms" });
    expect(neonClientRepository.setPortalPin).toHaveBeenCalledWith(c.id, null, { mustChange: true });
  });
  it("an opted-out customer gets no link minted", async () => {
    const c = setup({ smsOptIn: false });
    expect(await send({ clientId: c.id, purpose: "portal_sign_in", channel: "sms" })).toMatchObject({ status: "not_sent", reason: "opted_out" });
    expect(portalLoginTokenRepository.create).not.toHaveBeenCalled();
  });
  it("without a public site address nothing is sent and the reason is its own", async () => {
    const c = setup();
    vi.mocked(getPublicBaseUrl).mockReturnValue("");
    expect(await send({ clientId: c.id, purpose: "portal_sign_in", channel: "sms" })).toMatchObject({ status: "not_sent", reason: "no_public_url", message: "The site address is not configured." });
    expect(sendTrackedSms).not.toHaveBeenCalled();
    expect(portalLoginTokenRepository.create).not.toHaveBeenCalled();
  });
  it("uses the agency's own ACTIVE portal-login wording when it has {{portal_link}}, filled with the one-time link and no 48-hour sentence added", async () => {
    const c = setup();
    vi.mocked(smsRepository.findTemplateByCategory).mockResolvedValue({ id: "t9", name: "Our login", active: true, body: "Hi {{first_name}}, log in at {{portal_link}} - {{company_name}}" } as never);
    await send({ clientId: c.id, purpose: "portal_sign_in", channel: "sms" });
    const call = vi.mocked(sendTrackedSms).mock.calls[0][0];
    expect(call.body).toBe("Hi Sam, log in at https://app.example/portal/login?mt=CODE&next=%2Fportal - Tina Travel");
    expect(call).toMatchObject({ templateId: "t9", templateName: "Our login" });
    expect(call.body).not.toContain("48 hours");
  });
  it("never uses the SEEDED default wording (it promises a PIN and ends with a fixed agency name), however it is spaced or cased", async () => {
    for (const body of [
      "Hi {{first_name}}, your client portal is ready. Log in here: {{portal_link}} (use your email and the PIN we shared). - Tina's Travel",
      "  hi {{first_name}}, your client portal is ready.   Log in here: {{portal_link}} (use your email and the PIN we shared). - tina's travel\n",
    ]) {
      const c = setup();
      vi.mocked(sendTrackedSms).mockClear();
      vi.mocked(smsRepository.findTemplateByCategory).mockResolvedValue({ id: "seed", name: "Portal Login", active: true, body } as never);
      await send({ clientId: c.id, purpose: "portal_sign_in", channel: "sms" });
      const call = vi.mocked(sendTrackedSms).mock.calls[0][0];
      expect(call.templateName).toBe("Portal sign-in link");
      expect(call.body).toContain("valid for 48 hours");
      expect(call.body).not.toMatch(/Tina'?s Travel/i);
      expect(call.body).not.toContain("PIN we shared");
    }
  });
  it("an edited template that still ends with the old seeded signature is used, signed with this agency's own name", async () => {
    const c = setup();
    vi.mocked(buildContextForClient).mockResolvedValue({ first_name: "Sam", company_name: "Sunny Holidays" });
    vi.mocked(smsRepository.findTemplateByCategory).mockResolvedValue({ id: "t", name: "Edited", active: true, body: "Tap {{portal_link}} to log in. - Tina's Travel" } as never);
    await send({ clientId: c.id, purpose: "portal_sign_in", channel: "sms" });
    const call = vi.mocked(sendTrackedSms).mock.calls[0][0];
    expect(call.templateName).toBe("Edited");
    expect(call.body).toBe("Tap https://app.example/portal/login?mt=CODE&next=%2Fportal to log in. - Sunny Holidays");
    expect(call.body).not.toMatch(/Tina'?s Travel/i);
  });
  it("an agency genuinely named Tina's Travel keeps its own edited template", async () => {
    const c = setup();
    vi.mocked(buildContextForClient).mockResolvedValue({ first_name: "Sam", company_name: "Tina's Travel" });
    vi.mocked(smsRepository.findTemplateByCategory).mockResolvedValue({ id: "t", name: "Edited", active: true, body: "Log in {{portal_link}} - {{company_name}}" } as never);
    await send({ clientId: c.id, purpose: "portal_sign_in", channel: "sms" });
    const call = vi.mocked(sendTrackedSms).mock.calls[0][0];
    expect(call.templateName).toBe("Edited");
    expect(call.body).toBe("Log in https://app.example/portal/login?mt=CODE&next=%2Fportal - Tina's Travel");
  });
  it("another agency whose template carries the fixed name in the middle still gets the built-in text", async () => {
    const c = setup();
    vi.mocked(buildContextForClient).mockResolvedValue({ first_name: "Sam", company_name: "Sunny Holidays" });
    vi.mocked(smsRepository.findTemplateByCategory).mockResolvedValue({ id: "t", name: "Edited", active: true, body: "Tina's Travel: log in {{portal_link}} - {{company_name}}" } as never);
    await send({ clientId: c.id, purpose: "portal_sign_in", channel: "sms" });
    expect(vi.mocked(sendTrackedSms).mock.calls[0][0].templateName).toBe("Portal sign-in link");
  });
  it("falls back to the built-in text (which states the lifetime) when the template is inactive or has no link placeholder", async () => {
    for (const template of [{ id: "t", name: "n", active: false, body: "Go {{portal_link}}" }, { id: "t", name: "n", active: true, body: "Hi {{first_name}}, use the PIN we shared" }, null]) {
      const c = setup();
      vi.mocked(sendTrackedSms).mockClear();
      vi.mocked(smsRepository.findTemplateByCategory).mockResolvedValue(template as never);
      await send({ clientId: c.id, purpose: "portal_sign_in", channel: "sms" });
      const call = vi.mocked(sendTrackedSms).mock.calls[0][0];
      expect(call.templateName).toBe("Portal sign-in link");
      expect(call.body).toContain("valid for 48 hours");
    }
  });
});

describe("portal sign-in link + WhatsApp: the portal-pin-reset sender rules", () => {
  it("calls the sender with the customer's phone and a reserve that mints a staff link; never sends an SMS", async () => {
    const c = setup();
    vi.mocked(sendPinResetWhatsapp).mockImplementation(async (input) => {
      const link = await input.reserve();
      expect(link).toBe("https://app.example/portal/login?mt=CODE&next=%2Fportal");
      expect(input.buildText?.("L")).toContain("valid for 48 hours");
      return { status: "sent", viaTemplate: true };
    });
    const r = await send({ clientId: c.id, purpose: "portal_sign_in", channel: "whatsapp" });
    expect(r).toEqual({ status: "sent", channel: "whatsapp", viaTemplate: true });
    expect(vi.mocked(sendPinResetWhatsapp).mock.calls[0][0]).toMatchObject({ orgId: "o1", clientId: c.id, phone: "+447700900123", orgName: "Tina Travel" });
    expect(portalLoginTokenRepository.create).toHaveBeenCalledWith(c.id, 48 * 3_600_000, "staff");
    expect(sendTrackedSms).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ purpose: "portal_sign_in", channel: "whatsapp", templateName: "signin_tpl", triggerSource: "staff", actorId: "u1" }));
  });
  it("when the sender cannot deliver it mints the link and returns the wa.me fallback; the link only travels inside the text; nothing goes out by SMS", async () => {
    const reasons = { not_configured: "not_configured", no_channel: "no_channel", no_template: "no_contact", send_failed: "template_failed" } as const;
    for (const [skip, reason] of Object.entries(reasons)) {
      const c = setup();
      record.mockClear();
      vi.mocked(portalLoginTokenRepository.create).mockClear();
      vi.mocked(sendPinResetWhatsapp).mockResolvedValue({ status: "skipped", reason: skip as keyof typeof reasons });
      const r = await send({ clientId: c.id, purpose: "portal_sign_in", channel: "whatsapp" });
      expect(r).toMatchObject({ status: "fallback", channel: "whatsapp", fallback: { reason } });
      const fb = (r as { fallback: { text: string; quoteUrl?: string } }).fallback;
      expect(fb.text).toContain("https://app.example/portal/login?mt=CODE");
      expect(fb.text).toContain("valid for 48 hours");
      expect(fb.quoteUrl).toBeUndefined();
      expect(JSON.stringify({ ...r, fallback: { ...fb, text: "" } })).not.toContain("mt=CODE");
      expect(portalLoginTokenRepository.create).toHaveBeenCalledTimes(1);
      expect(record).toHaveBeenCalledWith(expect.objectContaining({ channel: "whatsapp", outcome: { status: "skipped", reason: "staff_fallback" } }));
    }
    expect(sendTrackedSms).not.toHaveBeenCalled();
  });
  it("a link the sender already minted before a failed send is reused: one link per press", async () => {
    const c = setup();
    vi.mocked(sendPinResetWhatsapp).mockImplementation(async (input) => {
      await input.reserve();
      return { status: "skipped", reason: "send_failed" };
    });
    const r = await send({ clientId: c.id, purpose: "portal_sign_in", channel: "whatsapp" });
    expect(r).toMatchObject({ status: "fallback" });
    expect(portalLoginTokenRepository.create).toHaveBeenCalledTimes(1);
  });
  it("a homeworker goes straight to the fallback: no SendSeven, one minted link, texted nowhere", async () => {
    const c = setup();
    const r = await send({ clientId: c.id, purpose: "portal_sign_in", channel: "whatsapp" }, scope({ orgRole: "homeworker", orgRoles: ["homeworker"] }));
    expect(r).toMatchObject({ status: "fallback", fallback: { reason: "not_allowed" } });
    expect(sendPinResetWhatsapp).not.toHaveBeenCalled();
    expect(portalLoginTokenRepository.create).toHaveBeenCalledTimes(1);
    expect(sendTrackedSms).not.toHaveBeenCalled();
  });
  it("a second press inside a minute is refused (the fallback minted a link too)", async () => {
    const c = setup();
    vi.mocked(sendPinResetWhatsapp).mockResolvedValue({ status: "skipped", reason: "no_template" });
    await send({ clientId: c.id, purpose: "portal_sign_in", channel: "whatsapp" });
    await expect(send({ clientId: c.id, purpose: "portal_sign_in", channel: "whatsapp" })).rejects.toMatchObject({ statusCode: 429 });
    expect(portalLoginTokenRepository.create).toHaveBeenCalledTimes(1);
  });
  it("without a site address nothing is minted, offered or sent: its own reason", async () => {
    const c = setup();
    vi.mocked(getPublicBaseUrl).mockReturnValue("");
    expect(await send({ clientId: c.id, purpose: "portal_sign_in", channel: "whatsapp" })).toMatchObject({ status: "not_sent", reason: "no_public_url", message: "The site address is not configured." });
    expect(sendPinResetWhatsapp).not.toHaveBeenCalled();
    expect(portalLoginTokenRepository.create).not.toHaveBeenCalled();
  });
  it("a customer with no PIN is flagged through the same reserve step", async () => {
    const c = setup({ portalPin: null });
    vi.mocked(sendPinResetWhatsapp).mockImplementation(async (input) => {
      await input.reserve();
      return { status: "sent", viaTemplate: false };
    });
    await send({ clientId: c.id, purpose: "portal_sign_in", channel: "whatsapp" });
    expect(neonClientRepository.setPortalPin).toHaveBeenCalledWith(c.id, null, { mustChange: true });
  });
  it("no phone on file is not sent", async () => {
    const c = setup({ phoneNumber: "" });
    expect(await send({ clientId: c.id, purpose: "portal_sign_in", channel: "whatsapp" })).toMatchObject({ status: "not_sent", reason: "no_phone" });
    expect(sendPinResetWhatsapp).not.toHaveBeenCalled();
  });
  it("a double click does not send two links", async () => {
    const c = setup();
    vi.mocked(sendPinResetWhatsapp).mockImplementation(async (input) => {
      await input.reserve();
      return { status: "sent", viaTemplate: false };
    });
    await send({ clientId: c.id, purpose: "portal_sign_in", channel: "whatsapp" });
    await expect(send({ clientId: c.id, purpose: "portal_sign_in", channel: "whatsapp" })).rejects.toMatchObject({ statusCode: 429 });
    expect(sendPinResetWhatsapp).toHaveBeenCalledTimes(1);
  });
});

describe("minting limits for staff sign-in links", () => {
  const press = (id: string, channel: "whatsapp" | "sms" = "sms") => send({ clientId: id, purpose: "portal_sign_in", channel });

  it("one claim per customer, any channel: after an SMS link, a WhatsApp press inside the minute is refused and mints nothing", async () => {
    const c = setup();
    await press(c.id, "sms");
    await expect(press(c.id, "whatsapp")).rejects.toMatchObject({ statusCode: 429 });
    expect(portalLoginTokenRepository.create).toHaveBeenCalledTimes(1);
    expect(sendPinResetWhatsapp).not.toHaveBeenCalled();
  });
  it("the claim is taken before the first await: two presses at the same moment cannot both mint", async () => {
    const c = setup();
    const results = await Promise.allSettled([press(c.id, "sms"), press(c.id, "whatsapp")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(portalLoginTokenRepository.create).toHaveBeenCalledTimes(1);
  });
  it("a press that minted nothing hands the claim back: an opted-out refusal does not lock the customer out for a minute", async () => {
    const c = setup({ smsOptIn: false });
    expect(await press(c.id, "sms")).toMatchObject({ status: "not_sent", reason: "opted_out" });
    vi.mocked(neonClientService.getNeonClientById).mockResolvedValue({ ...c, smsOptIn: true } as never);
    expect(await press(c.id, "sms")).toEqual({ status: "sent", channel: "sms" });
  });
  it("a press that fails with an error before minting also hands the claim back", async () => {
    const c = setup();
    vi.mocked(neonClientService.getNeonClientById).mockRejectedValueOnce(new Error("db down"));
    await expect(press(c.id)).rejects.toThrow("db down");
    vi.mocked(neonClientService.getNeonClientById).mockResolvedValue(c as never);
    expect(await press(c.id)).toEqual({ status: "sent", channel: "sms" });
  });
  it("a link that was minted and then failed to send keeps the claim (a link exists)", async () => {
    const c = setup();
    vi.mocked(sendTrackedSms).mockResolvedValue({ ok: false, error: "rejected" });
    expect(await press(c.id)).toMatchObject({ status: "not_sent", reason: "send_failed" });
    await expect(press(c.id)).rejects.toMatchObject({ statusCode: 429 });
  });
  it("minting a new staff link first retires this customer's older unused staff links", async () => {
    const c = setup();
    const order: string[] = [];
    vi.mocked(portalLoginTokenRepository.retireStaffLinks).mockImplementation(async () => void order.push("retire"));
    vi.mocked(portalLoginTokenRepository.create).mockImplementation(async () => (order.push("create"), "CODE"));
    await press(c.id);
    expect(portalLoginTokenRepository.retireStaffLinks).toHaveBeenCalledWith(c.id);
    expect(order).toEqual(["retire", "create"]);
  });
  it("ten staff links in the last 24 hours is the limit: the eleventh is not sent, nothing is minted, and the reason is plain", async () => {
    const c = setup();
    vi.mocked(portalLoginTokenRepository.countStaffLinksSince).mockResolvedValue(STAFF_LINK_DAILY_CAP);
    const r = await press(c.id, "sms");
    expect(r).toMatchObject({ status: "not_sent", reason: "capped", message: "Too many sign-in links were sent to this customer in the last 24 hours." });
    expect(portalLoginTokenRepository.create).not.toHaveBeenCalled();
    expect(sendTrackedSms).not.toHaveBeenCalled();
    // The refusal minted nothing, so a retry later is not locked out by the claim.
    vi.mocked(portalLoginTokenRepository.countStaffLinksSince).mockResolvedValue(STAFF_LINK_DAILY_CAP - 1);
    expect(await press(c.id, "sms")).toEqual({ status: "sent", channel: "sms" });
  });
  it("the same limit applies on WhatsApp, and nothing is handed over", async () => {
    const c = setup();
    vi.mocked(portalLoginTokenRepository.countStaffLinksSince).mockResolvedValue(STAFF_LINK_DAILY_CAP);
    expect(await press(c.id, "whatsapp")).toMatchObject({ status: "not_sent", reason: "capped" });
    expect(sendPinResetWhatsapp).not.toHaveBeenCalled();
    expect(portalLoginTokenRepository.create).not.toHaveBeenCalled();
  });
  it("counts from the message log when the token source column does not exist yet", async () => {
    const c = setup();
    vi.mocked(portalLoginTokenRepository.countStaffLinksSince).mockRejectedValue(Object.assign(new Error("no column"), { code: "42703" }));
    vi.mocked(customerMessagingRepository.countStaffSignInSince).mockResolvedValue(STAFF_LINK_DAILY_CAP);
    expect(await press(c.id)).toMatchObject({ status: "not_sent", reason: "capped" });
    expect(customerMessagingRepository.countStaffSignInSince).toHaveBeenCalledWith(expect.objectContaining({ orgId: "o1", clientId: c.id }));
  });
  it("fails OPEN with a logged warning when neither the tokens nor the log can be read: staff can still help the customer", async () => {
    const c = setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(portalLoginTokenRepository.countStaffLinksSince).mockRejectedValue(new Error("no column"));
    vi.mocked(customerMessagingRepository.countStaffSignInSince).mockRejectedValue(new Error("no table"));
    expect(await press(c.id)).toEqual({ status: "sent", channel: "sms" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("not limiting this send"), expect.anything());
    warn.mockRestore();
  });
  it("the WhatsApp sender is told a staff member pressed Send, so usage and the after-send hook are the staff ones", async () => {
    const c = setup();
    vi.mocked(sendPinResetWhatsapp).mockImplementation(async (input) => {
      await input.reserve();
      return { status: "sent", viaTemplate: true };
    });
    await press(c.id, "whatsapp");
    expect(vi.mocked(sendPinResetWhatsapp).mock.calls[0][0]).toMatchObject({ staffUserId: "u1" });
  });
});

describe("access rules", () => {
  it("a homeworker asking for WhatsApp is NOT refused: the quote service answers with the fallback", async () => {
    const c = setup();
    const hw = scope({ orgRole: "homeworker", orgRoles: ["homeworker"] });
    vi.mocked(quoteWhatsappService.send).mockResolvedValue({ status: "fallback", reason: "not_allowed", text: "Hi", quoteUrl: "https://q" });
    expect(await send({ clientId: c.id, purpose: "quote_link", channel: "whatsapp", quoteId: QUOTE }, hw)).toMatchObject({ status: "fallback", fallback: { reason: "not_allowed" } });
  });
  it("a homeworker can send by SMS", async () => {
    const c = setup();
    const hw = scope({ orgRole: "homeworker", orgRoles: ["homeworker"] });
    expect(await send({ clientId: c.id, purpose: "quote_link", channel: "sms", quoteId: QUOTE }, hw)).toEqual({ status: "sent", channel: "sms" });
  });
  it("a client of another agency reads as not found and nothing is sent or logged", async () => {
    vi.mocked(neonClientService.getNeonClientById).mockRejectedValue(new AppError("Client not found", 404));
    await expect(send({ clientId: "other", purpose: "portal_sign_in", channel: "sms" })).rejects.toMatchObject({ statusCode: 404 });
    expect(sendTrackedSms).not.toHaveBeenCalled();
    expect(sendPinResetWhatsapp).not.toHaveBeenCalled();
    expect(portalLoginTokenRepository.create).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
  it("needs an organisation in scope", async () => {
    await expect(send({ clientId: "c", purpose: "portal_sign_in", channel: "sms" }, scope({ orgId: "" }))).rejects.toMatchObject({ statusCode: 400 });
  });
});
