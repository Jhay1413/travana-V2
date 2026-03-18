import { db } from "../config/database";
import {
  quote, quote_accomodation,
  booking, booking_accomodation,
  transaction, clientTable,
  accomodation_list, resorts, destination, country,
  package_type, tour_operator,
} from "@shared/schema";
import { eq, and, or, ilike, desc, sql } from "drizzle-orm";

export type SearchResult = {
  clients: Array<{
    id: string;
    name: string;
    subtitle: string;
  }>;
  quotes: Array<{
    id: string;
    transactionId: string;
    clientId: string | null;
    clientName: string;
    destination: string;
    country: string;
    accommodation: string;
    salesPrice: string;
    travelDate: string;
    quoteStatus: string;
    holidayType: string;
  }>;
  bookings: Array<{
    id: string;
    transactionId: string;
    clientId: string | null;
    clientName: string;
    destination: string;
    country: string;
    accommodation: string;
    salesPrice: string;
    travelDate: string;
    haysRef: string;
    supplierRef: string;
    holidayType: string;
  }>;
};

export const searchRepository = {
  async globalSearch(searchTerm: string, clientLimit: number = 15, limit: number = 5): Promise<SearchResult> {
    const term = `%${searchTerm}%`;

    // Build per-word conditions so "tina smith" matches firstName="Tina" AND surename="Smith"
    const words = searchTerm.trim().split(/\s+/).filter(Boolean);
    const wordTerms = words.map((w) => `%${w}%`);
    const clientFirstNameConditions = wordTerms.map((t) => ilike(clientTable.firstName, t));
    const clientSurenameConditions = wordTerms.map((t) => ilike(clientTable.surename, t));

    const [clients, quotes, bookings] = await Promise.all([
      db
        .select({
          id: clientTable.id,
          title: clientTable.title,
          firstName: clientTable.firstName,
          surename: clientTable.surename,
          phoneNumber: clientTable.phoneNumber,
          email: clientTable.email,
          city: clientTable.city,
        })
        .from(clientTable)
        .where(
          or(
            ...clientFirstNameConditions,
            ...clientSurenameConditions,
            ilike(clientTable.email, term),
            ilike(clientTable.phoneNumber, term),
            ilike(clientTable.city, term),
            // Search by full name (concatenated) — handles "Tina Smith" as one query
            sql`concat_ws(' ', ${clientTable.firstName}, ${clientTable.surename}) ilike ${term}`,
          )
        )
        .limit(clientLimit),

      db
        .select({
          id: quote.id,
          transactionId: quote.transaction_id,
          clientId: transaction.client_id,
          clientFirstName: clientTable.firstName,
          clientSurename: clientTable.surename,
          destinationName: destination.name,
          countryName: country.country_name,
          accommodationName: accomodation_list.name,
          salesPrice: quote.sales_price,
          travelDate: quote.travel_date,
          quoteStatus: quote.quote_status,
          holidayTypeName: package_type.name,
          tourOperatorName: tour_operator.name,
        })
        .from(quote)
        .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
        .leftJoin(clientTable, eq(transaction.client_id, clientTable.id))
        .leftJoin(
          quote_accomodation,
          and(
            eq(quote_accomodation.quote_id, quote.id),
            eq(quote_accomodation.is_primary, true)
          )
        )
        .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
        .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
        .leftJoin(destination, eq(resorts.destination_id, destination.id))
        .leftJoin(country, eq(destination.country_id, country.id))
        .leftJoin(package_type, eq(quote.holiday_type_id, package_type.id))
        .leftJoin(tour_operator, eq(quote.main_tour_operator_id, tour_operator.id))
        .where(
          and(
            eq(quote.is_active, true),
            or(
              ilike(destination.name, term),
              ilike(country.country_name, term),
              ilike(accomodation_list.name, term),
              ilike(tour_operator.name, term),
              ilike(clientTable.firstName, term),
              ilike(clientTable.surename, term),
              ilike(quote.quote_ref, term),
            )
          )
        )
        .orderBy(desc(quote.date_created))
        .limit(limit),

      db
        .select({
          id: booking.id,
          transactionId: booking.transaction_id,
          clientId: transaction.client_id,
          clientFirstName: clientTable.firstName,
          clientSurename: clientTable.surename,
          destinationName: destination.name,
          countryName: country.country_name,
          accommodationName: accomodation_list.name,
          salesPrice: booking.sales_price,
          travelDate: booking.travel_date,
          haysRef: booking.hays_ref,
          supplierRef: booking.supplier_ref,
          holidayTypeName: package_type.name,
        })
        .from(booking)
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
        .leftJoin(clientTable, eq(transaction.client_id, clientTable.id))
        .leftJoin(
          booking_accomodation,
          and(
            eq(booking_accomodation.booking_id, booking.id),
            eq(booking_accomodation.is_primary, true)
          )
        )
        .leftJoin(accomodation_list, eq(booking_accomodation.accomodation_id, accomodation_list.id))
        .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
        .leftJoin(destination, eq(resorts.destination_id, destination.id))
        .leftJoin(country, eq(destination.country_id, country.id))
        .leftJoin(package_type, eq(booking.holiday_type_id, package_type.id))
        .where(
          and(
            eq(booking.is_active, true),
            or(
              ilike(destination.name, term),
              ilike(country.country_name, term),
              ilike(accomodation_list.name, term),
              ilike(booking.hays_ref, term),
              ilike(booking.supplier_ref, term),
              ilike(clientTable.firstName, term),
              ilike(clientTable.surename, term),
            )
          )
        )
        .orderBy(desc(booking.date_created))
        .limit(limit),
    ]);

    return {
      clients: clients.map((c) => ({
        id: c.id,
        name: [c.title, c.firstName, c.surename]
          .filter((v) => v && v !== "NULL")
          .join(" ")
          .trim() || "Unknown",
        subtitle: [c.phoneNumber, c.email, c.city].filter(Boolean).join(" · "),
      })),
      quotes: quotes.map((q) => ({
        id: q.id,
        transactionId: q.transactionId,
        clientId: q.clientId,
        clientName: [q.clientFirstName, q.clientSurename].filter(Boolean).join(" ").trim(),
        destination: q.destinationName || "",
        country: q.countryName || "",
        accommodation: q.accommodationName || "",
        salesPrice: q.salesPrice || "",
        travelDate: q.travelDate || "",
        quoteStatus: q.quoteStatus || "",
        holidayType: q.holidayTypeName || "",
      })),
      bookings: bookings.map((b) => ({
        id: b.id,
        transactionId: b.transactionId,
        clientId: b.clientId,
        clientName: [b.clientFirstName, b.clientSurename].filter(Boolean).join(" ").trim(),
        destination: b.destinationName || "",
        country: b.countryName || "",
        accommodation: b.accommodationName || "",
        salesPrice: b.salesPrice || "",
        travelDate: b.travelDate || "",
        haysRef: b.haysRef || "",
        supplierRef: b.supplierRef || "",
        holidayType: b.holidayTypeName || "",
      })),
    };
  },
};
