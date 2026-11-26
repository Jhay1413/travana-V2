import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./portal.repository", () => ({
  portalRepository: { findLoginCandidates: vi.fn(), findActiveOrgIdBySlug: vi.fn() },
}));
vi.mock("./portal-pin-reset.repository", () => ({
  portalPinResetRepository: { findTarget: vi.fn(), reserveLink: vi.fn() },
}));
// The WhatsApp sender would reach SendSeven: tests only ever see this mock.
vi.mock("./portal-pin-reset-sender", () => ({ sendPinResetWhatsapp: vi.fn() }));
// If the reset ever touched the SMS sender these would be called; they never are.
const sms = vi.hoisted(() => ({ sendSms: vi.fn(), consumeSmsCredit: vi.fn() }));
vi.mock("../sms/sms.service", () => ({
  normalisePhone: (raw: string | null | undefined) => (raw && raw.trim() ? `+44${raw.replace(/^0/, "")}` : null),
  sendSms: sms.sendSms,
  consumeSmsCredit: sms.consumeSmsCredit,
}));
// The agency setting and the SMS path live in customer-messaging; here they are mocks.
const cm = vi.hoisted(() => ({ getAutoChannel: vi.fn(), sendSignInLinkBySms: vi.fn(), recordOutcome: vi.fn() }));
const { FakeSettingsUnavailableError } = vi.hoisted(() => ({ FakeSettingsUnavailableError: class extends Error {} }));
vi.mock("../customer-messaging/customer-messaging.service", () => ({ customerMessagingService: cm, SettingsUnavailableError: FakeSettingsUnavailableError }));
const baseUrl = vi.hoisted(() => ({ value: "https://portal.example" }));
vi.mock("../../utils/public-url", () => ({ getPublicBaseUrl: () => baseUrl.value }));

import {
  buildSignInText,
  mayRequestPinReset,
  PIN_RESET_ERROR_LOG_INTERVAL_MS,
  PIN_RESET_LINK_TTL_MS,
  PIN_RESET_MAX_PER_ORG_PER_DAY,
  PIN_RESET_REPLY_MESSAGE,
  pinResetTiming,
  portalPinResetLimiter,
  portalPinResetService,
} from "./portal-pin-reset.service";
import { portalRepository } from "./portal.repository";
import { portalPinResetRepository } from "./portal-pin-reset.repository";
import { sendPinResetWhatsapp } from "./portal-pin-reset-sender";
import { PIN_RESET_MAX_TEXTS } from "./portal-pin-reset-limiter";
import type { LoginCandidate } from "./portal.types";

const repo = vi.mocked(portalRepository);
const targets = vi.mocked(portalPinResetRepository);
const sender = vi.mocked(sendPinResetWhatsapp);

const candidate = (id: string, over: Partial<LoginCandidate> = {}): LoginCandidate => ({
  id, email: "sam@example.com", firstName: "Sam", portalPin: "hash", mustChangePin: false, orgId: "o1", ...over,
});
const target = (over: Partial<NonNullable<Awaited<ReturnType<typeof portalPinResetRepository.findTarget>>>> = {}) => ({
  firstName: "Sam", phoneNumber: "07700900123", orgId: "o1", orgName: "Sunny Travel", orgActive: true, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  pinResetTiming.minMs = 0;
  portalPinResetLimiter.clearAll();
  repo.findLoginCandidates.mockResolvedValue([candidate("c1")]);
  repo.findActiveOrgIdBySlug.mockResolvedValue("o1");
  targets.findTarget.mockResolvedValue(target());
  targets.reserveLink.mockResolvedValue({ reserved: true, code: "CODE1234abcd" });
  baseUrl.value = "https://portal.example";
  cm.getAutoChannel.mockResolvedValue("whatsapp");
  cm.recordOutcome.mockResolvedValue(undefined);
  cm.sendSignInLinkBySms.mockImplementation(async (input: { reserve: () => Promise<string | null> }) => ((await input.reserve()) ? { status: "sent" } : { status: "skipped", reason: "capped" }));
  // Like the real sender: it reserves the link once it has decided a message can be sent.
  sender.mockImplementation(async (input) => {
    const link = await input.reserve();
    return link ? { status: "sent", viaTemplate: false } : { status: "skipped", reason: "capped" };
  });
});

