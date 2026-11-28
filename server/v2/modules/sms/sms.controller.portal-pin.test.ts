import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./sms.repository", () => ({
  smsRepository: {
    findTemplateByCategory: vi.fn(),
    resolveRecipients: vi.fn(),
    createMessage: vi.fn(),
    findLatestActiveBookingForClient: vi.fn(),
  },
}));
vi.mock("./sms.service", () => ({
  pingSmsConnection: vi.fn(),
  sendSms: vi.fn(),
  mergeTemplate: (body: string, ctx: Record<string, string>) => body.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => ctx[k] ?? ""),
  normalisePhone: (raw: string) => `+44${raw.replace(/\D/g, "").slice(-10)}`,
  consumeSmsCredit: vi.fn(),
  attachChargeToMessage: vi.fn(),
  resolveQuoteToken: vi.fn(),
  buildPublicQuoteUrl: vi.fn(),
  buildPortalLink: () => "https://app.example/portal/login",
  buildQuoteUrl: (token: string) => `https://app.example/portal/quote/${token}`,
  buildMagicLoginQuoteUrl: (code: string, token: string) => `https://app.example/portal/login?mt=${code}&next=${encodeURIComponent(`/portal/quote/${token}`)}`,
  QUOTE_SHARE_COMPANY_NAME: "Co",
}));
vi.mock("../platform-admin/platform-admin-credits.repository", () => ({ platformAdminCreditsRepository: {}, startOfMonthUtc: vi.fn() }));
vi.mock("../portal/portal-auth", () => ({ MAGIC_LINK_TTL_MS: 5 }));
vi.mock("../portal/portal-login-token.repository", () => ({ portalLoginTokenRepository: { create: vi.fn() } }));
vi.mock("../neon-client/neon-client.repository", () => ({ neonClientRepository: { setPortalPin: vi.fn() } }));
vi.mock("../user/user.repository", () => ({ userRepository: { findById: vi.fn() } }));
vi.mock("../../utils/public-url", () => ({ getPublicBaseUrl: () => "https://app.example" }));

import { smsController as c } from "./sms.controller";
import { smsRepository } from "./sms.repository";
import { consumeSmsCredit, resolveQuoteToken, sendSms } from "./sms.service";
import { portalLoginTokenRepository } from "../portal/portal-login-token.repository";
import { neonClientRepository } from "../neon-client/neon-client.repository";
import { userRepository } from "../user/user.repository";

let seq = 0;
// A fresh id per test: the send has a 60-second duplicate guard keyed on the recipients.
const client = (over: Record<string, unknown> = {}) => ({ id: `c${++seq}`, firstName: "Sam", surename: "Lee", email: "sam@example.com", phoneNumber: "07700900123", smsOptIn: true, portalPin: null, ...over });

async function sendQuoteLinkText(c1: ReturnType<typeof client>): Promise<string> {
  vi.mocked(userRepository.findById).mockResolvedValue({ id: "u1", role: "agent", firstName: "A", lastName: "B" } as never);
  vi.mocked(smsRepository.findTemplateByCategory).mockResolvedValue({ id: "t1", name: "Quote Link", body: "Hi {{first_name}}, {{quote_url}} {{portal_credentials}}" } as never);
  vi.mocked(smsRepository.resolveRecipients).mockResolvedValue([c1] as never);
  vi.mocked(smsRepository.createMessage).mockResolvedValue({ id: "m1" } as never);
  vi.mocked(smsRepository.findLatestActiveBookingForClient).mockResolvedValue(undefined as never);
  vi.mocked(consumeSmsCredit).mockResolvedValue({ enabled: false, overage: false, chargeId: null });
  vi.mocked(resolveQuoteToken).mockResolvedValue({ id: "q1", token: "tok" });
  vi.mocked(sendSms).mockResolvedValue({ sid: "s1", status: "ok" });
  vi.mocked(portalLoginTokenRepository.create).mockResolvedValue("CODE");
  const req = {
    body: { category: "quote_link", recipients: { mode: "client", clientId: c1.id }, quoteId: "q1", triggerSource: "t" },
    params: {},
    query: {},
    orgId: "o1",
    orgRole: "agent",
    orgRoles: ["agent"],
    user: { authType: "password", userId: "u1" },
  } as never;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  c.send(req, res as never, vi.fn());
  await new Promise((r) => setImmediate(r));
  return vi.mocked(sendSms).mock.calls[0]?.[0].body ?? "";
}

beforeEach(() => vi.resetAllMocks());

describe("a quote text with a sign-in link no longer seeds a default PIN", () => {
  it("a customer with no PIN is flagged to choose one; no PIN hash (and never 1234) is stored", async () => {
    const c1 = client({ portalPin: null });
    const body = await sendQuoteLinkText(c1);
    expect(neonClientRepository.setPortalPin).toHaveBeenCalledTimes(1);
    expect(neonClientRepository.setPortalPin).toHaveBeenCalledWith(c1.id, null, { mustChange: true });
    // The text never carries a PIN and still carries the one-time link.
    expect(body).not.toContain("1234");
    expect(body).toContain("https://app.example/portal/login?mt=CODE");
  });

  it("the link is minted with the staff label and the shortened lifetime constant", async () => {
    const c1 = client({ portalPin: null });
    await sendQuoteLinkText(c1);
    expect(portalLoginTokenRepository.create).toHaveBeenCalledWith(c1.id, 5, "staff");
  });

  it("a customer who already has a PIN keeps it untouched", async () => {
    await sendQuoteLinkText(client({ portalPin: "existing-hash" }));
    expect(neonClientRepository.setPortalPin).not.toHaveBeenCalled();
  });
});
