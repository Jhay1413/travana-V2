import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { transactionRepository } from "./transaction.repository";
import { db } from "../../config/database";
import {
  transaction, quote, booking, quote_flights, booking_flights, quoteImages, bookingImages,
} from "@shared/schema";
import { truncateAll, makeOrg, makeBranch, makeUser, makePackageType } from "../../test/factories";

let orgA: { id: string };
let branchA1: { id: string };
let agent: { id: string };
let pkg: { id: string };
let scope: never;

beforeEach(async () => {
  await truncateAll();
  orgA = await makeOrg();
  branchA1 = await makeBranch(orgA.id);
  agent = await makeUser();
  pkg = await makePackageType();
  scope = { orgId: orgA.id, branchId: branchA1.id, orgRole: "agent", orgRoles: ["agent"], userId: agent.id } as never;
});

describe("transactionRepository.createWithQuoteAndChildren — atomic add quote", () => {
  it("inserts transaction (on_quote) + quote + flight + images in one go", async () => {
    const result = await transactionRepository.createWithQuoteAndChildren({
      transactionData: { user_id: agent.id } as never,
      quoteFields: { holiday_type_id: pkg.id, travel_date: "2026-12-01", quote_type: "package" } as never,
      outboundFlight: { flight_number: "BA1" },
      inboundFlight: null,
      images: ["img1", "img2"],
      scope,
    });

    expect(result.transaction).toMatchObject({ status: "on_quote", org_id: orgA.id, branch_id: branchA1.id });

    const [q] = await db.select().from(quote).where(eq(quote.id, result.quote.id));
    expect(q.transaction_id).toBe(result.transaction.id);

    const flights = await db.select().from(quote_flights).where(eq(quote_flights.quote_id, result.quote.id));
    expect(flights).toHaveLength(1);
    expect(flights[0]).toMatchObject({ flight_number: "BA1", flight_type: "outbound" });

    const imgs = await db.select().from(quoteImages).where(eq(quoteImages.quoteId, result.quote.id));
    expect(imgs).toHaveLength(2);
    expect(imgs.filter((i) => i.isPrimary)).toHaveLength(1);
  });

  it("rolls back the whole write when a child insert fails (atomicity)", async () => {
    await expect(
      transactionRepository.createWithQuoteAndChildren({
        transactionData: { user_id: agent.id } as never,
        // holiday_type_id references a non-existent package_type → FK violation on
        // the quote insert, AFTER the transaction row was inserted.
        quoteFields: {
          holiday_type_id: "00000000-0000-0000-0000-000000000000",
          travel_date: "2026-12-01",
          quote_type: "package",
        } as never,
        scope,
      }),
    ).rejects.toThrow();

    // The transaction row must NOT have been committed.
    expect(await db.select().from(transaction)).toHaveLength(0);
    expect(await db.select().from(quote)).toHaveLength(0);
  });
});

describe("transactionRepository.createWithBookingAndChildren — atomic add booking", () => {
  it("inserts transaction (on_booking) + booking (BOOKED) + flight + images in one go", async () => {
    const result = await transactionRepository.createWithBookingAndChildren({
      transactionData: { user_id: agent.id } as never,
      bookingFields: { holiday_type_id: pkg.id, hays_ref: "H1", supplier_ref: "S1", travel_date: "2026-12-01" } as never,
      outboundFlight: { flight_number: "BA9" },
      inboundFlight: null,
      images: ["bimg"],
      scope,
    });

    expect(result.transaction).toMatchObject({ status: "on_booking", org_id: orgA.id, branch_id: branchA1.id });
    expect(result.booking.booking_status).toBe("BOOKED");

    const [b] = await db.select().from(booking).where(eq(booking.id, result.booking.id));
    expect(b.transaction_id).toBe(result.transaction.id);

    const flights = await db.select().from(booking_flights).where(eq(booking_flights.booking_id, result.booking.id));
    expect(flights).toHaveLength(1);
    expect(flights[0]).toMatchObject({ flight_number: "BA9", flight_type: "outbound" });

    const imgs = await db.select().from(bookingImages).where(eq(bookingImages.bookingId, result.booking.id));
    expect(imgs).toHaveLength(1);
  });

  it("rolls back when the booking insert fails (atomicity)", async () => {
    await expect(
      transactionRepository.createWithBookingAndChildren({
        transactionData: { user_id: agent.id } as never,
        // missing required hays_ref/supplier_ref (NOT NULL) → booking insert fails.
        bookingFields: { holiday_type_id: pkg.id, travel_date: "2026-12-01" } as never,
        scope,
      }),
    ).rejects.toThrow();

    expect(await db.select().from(transaction)).toHaveLength(0);
    expect(await db.select().from(booking)).toHaveLength(0);
  });
});
