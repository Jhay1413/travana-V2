import { describe, it, expect, vi, beforeEach } from "vitest";

// The sign-in text goes through the REAL mergeTemplate, buildContextForClient and maskLoginCodes; only the database reads,
// the provider call and the other services are replaced.
vi.mock("../neon-client/neon-client.repository", () => ({ neonClientRepository: { setPortalPin: vi.fn() } }));
vi.mock("../neon-client/neon-client.service", () => ({ neonClientService: { getNeonClientById: vi.fn() } }));
vi.mock("../organization/organization.repository", () => ({ organizationRepository: { findById: vi.fn() } }));
vi.mock("../portal/portal-auth", () => ({ MAGIC_LINK_TTL_MS: 48 * 3_600_000, STAFF_LINK_TTL_HOURS: 48 }));
vi.mock("../portal/portal-login-token.repository", () => ({
  portalLoginTokenRepository: { create: vi.fn(), retireStaffLinks: vi.fn(), countStaffLinksSince: vi.fn() },
}));
vi.mock("../portal/portal-pin-reset-sender", () => ({ sendPinResetWhatsapp: vi.fn() }));
vi.mock("../quote-share/quote-share.service", () => ({ quoteShareService: { verifyAccess: vi.fn() } }));
vi.mock("../quote-share/quote-whatsapp.service", () => ({ quoteWhatsappService: { send: vi.fn() } }));
vi.mock("../sms/sms.repository", () => ({
  smsRepository: {
    findTemplateByCategory: vi.fn(),
    findOrgNameById: vi.fn(),
    findLatestActiveBookingForClient: vi.fn(),
    findLatestTokenedQuoteForClient: vi.fn(),
  },
}));
vi.mock("../sms/sms.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../sms/sms.service")>()),
  isSmsConfigured: vi.fn(() => true),
  sendTrackedSms: vi.fn(),
}));
vi.mock("../user/user.repository", () => ({ userRepository: { findById: vi.fn() } }));
vi.mock("../whatsapp-templates/whatsapp-settings.service", () => ({ whatsappSettingsService: { getQuote: vi.fn(), getPinReset: vi.fn() } }));
vi.mock("../../utils/public-url", () => ({ getPublicBaseUrl: () => "https://app.example" }));
vi.mock("./customer-messaging.service", () => ({ customerMessagingService: { recordOutcome: vi.fn() } }));

import { customerMessagingStaffSendService as svc } from "./customer-messaging-staff-send.service";
import { neonClientService } from "../neon-client/neon-client.service";
import { organizationRepository } from "../organization/organization.repository";
import { portalLoginTokenRepository } from "../portal/portal-login-token.repository";
import { smsRepository } from "../sms/sms.repository";
import { sendTrackedSms } from "../sms/sms.service";
import { userRepository } from "../user/user.repository";
import { maskLoginCodes } from "../../utils/mask-login-code";
import type { Scope } from "../../utils/scope";

const scope: Scope = { orgId: "o1", branchId: null, orgRole: "agent", orgRoles: ["agent"], userId: "u1", branchType: null, ownsHomeworkerBranch: false };
let n = 0;

async function sendSms(templateBody: string | null): Promise<string> {
  const client = { id: `real-${++n}`, orgId: "o1", firstName: "Cora", surename: "Lee", email: "cora@example.com", phoneNumber: "07700900123", smsOptIn: true, portalPin: "hash" };
  vi.mocked(neonClientService.getNeonClientById).mockResolvedValue(client as never);
  vi.mocked(smsRepository.findTemplateByCategory).mockResolvedValue(
    templateBody === null ? (undefined as never) : ({ id: "t1", name: "Portal Login", active: true, body: templateBody } as never),
  );
  vi.mocked(sendTrackedSms).mockClear();
  await svc.send({ clientId: client.id, purpose: "portal_sign_in", channel: "sms" }, "u1", scope);
  return vi.mocked(sendTrackedSms).mock.calls[0][0].body;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(sendTrackedSms).mockResolvedValue({ ok: true, providerMessageId: "sid" });
  vi.mocked(portalLoginTokenRepository.create).mockResolvedValue("ABCDEFGH2345");
  vi.mocked(portalLoginTokenRepository.countStaffLinksSince).mockResolvedValue(0);
  vi.mocked(organizationRepository.findById).mockResolvedValue({ name: "Sunny Holidays" } as never);
  vi.mocked(userRepository.findById).mockResolvedValue({ firstName: "Ann", lastName: "Agent", email: "a@x" } as never);
  vi.mocked(smsRepository.findOrgNameById).mockResolvedValue("Sunny Holidays" as never);
  vi.mocked(smsRepository.findLatestActiveBookingForClient).mockResolvedValue(undefined as never);
  vi.mocked(smsRepository.findLatestTokenedQuoteForClient).mockResolvedValue(undefined as never);
});

describe("the SMS sign-in text through the real merge and the real log masking", () => {
  it("an edited agency template is merged with the real mergeTemplate: placeholders filled, the one-time link in place of {{portal_link}}", async () => {
    const body = await sendSms("Hello {{first_name}}, sign in: {{portal_link}} - {{company_name}}");
    expect(body).toBe("Hello Cora, sign in: https://app.example/portal/login?mt=ABCDEFGH2345&next=%2Fportal - Sunny Holidays");
  });

  it("the message that is sent keeps the live code, and the copy kept for staff to read has it masked", async () => {
    const body = await sendSms("Hello {{first_name}}, sign in: {{portal_link}}");
    expect(body).toContain("mt=ABCDEFGH2345");
    const stored = maskLoginCodes(body);
    expect(stored).not.toContain("ABCDEFGH2345");
    expect(stored).toContain("/portal/login?mt=[redacted]&next=%2Fportal");
  });

  it("the seeded default is not used: the built-in text goes out, with the lifetime, the agency's own name and no PIN promise", async () => {
    const body = await sendSms("Hi {{first_name}}, your client portal is ready. Log in here: {{portal_link}} (use your email and the PIN we shared). - Tina's Travel");
    expect(body).toBe("Hi Cora, tap this link to sign in to your Sunny Holidays portal: https://app.example/portal/login?mt=ABCDEFGH2345&next=%2Fportal The link works once and is valid for 48 hours.");
    expect(maskLoginCodes(body)).not.toContain("ABCDEFGH2345");
  });

  it("with no template at all the built-in text goes out", async () => {
    expect(await sendSms(null)).toContain("valid for 48 hours");
  });

  it("an agency really named Tina's Travel keeps its own edited template", async () => {
    vi.mocked(smsRepository.findOrgNameById).mockResolvedValue("Tina's Travel" as never);
    const body = await sendSms("Sign in: {{portal_link}} from {{company_name}}");
    expect(body).toBe("Sign in: https://app.example/portal/login?mt=ABCDEFGH2345&next=%2Fportal from Tina's Travel");
  });

  it("an edited template signed with the fixed name, sent by another agency, is signed with that agency's own name", async () => {
    const body = await sendSms("Sign in: {{portal_link}} - Tina's Travel");
    expect(body).toBe("Sign in: https://app.example/portal/login?mt=ABCDEFGH2345&next=%2Fportal - Sunny Holidays");
  });
});
