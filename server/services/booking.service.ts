import { bookingRepository } from "../repositories/booking.repository";
import { newQuoteRepository } from "../repositories/newQuote.repository";
import { transactionRepository } from "../repositories/transaction.repository";
import { neonClientRepository } from "../repositories/neonClient.repository";
import { AppError } from "../utils/error-handler";
import type {
  InsertBooking,
  InsertBookingFlight,
  InsertBookingAccomodation,
  InsertBookingTransfer,
  InsertBookingCarHire,
  InsertBookingAttractionTicket,
  InsertBookingLoungePass,
  InsertBookingAirportParking,
  InsertBookingCruise,
  InsertBookingCruiseItemExtra,
  InsertBookingCruiseItinerary,
} from "@shared/schema";

function calcPricePerPerson(salesPrice: unknown, adult: unknown, child: unknown): string {
  const price = parseFloat(String(salesPrice ?? 0)) || 0;
  const adults = parseInt(String(adult ?? 0), 10) || 0;
  const children = parseInt(String(child ?? 0), 10) || 0;
  const total = adults + children;
  return total > 0 ? (price / total).toFixed(2) : "0.00";
}

interface BookingRelationData {
  outboundFlight?: Partial<InsertBookingFlight>;
  inboundFlight?: Partial<InsertBookingFlight>;
  primaryAccommodation?: Partial<InsertBookingAccomodation>;
}

type UpdateBookingPayload = Partial<InsertBooking> & BookingRelationData;

