import { describe, it, expect, vi } from "vitest";
import { generateQuoteToken, looksLikeQuoteToken, mintQuoteToken, QUOTE_TOKEN_ALPHABET } from "./quote-token";

describe("generateQuoteToken", () => {
  it("is 20 characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const token = generateQuoteToken();
      expect(token).toHaveLength(20);
      expect(token).toMatch(/^[A-HJ-NP-Za-km-z2-9]{20}$/);
    }
    expect(QUOTE_TOKEN_ALPHABET).not.toMatch(/[01OlI]/);
  });

  it("honours a shorter length and never repeats across many tokens", () => {
    expect(generateQuoteToken(12)).toHaveLength(12);
    const seen = new Set(Array.from({ length: 2000 }, () => generateQuoteToken()));
    expect(seen.size).toBe(2000);
  });

  it("discards bytes that would bias the choice", () => {
    const size = QUOTE_TOKEN_ALPHABET.length;
    const limit = 256 - (256 % size);
    const bytes = new Uint8Array(40).fill(255);
    bytes[39] = 0;
    const source = vi.fn().mockReturnValueOnce(bytes).mockReturnValue(new Uint8Array(40).fill(1));
    const token = generateQuoteToken(1, source);
    expect(255).toBeGreaterThanOrEqual(limit);
    expect(token).toBe(QUOTE_TOKEN_ALPHABET[0]);
  });
});

describe("mintQuoteToken", () => {
  it("retries while the token is taken", async () => {
    const isTaken = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValue(false);
    const token = await mintQuoteToken(isTaken);
    expect(isTaken).toHaveBeenCalledTimes(3);
    expect(token).toHaveLength(20);
  });

  it("gives up after the attempts are used", async () => {
    await expect(mintQuoteToken(async () => true, 20, 3)).rejects.toThrow("Could not mint");
  });
});

describe("looksLikeQuoteToken", () => {
  it("accepts old 6 and 8 character tokens and new 20 character ones, rejects the rest", () => {
    expect(looksLikeQuoteToken("ABC234")).toBe(true);
    expect(looksLikeQuoteToken("aB3dE6gH")).toBe(true);
    expect(looksLikeQuoteToken(generateQuoteToken())).toBe(true);
    expect(looksLikeQuoteToken("a b")).toBe(false);
    expect(looksLikeQuoteToken("x".repeat(65))).toBe(false);
    expect(looksLikeQuoteToken("%27--")).toBe(false);
  });
});
