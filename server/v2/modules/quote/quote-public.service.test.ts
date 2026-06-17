import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./quote-public.repository", () => ({
  quotePublicRepository: {
    findByToken: vi.fn(),
    findQuoteIdByToken: vi.fn(),
    logView: vi.fn(),
    createCustomerAction: vi.fn(),
    notifyAgent: vi.fn(),
  },
}));

import { quotePublicService } from "./quote-public.service";
import { quotePublicRepository } from "./quote-public.repository";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("quotePublicService.getQuoteByToken — price math", () => {
  it("derives totalPrice and pricePerPerson from the stored figures", async () => {
    vi.mocked(quotePublicRepository.findByToken).mockResolvedValue({
      salesPrice: "1000",
      discounts: "100",
      serviceCharge: "50",
      adults: 2,
      children: 0,
    } as never);

    const result = await quotePublicService.getQuoteByToken("tok");

    expect(result.totalPrice).toBe("950.00"); // 1000 − 100 + 50
    expect(result.pricePerPerson).toBe("475.00"); // 950 / 2
  });

  it("returns 0.00 per person when there are no passengers", async () => {
    vi.mocked(quotePublicRepository.findByToken).mockResolvedValue({
      salesPrice: "1000",
      adults: 0,
      children: 0,
    } as never);

    const result = await quotePublicService.getQuoteByToken("tok");

    expect(result.pricePerPerson).toBe("0.00");
  });

  it("throws 404 for an unknown token", async () => {
    vi.mocked(quotePublicRepository.findByToken).mockResolvedValue(undefined as never);

    await expect(quotePublicService.getQuoteByToken("nope")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("quotePublicService.logView", () => {
  it("throws 404 when the token resolves to no quote", async () => {
    vi.mocked(quotePublicRepository.findQuoteIdByToken).mockResolvedValue(undefined as never);

    await expect(quotePublicService.logView("nope", {} as never)).rejects.toMatchObject({ statusCode: 404 });
    expect(quotePublicRepository.logView).not.toHaveBeenCalled();
  });
});