export const bookingService = {
  async listBookings() {
    return await bookingRepository.findAllWithImages();
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

    const txn = await transactionRepository.findById(q.transaction_id);
    if (!txn) throw new AppError("Transaction not found", 404);

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
      price_per_person: calcPricePerPerson(q.sales_price, q.adult, q.child),
      booking_status: 'BOOKED',
      main_tour_operator_id: q.main_tour_operator_id,
      deal_type: q.deal_type,
      pre_booked_seats: q.pre_booked_seats,
      flight_meals: q.flight_meals,
    });

    const quoteDetails = await newQuoteRepository.findWithDetails(quoteId);
    if (quoteDetails) {
      for (const f of quoteDetails.flights || []) {
        await bookingRepository.addFlight({
          booking_id: b.id,
          flight_number: f.flight_number,
          flight_ref: f.flight_ref,
          departing_airport_id: f.departing_airport_id,
          arrival_airport_id: f.arrival_airport_id,
          tour_operator_id: f.tour_operator_id,
          flight_type: f.flight_type,
          departure_date_time: f.departure_date_time,
          arrival_date_time: f.arrival_date_time,
          is_included_in_package: f.is_included_in_package,
          cost: f.cost,
          commission: f.commission,
        } as InsertBookingFlight);
      }
      for (const a of quoteDetails.accommodations || []) {
        await bookingRepository.addAccommodation({
          booking_id: b.id,
          booking_ref: a.booking_ref,
          tour_operator_id: a.tour_operator_id,
          no_of_nights: a.no_of_nights,
          room_type: a.room_type,
          board_basis_id: a.board_basis_id,
          check_in_date_time: a.check_in_date_time,
          stay_type: a.stay_type,
          is_primary: a.is_primary,
          is_included_in_package: a.is_included_in_package,
          cost: a.cost,
          commission: a.commission,
          accomodation_id: a.accomodation_id,
        } as InsertBookingAccomodation);
      }
      for (const t of quoteDetails.transfers || []) {
        await bookingRepository.addTransfer({
          booking_id: b.id,
          booking_ref: t.booking_ref,
          tour_operator_id: t.tour_operator_id,
          pick_up_location: t.pick_up_location,
          drop_off_location: t.drop_off_location,
          pick_up_time: t.pick_up_time,
          drop_off_time: t.drop_off_time,
          is_included_in_package: t.is_included_in_package,
          cost: t.cost,
          commission: t.commission,
          note: t.note,
        } as InsertBookingTransfer);
      }
      for (const c of quoteDetails.carHires || []) {
        await bookingRepository.addCarHire({
          booking_id: b.id,
          booking_ref: c.booking_ref,
          tour_operator_id: c.tour_operator_id,
          pick_up_location: c.pick_up_location,
          drop_off_location: c.drop_off_location,
          pick_up_time: c.pick_up_time,
          drop_off_time: c.drop_off_time,
          no_of_days: c.no_of_days,
          driver_age: c.driver_age,
          is_included_in_package: c.is_included_in_package,
          cost: c.cost,
          commission: c.commission,
        } as InsertBookingCarHire);
      }
      for (const t of quoteDetails.attractionTickets || []) {
        await bookingRepository.addAttractionTicket({
          booking_id: b.id,
          booking_ref: t.booking_ref,
          tour_operator_id: t.tour_operator_id,
          ticket_type: t.ticket_type,
          date_of_visit: t.date_of_visit,
          cost: t.cost,
          commission: t.commission,
          number_of_tickets: t.number_of_tickets,
          is_included_in_package: t.is_included_in_package,
        } as InsertBookingAttractionTicket);
      }
      for (const p of quoteDetails.loungePasses || []) {
        await bookingRepository.addLoungePass({
          booking_id: b.id,
          booking_ref: p.booking_ref,
          terminal: p.terminal,
          airport_id: p.airport_id,
          date_of_usage: p.date_of_usage,
          tour_operator_id: p.tour_operator_id,
          cost: p.cost,
          commission: p.commission,
          is_included_in_package: p.is_included_in_package,
          note: p.note,
        } as InsertBookingLoungePass);
      }
      for (const p of quoteDetails.airportParkings || []) {
        await bookingRepository.addAirportParking({
          booking_id: b.id,
          booking_ref: p.booking_ref,
          airport_id: p.airport_id,
          parking_type: p.parking_type,
          parking_date: p.parking_date,
          car_make: p.car_make,
          car_model: p.car_model,
          colour: p.colour,
          car_reg_number: p.car_reg_number,
          duration: p.duration,
          tour_operator_id: p.tour_operator_id,
          is_included_in_package: p.is_included_in_package,
          cost: p.cost,
          commission: p.commission,
        } as InsertBookingAirportParking);
      }
      for (const c of quoteDetails.cruises || []) {
        const bookingCruise = await bookingRepository.addCruise({
          booking_id: b.id,
          tour_operator_id: c.tour_operator_id,
          cruise_line: c.cruise_line,
          ship: c.ship,
          cruise_date: c.cruise_date,
          cabin_type: c.cabin_type,
          cruise_name: c.cruise_name,
          pre_cruise_stay: c.pre_cruise_stay,
          post_cruise_stay: c.post_cruise_stay,
        } as InsertBookingCruise);
        for (const extra of c.extras || []) {
          await bookingRepository.addCruiseItemExtra({
            booking_cruise_id: bookingCruise.id,
            cruise_extra_id: extra.cruise_extra_id,
          } as InsertBookingCruiseItemExtra);
        }
        for (const item of c.itinerary || []) {
          await bookingRepository.addCruiseItinerary({
            booking_cruise_id: bookingCruise.id,
            day_number: item.day_number,
            description: item.description,
          } as InsertBookingCruiseItinerary);
        }
      }
    }

    await newQuoteRepository.update(quoteId, { quote_status: 'WON' });
    await transactionRepository.update(q.transaction_id, { status: 'on_booking' });

    // Check if client should be upgraded to VIP (3+ bookings)
    if (txn.client_id) {
      const bookingCount = await bookingRepository.countByClientId(txn.client_id);
      if (bookingCount >= 3) {
        await neonClientRepository.update(txn.client_id, { badge: 'VIP Client' });
      }
    }

    return b;
  },

  async createBooking(data: InsertBooking) {
    const txn = await transactionRepository.findById(data.transaction_id);
    if (!txn) throw new AppError("Transaction not found", 404);

    const existingBooking = await bookingRepository.findByTransactionId(data.transaction_id);
    if (existingBooking) throw new AppError("Transaction already has a booking", 400);

    const b = await bookingRepository.create({
      ...data,
      price_per_person: calcPricePerPerson(data.sales_price, data.adult, data.child),
    });
    await transactionRepository.update(data.transaction_id, { status: 'on_booking' });

    // Check if client should be upgraded to VIP (3+ bookings)
    if (txn.client_id) {
      const bookingCount = await bookingRepository.countByClientId(txn.client_id);
      if (bookingCount >= 3) {
        await neonClientRepository.update(txn.client_id, { badge: 'VIP Client' });
      }
    }

    return b;
  },

  async updateBooking(id: string, data: UpdateBookingPayload) {
    console.log('🔍 BOOKING UPDATE - ID:', id);
    console.log('🔍 BOOKING UPDATE - Received data:', JSON.stringify(data, null, 2));
    
    const {
      outboundFlight, inboundFlight, primaryAccommodation,
      ...bookingFields
    } = data;

    const bookingData: Partial<InsertBooking> = {};
    const directFields: (keyof InsertBooking)[] = [
      'holiday_type_id', 'sales_price', 'package_commission', 'travel_date',
      'discounts', 'service_charge', 'num_of_nights', 'pets', 'cottage_id',
      'lodge_id', 'lodge_type', 'transfer_type', 'booking_status',
      'main_tour_operator_id', 'deal_type', 'pre_booked_seats', 'flight_meals',
      'infant', 'child', 'adult', 'title', 'hays_ref', 'supplier_ref',
      'price_per_person',
    ];
    for (const key of directFields) {
      if (key in bookingFields) {
        (bookingData[key] as InsertBooking[typeof key]) = (bookingFields as Record<string, unknown>)[key] as InsertBooking[typeof key];
      }
    }

    // Recalculate price_per_person if any pricing/passenger fields changed
    if ('sales_price' in bookingData || 'adult' in bookingData || 'child' in bookingData) {
      const current = await bookingRepository.findById(id);
      if (current) {
        bookingData.price_per_person = calcPricePerPerson(
          bookingData.sales_price ?? current.sales_price,
          bookingData.adult ?? current.adult,
          bookingData.child ?? current.child,
        );
      }
    }

    console.log('🔍 BOOKING UPDATE - Booking data to update:', bookingData);
    console.log('🔍 BOOKING UPDATE - Flight updates:', { outboundFlight, inboundFlight });
    console.log('🔍 BOOKING UPDATE - Accommodation update:', primaryAccommodation);

    const b = await bookingRepository.update(id, bookingData);
    if (!b) throw new AppError("Booking not found", 404);

    if (outboundFlight) {
      await bookingRepository.upsertFlightByType(id, "outbound", outboundFlight);
    }
    if (inboundFlight) {
      await bookingRepository.upsertFlightByType(id, "inbound", inboundFlight);
    }
    if (primaryAccommodation) {
      await bookingRepository.upsertPrimaryAccommodation(id, primaryAccommodation);
    }

    return await bookingRepository.findWithDetails(id);
  },

  async deleteBooking(id: string) {
    await bookingRepository.remove(id);
  },

  async addFlight(bookingId: string, flightData: Omit<InsertBookingFlight, 'booking_id'>) {
    return await bookingRepository.addFlight({ ...flightData, booking_id: bookingId });
  },

  async removeFlight(flightId: string) {
    await bookingRepository.removeFlight(flightId);
  },

  async addAccommodation(bookingId: string, accommodationData: Omit<InsertBookingAccomodation, 'booking_id'>) {
    return await bookingRepository.addAccommodation({ ...accommodationData, booking_id: bookingId });
  },

  async removeAccommodation(accommodationId: string) {
    await bookingRepository.removeAccommodation(accommodationId);
  },
};
