import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock the entire layer below the service ---------------------------------
// resolveQuoteToken's only job is deciding which quote's token to use; the
// repository lookups it delegates to are replaced with spies so this runs
// with no database and asserts ONLY the service's own rule.
vi.mock("./sms.repository", () => ({
  smsRepository: {
    findTokenedQuoteForClient: vi.fn(),
    findLatestTokenedQuoteForClient: vi.fn(),
  },
}));

vi.mock("../../utils/public-url", () => ({ getPublicBaseUrl: () => "https://app.test" }));

import { resolveQuoteToken, buildPublicQuoteUrl, buildPublicQuoteMessage, mergeTemplate } from "./sms.service";
import { smsRepository } from "./sms.repository";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("mergeTemplate signature", () => {
  const BODY = "Hi {{first_name}}, your portal is ready: {{portal_link}} (use the PIN we shared). - {{company_name}}";
  it("signs the text with the agency name when it is known", () => {
    expect(mergeTemplate(BODY, { first_name: "Sam", portal_link: "L", company_name: "Sunny" })).toBe("Hi Sam, your portal is ready: L (use the PIN we shared). - Sunny");
  });
  it("drops the dangling ' - ' when the agency name is empty, blank, null or missing", () => {
    const want = "Hi Sam, your portal is ready: L (use the PIN we shared).";
    expect(mergeTemplate(BODY, { first_name: "Sam", portal_link: "L", company_name: "" })).toBe(want);
    expect(mergeTemplate(BODY, { first_name: "Sam", portal_link: "L", company_name: "  " })).toBe(want);
    expect(mergeTemplate(BODY, { first_name: "Sam", portal_link: "L", company_name: null })).toBe(want);
    expect(mergeTemplate(BODY, { first_name: "Sam", portal_link: "L" })).toBe(want);
    expect(mergeTemplate("Call us. -  {{ company_name }}  \n", {})).toBe("Call us.");
  });
  it("touches nothing else: a dash not followed by the company field, or a name in the middle", () => {
    expect(mergeTemplate("Call us - soon", {})).toBe("Call us - soon");
    expect(mergeTemplate("{{company_name}} says hi -", { company_name: "" })).toBe(" says hi -");
    expect(mergeTemplate("Hello {{company_name}}", { company_name: "" })).toBe("Hello ");
    expect(mergeTemplate("Great-{{company_name}}", {})).toBe("Great-");
  });
  it("stays fast on long runs of braces and letters", () => {
    const start = performance.now();
    mergeTemplate("{{".repeat(20_000) + "a".repeat(20_000), {});
    mergeTemplate("{ ".repeat(50_000), {});
    expect(performance.now() - start).toBeLessThan(200);
  });
});

describe("resolveQuoteToken", () => {
  it("uses the explicit quote id when one is supplied", async () => {
    vi.mocked(smsRepository.findTokenedQuoteForClient).mockResolvedValue({
      id: "quote-copy",
      token: "token-copy",
    } as never);

    const result = await resolveQuoteToken("client-1", "quote-copy");

    expect(result).toEqual({ id: "quote-copy", token: "token-copy" });
    expect(smsRepository.findTokenedQuoteForClient).toHaveBeenCalledWith("client-1", "quote-copy");
    expect(smsRepository.findLatestTokenedQuoteForClient).not.toHaveBeenCalled();
  });

  it("falls back to the latest-tokened quote when no quote id is supplied", async () => {
    vi.mocked(smsRepository.findLatestTokenedQuoteForClient).mockResolvedValue({
      id: "quote-latest",
      token: "token-latest",
    } as never);

    const result = await resolveQuoteToken("client-1");

    expect(result).toEqual({ id: "quote-latest", token: "token-latest" });
    expect(smsRepository.findTokenedQuoteForClient).not.toHaveBeenCalled();
  });

  it("rejects a quote id that doesn't belong to the target client, without falling back", async () => {
    // findTokenedQuoteForClient is scoped to clientId in the repository, so a
    // quote belonging to someone else comes back empty rather than throwing.
    vi.mocked(smsRepository.findTokenedQuoteForClient).mockResolvedValue(undefined as never);

    await expect(resolveQuoteToken("client-1", "someone-elses-quote")).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(smsRepository.findLatestTokenedQuoteForClient).not.toHaveBeenCalled();
  });

  it("returns undefined when no quote id is supplied and the client has no tokened quote", async () => {
    vi.mocked(smsRepository.findLatestTokenedQuoteForClient).mockResolvedValue(undefined as never);

    await expect(resolveQuoteToken("client-1")).resolves.toBeUndefined();
  });
});

describe("public quote message helpers", () => {
  it("builds the public /view-quote link", () => {
    expect(buildPublicQuoteUrl("tok")).toBe("https://app.test/view-quote/tok");
  });

  it("signs the message with the customer's own agency name, from data", () => {
    expect(buildPublicQuoteMessage({ firstName: "Ann", token: "tok", companyName: "Sunny Holidays" })).toEqual({
      text: "Hi Ann, your quote is ready - tap to view it: https://app.test/view-quote/tok - Sunny Holidays",
      quoteUrl: "https://app.test/view-quote/tok",
    });
  });

  it("carries no signature, and never a fixed agency name, when the agency name is missing", () => {
    for (const companyName of [undefined, null, "  "]) {
      const { text } = buildPublicQuoteMessage({ firstName: "Ann", token: "tok", companyName });
      expect(text).toBe("Hi Ann, your quote is ready - tap to view it: https://app.test/view-quote/tok");
      expect(text).not.toMatch(/Tina/i);
    }
  });

  it("tolerates a missing first name", () => {
    expect(buildPublicQuoteMessage({ firstName: null, token: "t" }).text).toMatch(/^Hi , your quote/);
  });
});
