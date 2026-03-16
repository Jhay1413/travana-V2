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
  transfers?: Record<string, unknown>[];
  carHires?: Record<string, unknown>[];
  attractionTickets?: Record<string, unknown>[];
  loungePasses?: Record<string, unknown>[];
  airportParkings?: Record<string, unknown>[];
  extraAccommodations?: Record<string, unknown>[];
}

interface BookingRelationPayload extends InsertBooking {
  outboundFlight?: Partial<InsertBookingFlight>;
  inboundFlight?: Partial<InsertBookingFlight>;
  outboundConnectingLegs?: Partial<InsertBookingFlight>[];
  inboundConnectingLegs?: Partial<InsertBookingFlight>[];
  primaryAccommodation?: Partial<InsertBookingAccomodation>;
  images?: string[];
  transfers?: Record<string, unknown>[];
  carHires?: Record<string, unknown>[];
  attractionTickets?: Record<string, unknown>[];
  loungePasses?: Record<string, unknown>[];
  airportParkings?: Record<string, unknown>[];
  extraAccommodations?: Record<string, unknown>[];
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
  async listTransactions(dateFrom?: Date, dateTo?: Date) {
    return await transactionRepository.findAll(dateFrom, dateTo);
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
    const {
      outboundFlight, inboundFlight, outboundConnectingLegs, inboundConnectingLegs, primaryAccommodation, images,
      transfers, carHires, attractionTickets, loungePasses, airportParkings, extraAccommodations,
      ...quoteFields
    } = quoteData;
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

    // Save extras for the main quote
    const mainQuoteId = result.quote.id;
    if (transfers !== undefined) await newQuoteRepository.replaceTransfers(mainQuoteId, transfers);
    if (carHires !== undefined) await newQuoteRepository.replaceCarHires(mainQuoteId, carHires);
    if (attractionTickets !== undefined) await newQuoteRepository.replaceAttractionTickets(mainQuoteId, attractionTickets);
    if (loungePasses !== undefined) await newQuoteRepository.replaceLoungePasses(mainQuoteId, loungePasses);
    if (airportParkings !== undefined) await newQuoteRepository.replaceAirportParkings(mainQuoteId, airportParkings);
    if (extraAccommodations !== undefined) await newQuoteRepository.replaceExtraAccommodations(mainQuoteId, extraAccommodations);

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
        transfers,
        carHires,
        attractionTickets,
        loungePasses,
        airportParkings,
        extraAccommodations,
      } as any);
    } catch (err) {
      console.error('🆓 FREE QUOTE - error creating free quote:', err);
    }

    return result;
  },

  async createTransactionWithBooking(transactionData: InsertTransaction, bookingData: BookingRelationPayload) {
    const {
      outboundFlight, inboundFlight, outboundConnectingLegs, inboundConnectingLegs, primaryAccommodation, images,
      transfers, carHires, attractionTickets, loungePasses, airportParkings, extraAccommodations,
      ...bookingFields
    } = bookingData;
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

    // Save extras for the booking
    const bookingId = result.booking.id;
    if (transfers?.length) {
      for (const t of transfers) {
        await bookingRepository.addTransfer({
          booking_id: bookingId,
          booking_ref: (t.booking_ref as string) || null,
          tour_operator_id: (t.tour_operator_id as string) || null,
          pick_up_location: (t.pick_up_location as string) || null,
          drop_off_location: (t.drop_off_location as string) || null,
          pick_up_time: toDateOrNull(t.pick_up_time),
          drop_off_time: toDateOrNull(t.drop_off_time),
          note: (t.note as string) || null,
          cost: t.cost != null ? String(t.cost) : null,
          commission: t.commission != null ? String(t.commission) : null,
          is_included_in_package: (t.is_included_in_package as boolean) ?? true,
        } as import("@shared/schema").InsertBookingTransfer);
      }
    }
    if (carHires?.length) {
      for (const c of carHires) {
        await bookingRepository.addCarHire({
          booking_id: bookingId,
          booking_ref: (c.booking_ref as string) || null,
          tour_operator_id: (c.tour_operator_id as string) || null,
          pick_up_location: (c.pick_up_location as string) || null,
          drop_off_location: (c.drop_off_location as string) || null,
          pick_up_time: toDateOrNull(c.pick_up_time),
          drop_off_time: toDateOrNull(c.drop_off_time),
          no_of_days: (c.no_of_days as number) ?? 1,
          driver_age: (c.driver_age as number) ?? 25,
          cost: c.cost != null ? String(c.cost) : null,
          commission: c.commission != null ? String(c.commission) : null,
          is_included_in_package: (c.is_included_in_package as boolean) ?? true,
        } as import("@shared/schema").InsertBookingCarHire);
      }
    }
    if (attractionTickets?.length) {
      for (const t of attractionTickets) {
        await bookingRepository.addAttractionTicket({
          booking_id: bookingId,
          booking_ref: (t.booking_ref as string) || null,
          tour_operator_id: (t.tour_operator_id as string) || null,
          ticket_type: (t.ticket_type as string) || null,
          date_of_visit: toDateOrNull(t.date_of_visit),
          number_of_tickets: (t.number_of_tickets as number) ?? 1,
          cost: t.cost != null ? String(t.cost) : null,
          commission: t.commission != null ? String(t.commission) : null,
          is_included_in_package: (t.is_included_in_package as boolean) ?? true,
        } as import("@shared/schema").InsertBookingAttractionTicket);
      }
    }
    if (loungePasses?.length) {
      for (const p of loungePasses) {
        await bookingRepository.addLoungePass({
          booking_id: bookingId,
          booking_ref: (p.booking_ref as string) || null,
          tour_operator_id: (p.tour_operator_id as string) || null,
          airport_id: (p.airport_id as string) || null,
          terminal: (p.terminal as string) || null,
          date_of_usage: toDateOrNull(p.date_of_usage),
          note: (p.note as string) || null,
          cost: p.cost != null ? String(p.cost) : null,
          commission: p.commission != null ? String(p.commission) : null,
          is_included_in_package: (p.is_included_in_package as boolean) ?? true,
        } as import("@shared/schema").InsertBookingLoungePass);
      }
    }
    if (airportParkings?.length) {
      for (const p of airportParkings) {
        await bookingRepository.addAirportParking({
          booking_id: bookingId,
          booking_ref: (p.booking_ref as string) || null,
          tour_operator_id: (p.tour_operator_id as string) || null,
          airport_id: (p.airport_id as string) || null,
          parking_type: (p.parking_type as string) || null,
          parking_date: toDateOrNull(p.parking_date),
          car_make: (p.car_make as string) || null,
          car_model: (p.car_model as string) || null,
          colour: (p.colour as string) || null,
          car_reg_number: (p.car_reg_number as string) || null,
          duration: (p.duration as string) || null,
          cost: p.cost != null ? String(p.cost) : null,
          commission: p.commission != null ? String(p.commission) : null,
          is_included_in_package: (p.is_included_in_package as boolean) ?? true,
        } as import("@shared/schema").InsertBookingAirportParking);
      }
    }
    if (extraAccommodations?.length) {
      for (const a of extraAccommodations) {
        await bookingRepository.addAccommodation({
          booking_id: bookingId,
          booking_ref: (a.booking_ref as string) || null,
          tour_operator_id: (a.tour_operator_id as string) || null,
          accomodation_id: (a.accomodation_id as string) || null,
          board_basis_id: (a.board_basis_id as string) || null,
          room_type: (a.room_type as string) || null,
          check_in_date_time: toDateOrNull(a.check_in_date_time),
          no_of_nights: (a.no_of_nights as number) ?? 0,
          cost: a.cost != null ? String(a.cost) : null,
          commission: a.commission != null ? String(a.commission) : null,
          is_included_in_package: (a.is_included_in_package as boolean) ?? true,
          is_primary: false,
        } as import("@shared/schema").InsertBookingAccomodation);
      }
    }

    return result;
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