const reset = (input: { email: string; org?: string } = { email: "sam@example.com" }) => portalPinResetService.processReset(input);
const reserveOnce = async () => sender.mock.calls[0][0].reserve();

describe("processReset", () => {
  it("success: one WhatsApp send for the right customer, one reserved pin_reset link", async () => {
    await reset();
    expect(sender).toHaveBeenCalledTimes(1);
    expect(sender.mock.calls[0][0]).toMatchObject({ orgId: "o1", clientId: "c1", firstName: "Sam", orgName: "Sunny Travel", phone: "+447700900123" });
    expect(targets.reserveLink).toHaveBeenCalledTimes(1);
    expect(targets.reserveLink).toHaveBeenCalledWith(expect.objectContaining({
      clientId: "c1", orgId: "o1", email: "sam@example.com", maxPerEmail: 3, maxPerOrg: 20, ttlMs: PIN_RESET_LINK_TTL_MS,
    }));
  });

  it("the reserved link points at the portal and lands on the change-PIN form", async () => {
    sender.mockImplementation(async (input) => ({ status: "sent", viaTemplate: !(await input.reserve()) }));
    await reset();
    const link = await reserveOnce();
    expect(link).toContain("https://portal.example/portal/login?mt=CODE1234abcd&next=");
    expect(decodeURIComponent(link ?? "")).toContain("next=/portal/account?change-pin=1");
  });

  it("never reserves a link (nothing is minted) when the sender decides nothing can be sent", async () => {
    sender.mockResolvedValue({ status: "skipped", reason: "no_template" });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await reset();
    expect(targets.reserveLink).not.toHaveBeenCalled();
  });

  it("never touches the SMS sender or SMS credit", async () => {
    await reset();
    expect(sms.sendSms).not.toHaveBeenCalled();
    expect(sms.consumeSmsCredit).not.toHaveBeenCalled();
  });

  it("logs why nothing was sent", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    sender.mockResolvedValue({ status: "skipped", reason: "not_configured" });
    await reset();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("not_configured"));
  });

  it("unknown email: nothing happens", async () => {
    repo.findLoginCandidates.mockResolvedValue([]);
    await reset({ email: "nobody@example.com" });
    expect(sender).not.toHaveBeenCalled();
  });

  it("ambiguous email without an agency: nothing happens", async () => {
    repo.findLoginCandidates.mockResolvedValue([candidate("c1"), candidate("c2", { orgId: "o2" })]);
    await reset();
    expect(repo.findLoginCandidates).toHaveBeenCalledWith("sam@example.com", undefined, 2);
    expect(sender).not.toHaveBeenCalled();
  });

  it("with an agency, filters by it and uses the best candidate like sign-in", async () => {
    repo.findLoginCandidates.mockResolvedValue([candidate("c1"), candidate("c9")]);
    await reset({ email: "sam@example.com", org: "Sunny" });
    expect(repo.findActiveOrgIdBySlug).toHaveBeenCalledWith("sunny");
    expect(repo.findLoginCandidates).toHaveBeenCalledWith("sam@example.com", "o1", 2);
    expect(sender.mock.calls[0][0].clientId).toBe("c1");
  });

  it("unknown or malformed agency: nothing happens", async () => {
    repo.findActiveOrgIdBySlug.mockResolvedValue(null);
    await reset({ email: "sam@example.com", org: "nope" });
    await reset({ email: "sam@example.com", org: "../bad" });
    expect(repo.findLoginCandidates).not.toHaveBeenCalled();
    expect(sender).not.toHaveBeenCalled();
  });

  it("a customer with no portal PIN at all IS allowed (owner's decision), through one named rule", async () => {
    const noPin = candidate("c1", { portalPin: null });
    expect(mayRequestPinReset(noPin)).toBe(true);
    repo.findLoginCandidates.mockResolvedValue([noPin]);
    await reset();
    expect(sender).toHaveBeenCalledTimes(1);
  });

  it("no phone number on file: nothing is sent", async () => {
    targets.findTarget.mockResolvedValue(target({ phoneNumber: "" }));
    await reset();
    expect(sender).not.toHaveBeenCalled();
  });

  it("suspended agency: nothing is sent", async () => {
    targets.findTarget.mockResolvedValue(target({ orgActive: false }));
    await reset();
    expect(sender).not.toHaveBeenCalled();
  });

  it("customer with no agency: nothing is sent", async () => {
    targets.findTarget.mockResolvedValue(target({ orgId: null, orgActive: false }));
    await reset();
    expect(sender).not.toHaveBeenCalled();
  });

  it("an empty public base URL sends nothing, and logs why", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    baseUrl.value = "";
    await reset();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("no_public_url"));
    expect(sender).not.toHaveBeenCalled();
  });

  it("the in-memory allowance is only spent once a link is really reserved, then caps the email at 3", async () => {
    for (let i = 0; i < PIN_RESET_MAX_TEXTS; i++) await reset();
    expect(sender).toHaveBeenCalledTimes(PIN_RESET_MAX_TEXTS);
    await reset();
    await reset({ email: "SAM@example.com " });
    expect(sender).toHaveBeenCalledTimes(PIN_RESET_MAX_TEXTS);
  });

  it("a reservation refused by the durable caps does not spend the in-memory allowance", async () => {
    targets.reserveLink.mockResolvedValue({ reserved: false, reason: "org_cap" });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    for (let i = 0; i < 5; i++) await reset();
    expect(sender).toHaveBeenCalledTimes(5);
    targets.reserveLink.mockResolvedValue({ reserved: true, code: "X" });
    await reset();
    expect(sender).toHaveBeenCalledTimes(6);
  });

  it("the in-memory key is per agency and email", async () => {
    for (let i = 0; i < PIN_RESET_MAX_TEXTS; i++) await reset();
    targets.findTarget.mockResolvedValue(target({ orgId: "o2" }));
    await reset();
    expect(sender).toHaveBeenCalledTimes(PIN_RESET_MAX_TEXTS + 1);
  });

  it("a different email has its own allowance", async () => {
    for (let i = 0; i < PIN_RESET_MAX_TEXTS; i++) await reset();
    await reset({ email: "other@example.com" });
    expect(sender).toHaveBeenCalledTimes(PIN_RESET_MAX_TEXTS + 1);
  });

  it("the durable caps are checked for the resolved agency, with the 3 and 20 limits", async () => {
    expect(PIN_RESET_MAX_PER_ORG_PER_DAY).toBe(20);
    await reset();
    await reserveOnce();
    const call = targets.reserveLink.mock.calls.at(-1)?.[0];
    expect(call).toMatchObject({ orgId: "o1", maxPerEmail: 3, maxPerOrg: 20 });
    expect(call?.since.getTime()).toBeLessThanOrEqual(Date.now() - 24 * 60 * 60 * 1000 + 5000);
  });

  it("if the reservation throws (column missing) nothing is sent, and the error is logged at most once a minute", async () => {
    vi.useFakeTimers();
    try {
      const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      targets.reserveLink.mockRejectedValue(new Error('column "source" does not exist'));
      vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
      await reset();
      await reset({ email: "sam@example.com" });
      expect(err.mock.calls.filter((c) => String(c[0]).includes("cannot reserve")).length).toBe(1);
      vi.setSystemTime(new Date(Date.now() + PIN_RESET_ERROR_LOG_INTERVAL_MS + 1000));
      await reset();
      expect(err.mock.calls.filter((c) => String(c[0]).includes("cannot reserve")).length).toBe(2);
      // Each time the sender saw a refused reservation and sent nothing.
      expect(sender.mock.results.every((r) => r.type === "return")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a failing send does not fail the request", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    sender.mockRejectedValue(new Error("provider down"));
    await expect(reset()).resolves.toBeUndefined();
  });

  it("a repository failure resolves quietly too", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    repo.findLoginCandidates.mockRejectedValue(new Error("db down"));
    await expect(reset()).resolves.toBeUndefined();
    expect(sender).not.toHaveBeenCalled();
  });
});

