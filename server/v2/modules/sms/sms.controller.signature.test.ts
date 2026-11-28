import { describe, it, expect, vi, beforeEach } from "vitest";

// The manual send's merge context: company_name is the sending agency's name from data, and an old seeded signature is swapped for it.
vi.mock("./sms.repository", () => ({
  smsRepository: {
    findTemplateByCategory: vi.fn(),
    findOrgNameById: vi.fn(),
    resolveRecipients: vi.fn(),
    createMessage: vi.fn(),
    findLatestActiveBookingForClient: vi.fn(),
  },
}));
vi.mock("./sms.service", () => ({
  pingSmsConnection: vi.fn(),
  sendSms: vi.fn(),
  mergeTemplate: (body: string, ctx: Record<string, string>) => body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => ctx[k] ?? ""),
  normalisePhone: (raw: string) => `+44${raw.replace(/\D/g, "").slice(-10)}`,
  consumeSmsCredit: vi.fn(),
  attachChargeToMessage: vi.fn(),
  resolveQuoteToken: vi.fn(),
  buildPublicQuoteUrl: vi.fn(),
  buildPortalLink: () => "https://app.example/portal/login",
  buildQuoteUrl: (token: string) => `https://app.example/portal/quote/${token}`,
  buildMagicLoginQuoteUrl: (code: string, token: string) => `https://app.example/portal/login?mt=${code}&next=${encodeURIComponent(`/portal/quote/${token}`)}`,
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
import { userRepository } from "../user/user.repository";

let seq = 0;
async function send(templateBody: string, agencyName: string | undefined): Promise<string> {
  const customer = { id: `sig${++seq}`, orgId: "o1", firstName: "Sam", surename: "Lee", email: "sam@example.com", phoneNumber: "07700900123", smsOptIn: true, portalPin: "h" };
  vi.mocked(userRepository.findById).mockResolvedValue({ id: "u1", role: "agent", firstName: "A", lastName: "B" } as never);
  vi.mocked(smsRepository.findTemplateByCategory).mockResolvedValue({ id: "t1", name: "T", body: templateBody } as never);
  vi.mocked(smsRepository.findOrgNameById).mockResolvedValue(agencyName as never);
  vi.mocked(smsRepository.resolveRecipients).mockResolvedValue([customer] as never);
  vi.mocked(smsRepository.createMessage).mockResolvedValue({ id: "m1" } as never);
  vi.mocked(smsRepository.findLatestActiveBookingForClient).mockResolvedValue(undefined as never);
  vi.mocked(consumeSmsCredit).mockResolvedValue({ enabled: false, overage: false, chargeId: null });
  vi.mocked(resolveQuoteToken).mockResolvedValue(undefined);
  vi.mocked(sendSms).mockResolvedValue({ sid: "s1", status: "ok" });
  const req = {
    body: { category: "weekly_deals", recipients: { mode: "client", clientId: customer.id }, triggerSource: "t" },
    params: {}, query: {}, orgId: "o1", orgRole: "agent", orgRoles: ["agent"], user: { authType: "password", userId: "u1" },
  } as never;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  c.send(req, res as never, vi.fn());
  await new Promise((r) => setImmediate(r));
  return vi.mocked(sendSms).mock.calls.at(-1)?.[0].body ?? "";
}

beforeEach(() => vi.resetAllMocks());

describe("manual send: the signature is the sending agency's own", () => {
  it("{{company_name}} merges to the agency name read from data", async () => {
    expect(await send("Hi {{first_name}} - {{company_name}}", "Sunny Holidays")).toBe("Hi Sam - Sunny Holidays");
    expect(smsRepository.findOrgNameById).toHaveBeenCalledWith("o1");
  });

  it("{{company_name}} is empty when the agency is unknown", async () => {
    expect(await send("Hi {{first_name}}{{company_name}}", undefined)).toBe("Hi Sam");
  });

  it("a row seeded with the old fixed signature is signed with the agency instead", async () => {
    expect(await send("Hi {{first_name}}. - Tina's Travel", "Sunny Holidays")).toBe("Hi Sam. - Sunny Holidays");
    expect(await send("Hi {{first_name}}. - Tina's Travel", undefined)).toBe("Hi Sam.");
  });

  it("an agency really named Tina's Travel keeps it", async () => {
    expect(await send("Hi {{first_name}}. - Tina's Travel", "Tina's Travel")).toBe("Hi Sam. - Tina's Travel");
  });
});
