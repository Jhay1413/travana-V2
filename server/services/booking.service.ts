import { bookingRepository } from "../repositories/booking.repository";
import { newQuoteRepository } from "../repositories/newQuote.repository";
import { transactionRepository } from "../repositories/transaction.repository";
import { AppError } from "../utils/error-handler";
import type { InsertBooking } from "@shared/schema";

export const bookingService = {
  async listBookings() {
    return await bookingRepository.findAll();
  },

  async getBookingById(id: string) {
    const b = await bookingRepository.findById(id);
    if (!b) throw new AppError("Booking not found", 404);
    return b;
  },

  async getBookingByTransactionId(transactionId: string) {
    const b = await bookingRepository.findByTransactionId(transactionId);
    if (!b) throw new AppError("Booking not found for this transaction", 404);
    return b;
  },

  async getBookingWithDetails(id: string) {
    const b = await bookingRepository.findWithDetails(id);
    if (!b) throw new AppError("Booking not found", 404);
    return b;
  },

  async convertQuoteToBooking(quoteId: string, haysRef: string, supplierRef: string) {
    const q = await newQuoteRepository.findById(quoteId);
    if (!q) throw new AppError("Quote not found", 404);

    const existingBooking = await bookingRepository.findByTransactionId(q.transaction_id);
    if (existingBooking) throw new AppError("Transaction already has a booking", 400);

    const b = await bookingRepository.create({
      transaction_id: q.transaction_id,
      holiday_type_id: q.holiday_type_id,
      hays_ref: haysRef,
      supplier_ref: supplierRef,
      sales_price: q.sales_price,
      package_commission: q.package_commission,
      travel_date: q.travel_date,
      title: q.title,
      discounts: q.discounts,
      service_charge: q.service_charge,
      num_of_nights: q.num_of_nights,
      pets: q.pets,
      cottage_id: q.cottage_id,
      lodge_id: q.lodge_id,
      lodge_type: q.lodge_type,
      transfer_type: q.transfer_type,
      infant: q.infant || 0,
      child: q.child || 0,
      adult: q.adult || 0,
      booking_status: 'BOOKED',
      main_tour_operator_id: q.main_tour_operator_id,
      deal_type: q.deal_type,
      pre_booked_seats: q.pre_booked_seats,
      flight_meals: q.flight_meals,
    });

    await newQuoteRepository.update(quoteId, { quote_status: 'WON' });
    await transactionRepository.update(q.transaction_id, { status: 'on_booking' });

    return b;
  },

  async createBooking(data: InsertBooking) {
    const txn = await transactionRepository.findById(data.transaction_id);
    if (!txn) throw new AppError("Transaction not found", 404);

    const existingBooking = await bookingRepository.findByTransactionId(data.transaction_id);
    if (existingBooking) throw new AppError("Transaction already has a booking", 400);

    const b = await bookingRepository.create(data);
    await transactionRepository.update(data.transaction_id, { status: 'on_booking' });
    return b;
  },

  async updateBooking(id: string, data: Partial<InsertBooking>) {
    const b = await bookingRepository.update(id, data);
    if (!b) throw new AppError("Booking not found", 404);
    return b;
  },

  async deleteBooking(id: string) {
    await bookingRepository.remove(id);
  },
};
