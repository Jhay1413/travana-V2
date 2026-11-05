import { newQuoteRepository } from "./quote.repository";
import { bookingRepository } from "../booking/booking.repository";
import { pricePerPersonText } from "../../utils/customer-price";

// price_per_person = (price − discounts + service charge + extras NOT included in the package) ÷ travellers.
// The extras are written after the quote/booking row, so the stored figure is refreshed once they are saved.

export async function refreshQuotePricePerPerson(quoteId: string): Promise<void> {
  const q = await newQuoteRepository.findById(quoteId);
  if (!q) return;
  const extrasTotal = await newQuoteRepository.getExtrasTotal(quoteId);
  const next = pricePerPersonText({ salesPrice: q.sales_price, discounts: q.discounts, serviceCharge: q.service_charge, extrasTotal, adults: q.adult, children: q.child });
  if (next !== String(q.price_per_person ?? "")) await newQuoteRepository.update(quoteId, { price_per_person: next });
}

export async function refreshBookingPricePerPerson(bookingId: string): Promise<void> {
  const b = await bookingRepository.findById(bookingId);
  if (!b) return;
  const extrasTotal = await bookingRepository.getExtrasTotal(bookingId);
  const next = pricePerPersonText({ salesPrice: b.sales_price, discounts: b.discounts, serviceCharge: b.service_charge, extrasTotal, adults: b.adult, children: b.child });
  if (next !== String(b.price_per_person ?? "")) await bookingRepository.update(bookingId, { price_per_person: next });
}
