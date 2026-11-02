import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { transactionRepository } from "./transaction.repository";
import { db } from "../../config/database";
import {
  transaction, quote, booking, quote_flights, booking_flights, quoteImages, bookingImages,
  enquiry_table, enquiry_passenger, notes,
} from "@shared/schema";
import {
  truncateAll, makeOrg, makeBranch, makeUser, makePackageType, makeClient, makeTransaction, makeQuote,
} from "../../test/factories";

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

describe("transactionRepository.createWithEnquiryAndChildren — atomic add enquiry", () => {
  it("inserts transaction (on_enquiry) + enquiry + relations + passengers + notes together", async () => {
    const result = await transactionRepository.createWithEnquiryAndChildren({
      transactionData: { user_id: agent.id } as never,
      enquiryFields: { holiday_type_id: pkg.id, title: "Beach" },
      passengers: [{ type: "adult", age: 0 }, { type: "child", age: 7 }],
      notes: [{ content: "<p>hi</p>", agent_id: agent.id }],
      scope,
    });

    expect(result.transaction).toMatchObject({ status: "on_enquiry", org_id: orgA.id, branch_id: branchA1.id });
    expect(result.enquiry).toMatchObject({ transaction_id: result.transaction.id, title: "Beach" });
    expect(await db.select().from(enquiry_passenger).where(eq(enquiry_passenger.enquiry_id, result.enquiry.id))).toHaveLength(2);
    const noteRows = await db.select().from(notes).where(eq(notes.transaction_id, result.transaction.id));
    expect(noteRows).toHaveLength(1);
    expect(noteRows[0]).toMatchObject({ content: "<p>hi</p>", agent_id: agent.id });
  });

  it("leaves no transaction behind when the enquiry insert fails (no holiday type)", async () => {
    await expect(
      transactionRepository.createWithEnquiryAndChildren({
        transactionData: { user_id: agent.id } as never,
        // holiday_type_id is NOT NULL: the enquiry insert fails AFTER the transaction row was inserted.
        enquiryFields: { title: "No type" } as never,
        scope,
      }),
    ).rejects.toThrow();

    expect(await db.select().from(transaction)).toHaveLength(0);
    expect(await db.select().from(enquiry_table)).toHaveLength(0);
  });

  it("rolls back transaction and enquiry when a later child insert fails", async () => {
    await expect(
      transactionRepository.createWithEnquiryAndChildren({
        transactionData: { user_id: agent.id } as never,
        enquiryFields: { holiday_type_id: pkg.id },
        // Not a destination row: FK violation on enquiry_destination after the first two inserts.
        destinations: ["00000000-0000-0000-0000-000000000000"],
        scope,
      }),
    ).rejects.toThrow();

    expect(await db.select().from(transaction)).toHaveLength(0);
    expect(await db.select().from(enquiry_table)).toHaveLength(0);
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

describe("transactionRepository.findExpiringQuotes — date-driven (no is_expired flag)", () => {
  // Selects on_quote quotes whose effective expiry is at/before now+7d, regardless
  // of the legacy is_expired flag. Verifies the flag-filter removal: an already
  // date-expired quote is still returned (so the UI can badge it "expired").
  it("returns expired + near-expiry quotes and excludes far-future ones", async () => {
    const client = await makeClient({ orgId: orgA.id });
    const now = Date.now();
    const txnQuote = async () =>
      makeTransaction({ user_id: agent.id, org_id: orgA.id, branch_id: branchA1.id, client_id: client.id, status: "on_quote" });

    const tPast = await txnQuote();
    const tNear = await txnQuote();
    const tFuture = await txnQuote();

    const baseQuote = { holiday_type_id: pkg.id, is_active: true, isFreeQuote: false, isQuoteCopy: false } as never;
    const qPast = await makeQuote({ ...(baseQuote as object), transaction_id: tPast.id, date_expiry: new Date(now - 2 * 86_400_000) } as never);
    const qNear = await makeQuote({ ...(baseQuote as object), transaction_id: tNear.id, date_expiry: new Date(now + 2 * 86_400_000) } as never);
    // 30 days out → outside the [.., now+7d] window
    await makeQuote({ ...(baseQuote as object), transaction_id: tFuture.id, date_expiry: new Date(now + 30 * 86_400_000) } as never);

    const rows = await transactionRepository.findExpiringQuotes(undefined, undefined);
    const ids = rows.map((r) => r.quoteId).sort();

    expect(ids).toEqual([qNear.id, qPast.id].sort());
  });
});

describe("transactionRepository.findPipelineByStatus — enquiry card fields", () => {
  it("returns the enquiry's budget and nights so the pipeline card can show them", async () => {
    const client = await makeClient({ firstName: "Pia", surename: "Pipeline", createdBy: agent.id, orgId: orgA.id, branchId: branchA1.id } as never);
    const created = await transactionRepository.createWithEnquiryAndChildren({
      transactionData: { user_id: agent.id, client_id: client.id } as never,
      enquiryFields: { holiday_type_id: pkg.id, title: "Beach", budget: "1800", no_of_nights: 7 } as never,
      scope,
    });

    const page = await transactionRepository.findPipelineByStatus(scope, "enquiry", 1, 10);
    const item = page.items.find((i: { id: string }) => i.id === created.transaction.id);

    expect(item?.enquiry).toMatchObject({ no_of_nights: 7 });
    expect(Number(item?.enquiry?.budget)).toBe(1800);
  });
});
