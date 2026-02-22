import { transactionRepository } from "../repositories/transaction.repository";
import { enquiryTableRepository } from "../repositories/enquiryTable.repository";
import { newQuoteRepository } from "../repositories/newQuote.repository";
import { bookingRepository } from "../repositories/booking.repository";
import { taskService } from "./task.service";
import { newQuoteService } from "./newQuote.service";
import { AppError } from "../utils/error-handler";
import type {
  InsertTransaction,
  InsertEnquiryTable,
  InsertQuote,
  InsertQuoteFlight,
  InsertQuoteAccomodation,
  InsertBooking,
  InsertBookingFlight,
  InsertBookingAccomodation,
} from "@shared/schema";
import { db } from "../config/database";
import { transaction, enquiry_table, quote, booking, quote_flights, quote_accomodation, booking_flights, booking_accomodation, quoteImages, deal_images, accommodation_images, lodge_images } from "@shared/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

interface EnquiryPassenger {
  type: string;
  age?: number;
}

interface CreateEnquiryPayload extends InsertEnquiryTable {
  destinations?: string[];
  resorts?: string[];
  boardBases?: string[];
  departureAirports?: string[];
  passengers?: EnquiryPassenger[];
  notes?: string[];
}

interface QuoteRelationPayload extends InsertQuote {
  outboundFlight?: Partial<InsertQuoteFlight>;
  inboundFlight?: Partial<InsertQuoteFlight>;
  outboundConnectingLegs?: Partial<InsertQuoteFlight>[];
  inboundConnectingLegs?: Partial<InsertQuoteFlight>[];
  primaryAccommodation?: Partial<InsertQuoteAccomodation>;
  images?: string[];
}

interface BookingRelationPayload extends InsertBooking {
  outboundFlight?: Partial<InsertBookingFlight>;
  inboundFlight?: Partial<InsertBookingFlight>;
  outboundConnectingLegs?: Partial<InsertBookingFlight>[];
  inboundConnectingLegs?: Partial<InsertBookingFlight>[];
  primaryAccommodation?: Partial<InsertBookingAccomodation>;
  images?: string[];
}

function toDateOrNull(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function convertFlightDates(flight: Record<string, unknown>): Record<string, unknown> {
  return {
    ...flight,
    departure_date_time: toDateOrNull(flight.departure_date_time),
    arrival_date_time: toDateOrNull(flight.arrival_date_time),
  };
}

function convertAccommodationDates(accom: Record<string, unknown>): Record<string, unknown> {
  return {
    ...accom,
    check_in_date_time: toDateOrNull(accom.check_in_date_time),
  };
}

function buildDateTimeFromParts(date: unknown, time: unknown): string | null {
  if (typeof date !== "string" || date.trim() === "") return null;
  if (typeof time === "string" && time.trim() !== "") return `${date}T${time}`;
  return date;
}

function normalizeUniqueImageUrls(images: string[] | undefined): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .map((url) => (typeof url === "string" ? url.trim() : ""))
    .filter((url) => url.length > 0)
    .filter((url, index, arr) => arr.indexOf(url) === index);
}

function normalizeFlightInput(input: unknown): Partial<InsertQuoteFlight> {
  if (!input || typeof input !== "object") return {};
  const leg = input as Record<string, unknown>;

  const departureDateTime =
    (leg.departure_date_time as string | Date | null | undefined) ||
    (leg.departureDateTime as string | Date | null | undefined) ||
    buildDateTimeFromParts(leg.departDate, leg.departTime);
  const arrivalDateTime =
    (leg.arrival_date_time as string | Date | null | undefined) ||
    (leg.arrivalDateTime as string | Date | null | undefined) ||
    buildDateTimeFromParts(leg.arriveDate, leg.arriveTime);

  return {
    departing_airport_id: (leg.departing_airport_id as string | undefined) || (leg.departAirportId as string | undefined) || null,
    arrival_airport_id: (leg.arrival_airport_id as string | undefined) || (leg.arriveAirportId as string | undefined) || null,
    departure_date_time: toDateOrNull(departureDateTime),
    arrival_date_time: toDateOrNull(arrivalDateTime),
    flight_number: (leg.flight_number as string | undefined) || (leg.flightNumber as string | undefined) || null,
    is_included_in_package:
      typeof leg.is_included_in_package === "boolean"
        ? leg.is_included_in_package
        : typeof leg.isIncludedInPackage === "boolean"
          ? (leg.isIncludedInPackage as boolean)
          : true,
  };
}

