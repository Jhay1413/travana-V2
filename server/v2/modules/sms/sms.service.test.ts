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

import { resolveQuoteToken, buildPublicQuoteUrl, buildPublicQuoteMessage } from "./sms.service";
import { smsRepository } from "./sms.repository";

beforeEach(() => {
  vi.clearAllMocks();
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

  it("renders the same body the Share dialog's Send button texts", () => {
    expect(buildPublicQuoteMessage({ firstName: "Ann", token: "tok" })).toEqual({
      text: "Hi Ann, your quote is ready - tap to view it: https://app.test/view-quote/tok - Tina's Travel",
      quoteUrl: "https://app.test/view-quote/tok",
    });
  });

  it("tolerates a missing first name", () => {
    expect(buildPublicQuoteMessage({ firstName: null, token: "t" }).text).toMatch(/^Hi , your quote/);
  });
});