describe("processReset on the agency's SMS setting", () => {
  beforeEach(() => cm.getAutoChannel.mockResolvedValue("sms"));

  it("goes by SMS: the WhatsApp sender is never used, and the agency is the customer's own", async () => {
    await reset();
    expect(cm.getAutoChannel).toHaveBeenCalledWith("o1");
    expect(cm.sendSignInLinkBySms).toHaveBeenCalledTimes(1);
    expect(cm.sendSignInLinkBySms.mock.calls[0][0]).toMatchObject({ orgId: "o1", clientId: "c1", firstName: "Sam", orgName: "Sunny Travel", phone: "+447700900123" });
    expect(sender).not.toHaveBeenCalled();
  });

  it("keeps the same caps: one reserved link through the same 3 per email / 20 per agency reservation", async () => {
    await reset();
    expect(targets.reserveLink).toHaveBeenCalledTimes(1);
    expect(targets.reserveLink).toHaveBeenCalledWith(expect.objectContaining({ maxPerEmail: PIN_RESET_MAX_TEXTS, maxPerOrg: PIN_RESET_MAX_PER_ORG_PER_DAY, ttlMs: PIN_RESET_LINK_TTL_MS }));
  });

  it("the third request per email works and the fourth is refused, exactly as on WhatsApp", async () => {
    for (let i = 0; i < PIN_RESET_MAX_TEXTS; i++) await reset();
    await reset();
    expect(cm.sendSignInLinkBySms).toHaveBeenCalledTimes(PIN_RESET_MAX_TEXTS);
    expect(targets.reserveLink).toHaveBeenCalledTimes(PIN_RESET_MAX_TEXTS);
  });

  it("never reads the customer's opt-out: the service does not even look at it", async () => {
    targets.findTarget.mockResolvedValue({ ...target(), smsOptIn: false } as never);
    await reset();
    expect(cm.sendSignInLinkBySms).toHaveBeenCalledTimes(1);
  });

  it("still sends nothing for no phone, a suspended agency or an unknown email", async () => {
    targets.findTarget.mockResolvedValue(target({ phoneNumber: "" }));
    await reset();
    targets.findTarget.mockResolvedValue(target({ orgActive: false }));
    await reset();
    repo.findLoginCandidates.mockResolvedValue([]);
    await reset();
    expect(cm.sendSignInLinkBySms).not.toHaveBeenCalled();
  });

  it("logs the outcome through customer_message_log on the sms channel", async () => {
    await reset();
    expect(cm.recordOutcome).toHaveBeenCalledWith(expect.objectContaining({
      orgId: "o1", clientId: "c1", purpose: "portal_sign_in", channel: "sms", triggerSource: "portal.pin-reset", outcome: { status: "sent" },
    }));
  });

  it("logs a skip with its reason (cap reached)", async () => {
    targets.reserveLink.mockResolvedValue({ reserved: false, reason: "email_cap" });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await reset();
    expect(cm.recordOutcome).toHaveBeenCalledWith(expect.objectContaining({ channel: "sms", outcome: { status: "skipped", reason: "capped" } }));
  });

  it("a failing SMS does not fail the request", async () => {
    cm.sendSignInLinkBySms.mockRejectedValue(new Error("provider down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(reset()).resolves.toBeUndefined();
  });
});

describe("processReset when the channel setting cannot be read", () => {
  beforeEach(() => {
    cm.getAutoChannel.mockRejectedValue(new FakeSettingsUnavailableError());
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("sends nothing on either channel and mints no link (never a guess at the channel)", async () => {
    await reset();
    expect(sender).not.toHaveBeenCalled();
    expect(cm.sendSignInLinkBySms).not.toHaveBeenCalled();
    expect(targets.reserveLink).not.toHaveBeenCalled();
    expect(sms.sendSms).not.toHaveBeenCalled();
  });

  it("logs the skip as settings_unavailable on an unknown channel", async () => {
    await reset();
    expect(cm.recordOutcome).toHaveBeenCalledWith(expect.objectContaining({ purpose: "portal_sign_in", channel: "unknown", outcome: { status: "skipped", reason: "settings_unavailable" } }));
  });

  it("the request still gets the usual reply: the work is in the background and never throws", async () => {
    await expect(reset()).resolves.toBeUndefined();
    pinResetTiming.minMs = 0;
    await expect(portalPinResetService.requestReset({ email: "sam@example.com" })).resolves.toBeUndefined();
  });
});

describe("processReset on the default (WhatsApp) setting logs through customer_message_log too", () => {
  it("a sent message is a sent row on the whatsapp channel, and the SMS path is never used", async () => {
    await reset();
    expect(cm.sendSignInLinkBySms).not.toHaveBeenCalled();
    expect(cm.recordOutcome).toHaveBeenCalledWith(expect.objectContaining({ channel: "whatsapp", purpose: "portal_sign_in", outcome: { status: "sent" } }));
  });

  it("the sender's reasons are mapped to the shared ones", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    for (const [from, to] of [["not_configured", "not_connected"], ["no_template", "no_template"], ["capped", "capped"]] as const) {
      cm.recordOutcome.mockClear();
      sender.mockResolvedValue({ status: "skipped", reason: from });
      await reset();
      portalPinResetLimiter.clearAll();
      expect(cm.recordOutcome).toHaveBeenCalledWith(expect.objectContaining({ channel: "whatsapp", outcome: { status: "skipped", reason: to } }));
    }
  });

  it("the confirmation reply is the same whichever channel the agency uses", () => {
    expect(PIN_RESET_REPLY_MESSAGE).toMatch(/sign-in link/);
  });
});


describe("requestReset", () => {
  it("answers after the fixed floor and does not wait for the lookups", async () => {
    vi.useFakeTimers();
    try {
      pinResetTiming.minMs = 500;
      let release: (v: LoginCandidate[]) => void = () => undefined;
      repo.findLoginCandidates.mockReturnValue(new Promise<LoginCandidate[]>((r) => { release = r; }));
      let done = false;
      void portalPinResetService.requestReset({ email: "sam@example.com" }).then(() => { done = true; });
      await vi.advanceTimersByTimeAsync(499);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(2);
      expect(done).toBe(true);
      release([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does the work in the background: the message is sent for a real customer", async () => {
    await portalPinResetService.requestReset({ email: "sam@example.com" });
    await vi.waitFor(() => expect(sender).toHaveBeenCalledTimes(1));
  });

  it("a failure in the background is logged, never thrown", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    repo.findLoginCandidates.mockRejectedValue(new Error("db down"));
    await expect(portalPinResetService.requestReset({ email: "sam@example.com" })).resolves.toBeUndefined();
    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
  });
});

describe("copy", () => {
  it("the confirmation names no channel and never reveals whether anything was sent", () => {
    expect(PIN_RESET_REPLY_MESSAGE).toBe("If we have your details, we've sent you a sign-in link.");
    expect(PIN_RESET_REPLY_MESSAGE).not.toMatch(/whatsapp|sms|text/i);
  });
  it("the plain-text message is generic when names are missing and never names a fixed company", () => {
    const text = buildSignInText({ firstName: null, orgName: null, link: "https://x/y" });
    expect(text).toContain("Hi, ");
    expect(text).toContain("your portal");
    expect(text).not.toMatch(/travana|tina/i);
  });
});