export const transactionService = {
  async listTransactions() {
    return await transactionRepository.findAll();
  },

  async listTransactionsLightweight() {
    return await transactionRepository.findAllLightweight();
  },

  async listPipelineByStatus(status: string, page: number, limit: number, agentId?: string, quoteStatusFilter?: string) {
    return await transactionRepository.findPipelineByStatus(status, page, limit, agentId, quoteStatusFilter);
  },

  async listTransactionsByClient(clientId: string) {
    return await transactionRepository.findByClientId(clientId);
  },

  async listTransactionsByAgent(agentId: string) {
    return await transactionRepository.findByAgentId(agentId);
  },

  async getTransactionById(id: string) {
    const txn = await transactionRepository.findById(id);
    if (!txn) throw new AppError("Transaction not found", 404);
    return txn;
  },

  async getTransactionWithDetails(id: string) {
    const txn = await transactionRepository.findWithDetails(id);
    if (!txn) throw new AppError("Transaction not found", 404);
    return txn;
  },

  async createTransaction(data: InsertTransaction) {
    return await transactionRepository.create(data);
  },

  async createTransactionWithEnquiry(transactionData: InsertTransaction, enquiryData: CreateEnquiryPayload) {
    const { destinations, resorts, boardBases, departureAirports, passengers, notes, ...enquiryFields } = enquiryData;

    const txn = await transactionRepository.create({
      ...transactionData,
      status: 'on_enquiry',
    });

    const enquiry = await enquiryTableRepository.create({
      ...enquiryFields,
      transaction_id: txn.id,
    });

    if (destinations?.length) {
      for (const destId of destinations) {
        await enquiryTableRepository.addDestination(enquiry.id, destId);
      }
    }
    if (resorts?.length) {
      for (const resortId of resorts) {
        await enquiryTableRepository.addResort(enquiry.id, resortId);
      }
    }
    if (boardBases?.length) {
      for (const bbId of boardBases) {
        await enquiryTableRepository.addBoardBasis(enquiry.id, bbId);
      }
    }
    if (departureAirports?.length) {
      for (const airportId of departureAirports) {
        await enquiryTableRepository.addDepartureAirport(enquiry.id, airportId);
      }
    }
    if (passengers?.length) {
      for (const p of passengers) {
        await enquiryTableRepository.addPassenger(enquiry.id, p.type, p.age ?? 0);
      }
    }

    return { transaction: txn, enquiry };
  },

  async createTransactionWithQuote(transactionData: InsertTransaction, quoteData: QuoteRelationPayload) {
    const { outboundFlight, inboundFlight, outboundConnectingLegs, inboundConnectingLegs, primaryAccommodation, images, ...quoteFields } = quoteData;
    const quoteDataRecord = quoteData as unknown as Record<string, unknown>;

    console.log('🔍 CREATE TXN+QUOTE - outboundConnectingLegs:', JSON.stringify(outboundConnectingLegs));
    console.log('🔍 CREATE TXN+QUOTE - inboundConnectingLegs:', JSON.stringify(inboundConnectingLegs));

    const normalizedOutboundFlight = normalizeFlightInput(outboundFlight);
    const normalizedInboundFlight = normalizeFlightInput(inboundFlight);
    const outboundConnectingSource = Array.isArray(outboundConnectingLegs)
      ? outboundConnectingLegs
      : Array.isArray(quoteDataRecord.outbound_connecting_legs)
        ? (quoteDataRecord.outbound_connecting_legs as unknown[])
        : Array.isArray(quoteDataRecord.outboundConnecting)
          ? (quoteDataRecord.outboundConnecting as unknown[])
        : [];
    const inboundConnectingSource = Array.isArray(inboundConnectingLegs)
      ? inboundConnectingLegs
      : Array.isArray(quoteDataRecord.inbound_connecting_legs)
        ? (quoteDataRecord.inbound_connecting_legs as unknown[])
        : Array.isArray(quoteDataRecord.inboundConnecting)
          ? (quoteDataRecord.inboundConnecting as unknown[])
        : [];
    const normalizedOutboundConnecting = outboundConnectingSource.map(normalizeFlightInput);
    const normalizedInboundConnecting = inboundConnectingSource.map(normalizeFlightInput);

    const result = await db.transaction(async (tx) => {
      const [txn] = await tx.insert(transaction).values({
        ...transactionData,
        status: 'on_quote',
      }).returning();

      const quoteValues: Record<string, unknown> = {
        ...quoteFields,
        transaction_id: txn.id,
      };
      if (quoteValues.date_expiry) quoteValues.date_expiry = toDateOrNull(quoteValues.date_expiry);
      if (quoteValues.deleted_at) quoteValues.deleted_at = toDateOrNull(quoteValues.deleted_at);
      const [q] = await tx.insert(quote).values(quoteValues as InsertQuote).returning();

      if (normalizedOutboundFlight && (normalizedOutboundFlight.departing_airport_id || normalizedOutboundFlight.arrival_airport_id || normalizedOutboundFlight.departure_date_time || normalizedOutboundFlight.arrival_date_time || normalizedOutboundFlight.flight_number)) {
        const converted = convertFlightDates(normalizedOutboundFlight as Record<string, unknown>);
        await tx.insert(quote_flights).values({
          ...converted,
          quote_id: q.id,
          flight_type: 'outbound',
          leg_order: 0,
        });
      }
      if (normalizedInboundFlight && (normalizedInboundFlight.departing_airport_id || normalizedInboundFlight.arrival_airport_id || normalizedInboundFlight.departure_date_time || normalizedInboundFlight.arrival_date_time || normalizedInboundFlight.flight_number)) {
        const converted = convertFlightDates(normalizedInboundFlight as Record<string, unknown>);
        await tx.insert(quote_flights).values({
          ...converted,
          quote_id: q.id,
          flight_type: 'inbound',
          leg_order: 0,
        });
      }

      if (normalizedOutboundConnecting.length) {
        for (let i = 0; i < normalizedOutboundConnecting.length; i++) {
          const leg = normalizedOutboundConnecting[i];
          if (!leg) continue;

          const hasLegData = Boolean(
            leg.departing_airport_id ||
            leg.arrival_airport_id ||
            leg.departure_date_time ||
            leg.arrival_date_time ||
            leg.flight_number
          );

          if (!hasLegData) continue;

          const converted = convertFlightDates(leg as Record<string, unknown>);
          await tx.insert(quote_flights).values({
            ...converted,
            quote_id: q.id,
            flight_type: 'outbound',
            leg_order: i + 1,
          });
        }
      }

      if (normalizedInboundConnecting.length) {
        for (let i = 0; i < normalizedInboundConnecting.length; i++) {
          const leg = normalizedInboundConnecting[i];
          if (!leg) continue;

          const hasLegData = Boolean(
            leg.departing_airport_id ||
            leg.arrival_airport_id ||
            leg.departure_date_time ||
            leg.arrival_date_time ||
            leg.flight_number
          );

          if (!hasLegData) continue;

          const converted = convertFlightDates(leg as Record<string, unknown>);
          await tx.insert(quote_flights).values({
            ...converted,
            quote_id: q.id,
            flight_type: 'inbound',
            leg_order: i + 1,
          });
        }
      }

      if (primaryAccommodation && primaryAccommodation.accomodation_id) {
        const converted = convertAccommodationDates(primaryAccommodation);
        await tx.insert(quote_accomodation).values({
          ...converted,
          quote_id: q.id,
          is_primary: true,
        });
      }

      const normalizedImages = normalizeUniqueImageUrls(images);

      if (normalizedImages.length > 0) {
        await tx.insert(quoteImages).values(
          normalizedImages.map((url, index) => ({
            id: randomUUID(),
            quoteId: q.id,
            url,
            isPrimary: index === 0,
          }))
        );

        // Also persist to accommodation_images (for default image lookup), ignore duplicates
        if (primaryAccommodation?.accomodation_id) {
          for (const url of normalizedImages) {
            await tx.insert(accommodation_images)
              .values({ accommodation_id: primaryAccommodation.accomodation_id as string, image_url: url })
              .onConflictDoNothing();
          }
        }

        // Also persist to lodge_images if quote has a lodge, ignore duplicates
        if (quoteFields.lodge_id) {
          for (const url of normalizedImages) {
            await tx.insert(lodge_images)
              .values({ lodge_id: quoteFields.lodge_id, image_url: url })
              .onConflictDoNothing();
          }
        }
      }

      return { transaction: txn, quote: q };
    });

    const { transaction: mainTxn } = result;
    try {
      const freeTxn = await transactionRepository.create({
        status: 'on_quote',
        user_id: mainTxn.user_id,
      } as InsertTransaction);

      await newQuoteService.createQuote({
        ...quoteFields,
        transaction_id: freeTxn.id,
        isFreeQuote: true,
        isQuoteCopy: false,
        outboundFlight: normalizedOutboundFlight,
        inboundFlight: normalizedInboundFlight,
        outboundConnectingLegs: normalizedOutboundConnecting,
        inboundConnectingLegs: normalizedInboundConnecting,
        primaryAccommodation: primaryAccommodation || undefined,
        images: normalizeUniqueImageUrls(images),
      } as any);
    } catch (err) {
      console.error('🆓 FREE QUOTE - error creating free quote:', err);
    }

    return result;
  },

  async createTransactionWithBooking(transactionData: InsertTransaction, bookingData: BookingRelationPayload) {
    const { outboundFlight, inboundFlight, outboundConnectingLegs, inboundConnectingLegs, primaryAccommodation, images, ...bookingFields } = bookingData;
    const bookingDataRecord = bookingData as unknown as Record<string, unknown>;

    const normalizedOutboundFlight = normalizeFlightInput(outboundFlight);
    const normalizedInboundFlight = normalizeFlightInput(inboundFlight);
    const outboundConnectingSource = Array.isArray(outboundConnectingLegs)
      ? outboundConnectingLegs
      : Array.isArray(bookingDataRecord.outbound_connecting_legs)
        ? (bookingDataRecord.outbound_connecting_legs as unknown[])
        : Array.isArray(bookingDataRecord.outboundConnecting)
          ? (bookingDataRecord.outboundConnecting as unknown[])
          : [];
    const inboundConnectingSource = Array.isArray(inboundConnectingLegs)
      ? inboundConnectingLegs
      : Array.isArray(bookingDataRecord.inbound_connecting_legs)
        ? (bookingDataRecord.inbound_connecting_legs as unknown[])
        : Array.isArray(bookingDataRecord.inboundConnecting)
          ? (bookingDataRecord.inboundConnecting as unknown[])
          : [];
    const normalizedOutboundConnecting = outboundConnectingSource.map(normalizeFlightInput);
    const normalizedInboundConnecting = inboundConnectingSource.map(normalizeFlightInput);

    return await db.transaction(async (tx) => {
      const [txn] = await tx.insert(transaction).values({
        ...transactionData,
        status: 'on_booking',
      }).returning();

      const bookingValues: Record<string, unknown> = {
        ...bookingFields,
        transaction_id: txn.id,
        booking_status: 'BOOKED',
      };
      if (bookingValues.deleted_at) bookingValues.deleted_at = toDateOrNull(bookingValues.deleted_at);
      const [b] = await tx.insert(booking).values(bookingValues as InsertBooking).returning();

      if (normalizedOutboundFlight && (normalizedOutboundFlight.departing_airport_id || normalizedOutboundFlight.arrival_airport_id || normalizedOutboundFlight.departure_date_time || normalizedOutboundFlight.arrival_date_time || normalizedOutboundFlight.flight_number)) {
        const converted = convertFlightDates(normalizedOutboundFlight as Record<string, unknown>);
        await tx.insert(booking_flights).values({
          ...converted,
          booking_id: b.id,
          flight_type: 'outbound',
        });
      }
      if (normalizedInboundFlight && (normalizedInboundFlight.departing_airport_id || normalizedInboundFlight.arrival_airport_id || normalizedInboundFlight.departure_date_time || normalizedInboundFlight.arrival_date_time || normalizedInboundFlight.flight_number)) {
        const converted = convertFlightDates(normalizedInboundFlight as Record<string, unknown>);
        await tx.insert(booking_flights).values({
          ...converted,
          booking_id: b.id,
          flight_type: 'inbound',
        });
      }

      if (normalizedOutboundConnecting.length) {
        for (const leg of normalizedOutboundConnecting) {
          if (!leg) continue;
          const hasLegData = Boolean(
            leg.departing_airport_id ||
            leg.arrival_airport_id ||
            leg.departure_date_time ||
            leg.arrival_date_time ||
            leg.flight_number
          );
          if (!hasLegData) continue;

          const converted = convertFlightDates(leg as Record<string, unknown>);
          await tx.insert(booking_flights).values({
            ...converted,
            booking_id: b.id,
            flight_type: 'outbound',
          });
        }
      }

      if (normalizedInboundConnecting.length) {
        for (const leg of normalizedInboundConnecting) {
          if (!leg) continue;
          const hasLegData = Boolean(
            leg.departing_airport_id ||
            leg.arrival_airport_id ||
            leg.departure_date_time ||
            leg.arrival_date_time ||
            leg.flight_number
          );
          if (!hasLegData) continue;

          const converted = convertFlightDates(leg as Record<string, unknown>);
          await tx.insert(booking_flights).values({
            ...converted,
            booking_id: b.id,
            flight_type: 'inbound',
          });
        }
      }
      if (primaryAccommodation && primaryAccommodation.accomodation_id) {
        const converted = convertAccommodationDates(primaryAccommodation);
        await tx.insert(booking_accomodation).values({
          ...converted,
          booking_id: b.id,
          is_primary: true,
        });
      }

      const normalizedImages = normalizeUniqueImageUrls(images);

      if (normalizedImages.length > 0) {
        await tx.insert(deal_images).values(
          normalizedImages.map((imageUrl, index) => ({
            id: randomUUID(),
            owner_id: b.id,
            image_url: imageUrl,
            isPrimary: index === 0,
          }))
        );

        // Also persist to accommodation_images (for default image lookup), ignore duplicates
        if (primaryAccommodation?.accomodation_id) {
          for (const imageUrl of normalizedImages) {
            await tx.insert(accommodation_images)
              .values({ accommodation_id: primaryAccommodation.accomodation_id as string, image_url: imageUrl })
              .onConflictDoNothing();
          }
        }

        // Also persist to lodge_images if booking has a lodge, ignore duplicates
        if (bookingFields.lodge_id) {
          for (const imageUrl of normalizedImages) {
            await tx.insert(lodge_images)
              .values({ lodge_id: bookingFields.lodge_id, image_url: imageUrl })
              .onConflictDoNothing();
          }
        }
      }

      return { transaction: txn, booking: b };
    });
  },

  async updateTransaction(id: string, data: Partial<InsertTransaction>) {
    // Get the current transaction to check if user_id is changing
    const oldTxn = await transactionRepository.findById(id);
    if (!oldTxn) throw new AppError("Transaction not found", 404);

    // Update the transaction
    const txn = await transactionRepository.update(id, data);
    if (!txn) throw new AppError("Transaction not found", 404);

    // If user_id changed, reassign all open tasks
    if (data.user_id && data.user_id !== oldTxn.user_id) {
      // Get all quotes/bookings/enquiries for this transaction
      const quotes = await newQuoteRepository.findByTransactionId(id);
      const bookings = await bookingRepository.findByTransactionId(id);
      const enquiries = await enquiryTableRepository.findByTransactionId(id);

      const bookingList = bookings ? [bookings] : [];
      const enquiryList = enquiries ? [enquiries] : [];

      // Reassign tasks for all related entities
      for (const q of quotes) {
        await taskService.reassignByEntity("quote", q.id, data.user_id);
      }
      for (const b of bookingList) {
        await taskService.reassignByEntity("booking", b.id, data.user_id);
      }
      for (const e of enquiryList) {
        await taskService.reassignByEntity("enquiry", e.id, data.user_id);
      }
    }

    return txn;
  },

  async deleteTransaction(id: string) {
    await transactionRepository.remove(id);
  },

  async getStats() {
    return await transactionRepository.getStats();
  },
};
