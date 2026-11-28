import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./sms.repository", () => ({ smsRepository: {} }));
vi.mock("../platform-admin/platform-admin-credits.repository", () => ({ platformAdminCreditsRepository: {}, startOfMonthUtc: vi.fn() }));
vi.mock("../../utils/public-url", () => ({ getPublicBaseUrl: () => "https://app.test" }));

import { buildMagicLoginQuoteUrl, buildPortalLink, buildPublicQuoteMessage, buildPublicQuoteUrl, buildQuoteUrl } from "./sms.service";

beforeEach(() => {
  delete process.env.PORTAL_BASE_URL;
});
afterEach(() => {
  delete process.env.PORTAL_BASE_URL;
});

describe("customer links with one host (PORTAL_BASE_URL unset): exactly today's strings", () => {
  it("portal login", () => expect(buildPortalLink()).toBe("https://app.test/portal/login"));
  it("portal quote view", () => expect(buildQuoteUrl("tok")).toBe("https://app.test/portal/quote/tok"));
  it("public quote page", () => expect(buildPublicQuoteUrl("tok")).toBe("https://app.test/view-quote/tok"));
  it("magic-login quote link", () =>
    expect(buildMagicLoginQuoteUrl("CODE", "tok")).toBe("https://app.test/portal/login?mt=CODE&next=%2Fportal%2Fquote%2Ftok"));
  it("the public quote message", () =>
    expect(buildPublicQuoteMessage({ firstName: "Sam", token: "tok", companyName: "Sunny" })).toEqual({
      text: "Hi Sam, your quote is ready - tap to view it: https://app.test/view-quote/tok - Sunny",
      quoteUrl: "https://app.test/view-quote/tok",
    }));
});

describe("customer links with a portal host", () => {
  const PORTAL = "https://portal.app.test";
  beforeEach(() => {
    process.env.PORTAL_BASE_URL = PORTAL;
  });

  it("every customer link is on the portal host", () => {
    expect(buildPortalLink()).toBe(`${PORTAL}/portal/login`);
    expect(buildQuoteUrl("tok")).toBe(`${PORTAL}/portal/quote/tok`);
    expect(buildPublicQuoteUrl("tok")).toBe(`${PORTAL}/view-quote/tok`);
    expect(buildMagicLoginQuoteUrl("CODE", "tok")).toBe(`${PORTAL}/portal/login?mt=CODE&next=%2Fportal%2Fquote%2Ftok`);
  });

  it("the public quote message (SMS and WhatsApp) carries the portal link", () => {
    const { text, quoteUrl } = buildPublicQuoteMessage({ firstName: "Sam", token: "tok", companyName: null });
    expect(quoteUrl).toBe(`${PORTAL}/view-quote/tok`);
    expect(text).toContain(`${PORTAL}/view-quote/tok`);
  });
});
