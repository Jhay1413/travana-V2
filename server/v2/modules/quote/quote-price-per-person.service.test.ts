import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./quote.repository", () => ({ newQuoteRepository: { findById: vi.fn(), getExtrasTotal: vi.fn(), update: vi.fn() } }));
vi.mock("../booking/booking.repository", () => ({ bookingRepository: { findById: vi.fn(), getExtrasTotal: vi.fn(), update: vi.fn() } }));

import { newQuoteRepository } from "./quote.repository";
import { bookingRepository } from "../booking/booking.repository";
import { refreshBookingPricePerPerson, refreshQuotePricePerPerson } from "./quote-price-per-person.service";

const row = { sales_price: "2000.00", discounts: "100.00", service_charge: "0.00", adult: 2, child: 0, price_per_person: "950.00" };

beforeEach(() => vi.clearAllMocks());

describe("refreshQuotePricePerPerson", () => {
  it("includes the not-included extras in the stored per-person price", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue(row as never);
    vi.mocked(newQuoteRepository.getExtrasTotal).mockResolvedValue(200);
    await refreshQuotePricePerPerson("q1");
    expect(newQuoteRepository.update).toHaveBeenCalledWith("q1", { price_per_person: "1050.00" });
  });

  it("does not write when nothing changed, or when the quote is gone", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue(row as never);
    vi.mocked(newQuoteRepository.getExtrasTotal).mockResolvedValue(0);
    await refreshQuotePricePerPerson("q1");
    vi.mocked(newQuoteRepository.findById).mockResolvedValue(undefined);
    await refreshQuotePricePerPerson("q2");
    expect(newQuoteRepository.update).not.toHaveBeenCalled();
  });
});

describe("refreshBookingPricePerPerson", () => {
  it("includes the not-included extras for a booking", async () => {
    vi.mocked(bookingRepository.findById).mockResolvedValue(row as never);
    vi.mocked(bookingRepository.getExtrasTotal).mockResolvedValue(100);
    await refreshBookingPricePerPerson("b1");
    expect(bookingRepository.update).toHaveBeenCalledWith("b1", { price_per_person: "1000.00" });
  });
});
