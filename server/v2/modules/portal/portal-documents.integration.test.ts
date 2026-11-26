import { describe, it, expect, vi, beforeEach } from "vitest";

// Storage is not under test here (no cloud credentials in the test database setup): the signed link is faked.
vi.mock("../client/client-file.service", () => ({
  PRESIGNED_URL_EXPIRES_IN: 300,
  clientFileService: {
    resolveDownloadTarget: vi.fn().mockResolvedValue({ kind: "s3", url: "https://signed.example/file" }),
  },
}));

import { db } from "../../config/database";
import { clientFiles, enquiry_table, noteAttachments, notes } from "@shared/schema";
import { truncateAll, makeOrg, makeUser, makeClient, makeTransaction, makeBooking, makeQuote, makePackageType } from "../../test/factories";
import { portalDocumentsService } from "./portal-documents.service";

// DB-backed: proves the REAL join keeps a customer's files that are not linked to one of their own deals away from the
// portal, and one customer's files away from another's. Written to run under `npm run test:integration` against the
// disposable test database.

let agent: { id: string };
let orgId: string;
let customerA: { id: string };
let customerB: { id: string };
let noteAttachmentId: string;

async function makeFile(clientId: string, over: Partial<typeof clientFiles.$inferInsert> = {}) {
  const [row] = await db
    .insert(clientFiles)
    .values({
      clientId,
      filename: `client-files/${Math.random()}.pdf`,
      originalName: "doc.pdf",
      mimeType: "application/pdf",
      size: 10,
      ...over,
    })
    .returning();
  return row;
}

async function deal(clientId: string, over: Record<string, unknown> = {}) {
  return makeTransaction({ user_id: agent.id, org_id: orgId, client_id: clientId, status: "booked", ...over });
}

async function makeEnquiry(transactionId: string) {
  const pkg = await makePackageType();
  const [row] = await db.insert(enquiry_table).values({ transaction_id: transactionId, holiday_type_id: pkg.id }).returning();
  return row;
}

beforeEach(async () => {
  await truncateAll();
  const org = await makeOrg({ slug: "agency-documents" });
  orgId = org.id;
  agent = await makeUser({ orgId: org.id });
  customerA = await makeClient({ orgId: org.id, firstName: "Ada", surename: "Alpha" });
  customerB = await makeClient({ orgId: org.id, firstName: "Ben", surename: "Beta" });

  const [note] = await db.insert(notes).values({ content: "internal", client_id: customerA.id }).returning();
  const [att] = await db
    .insert(noteAttachments)
    .values({ noteId: note.id, filename: "note-files/x.pdf", originalName: "note.pdf", mimeType: "application/pdf", size: 5 })
    .returning();
  noteAttachmentId = att.id;
});

describe("only files linked to one of the customer's own deals are visible", () => {
  it("booking, quote and enquiry links are listed with the deal; unlinked, placeholder and None files are hidden and 404 on download", async () => {
    const t1 = await deal(customerA.id);
    const booking = await makeBooking({ transaction_id: t1.id, title: "Rome", booking_status: "BOOKED" });
    const t2 = await deal(customerA.id, { status: "quote" });
    const quote = await makeQuote({ transaction_id: t2.id });
    const t3 = await deal(customerA.id, { status: "enquiry" });
    const enquiry = await makeEnquiry(t3.id);

    const onBooking = await makeFile(customerA.id, { allocationType: "Booking", allocationId: booking.id });
    const onQuote = await makeFile(customerA.id, { allocationType: "quote", allocationId: quote.id });
    const onEnquiry = await makeFile(customerA.id, { allocationType: "Enquiry", allocationId: enquiry.id.toUpperCase() });
    const unlinked = await makeFile(customerA.id);
    const none = await makeFile(customerA.id, { allocationType: "None" });
    const dummy = await makeFile(customerA.id, { allocationType: "Booking", allocationId: "booking-1" });
    const dummyEnquiry = await makeFile(customerA.id, { allocationType: "Enquiry", allocationId: "enquiry-2" });

    const byId = Object.fromEntries((await portalDocumentsService.list(customerA.id)).map((d) => [d.id, d]));
    expect(Object.keys(byId).sort()).toEqual([onBooking.id, onQuote.id, onEnquiry.id].sort());
    expect(byId[onBooking.id]).toMatchObject({ dealId: t1.id, bookingId: booking.id });
    expect(byId[onQuote.id]).toMatchObject({ dealId: t2.id, bookingId: null });
    expect(byId[onEnquiry.id]).toMatchObject({ dealId: t3.id, bookingId: null });

    for (const hidden of [unlinked, none, dummy, dummyEnquiry]) {
      await expect(portalDocumentsService.getDownload(customerA.id, hidden.id)).rejects.toMatchObject({ statusCode: 404, message: "Document not found" });
    }
    expect((await portalDocumentsService.getDownload(customerA.id, onBooking.id)).kind).toBe("link");
  });

  it("the filter returns exactly the files of that booking's deal, including one linked to its quote", async () => {
    const t1 = await deal(customerA.id);
    const booking = await makeBooking({ transaction_id: t1.id, title: "Rome", booking_status: "BOOKED" });
    const quote = await makeQuote({ transaction_id: t1.id });
    const t2 = await deal(customerA.id, { status: "enquiry" });
    const enquiry = await makeEnquiry(t2.id);
    const onBooking = await makeFile(customerA.id, { allocationType: "Booking", allocationId: booking.id });
    const onQuote = await makeFile(customerA.id, { allocationType: "Quote", allocationId: quote.id });
    await makeFile(customerA.id, { allocationType: "Enquiry", allocationId: enquiry.id });
    await makeFile(customerA.id);

    const filtered = await portalDocumentsService.list(customerA.id, booking.id);
    expect(filtered.map((d) => d.id).sort()).toEqual([onBooking.id, onQuote.id].sort());
    expect(filtered.every((d) => d.bookingId === booking.id && d.dealId === t1.id)).toBe(true);
  });

  it("a file pointing at another customer's record is hidden, even though staff typed the id on A's profile", async () => {
    const tB = await deal(customerB.id);
    const bookingB = await makeBooking({ transaction_id: tB.id, title: "B's", booking_status: "BOOKED" });
    const quoteB = await makeQuote({ transaction_id: tB.id });
    const sneaky = await makeFile(customerA.id, { allocationType: "Booking", allocationId: bookingB.id });
    const sneakyQuote = await makeFile(customerA.id, { allocationType: "Quote", allocationId: quoteB.id });
    expect(await portalDocumentsService.list(customerA.id)).toEqual([]);
    await expect(portalDocumentsService.getDownload(customerA.id, sneaky.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(portalDocumentsService.getDownload(customerA.id, sneakyQuote.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("customer A cannot list or download customer B's file", async () => {
    const tB = await deal(customerB.id);
    const bookingB = await makeBooking({ transaction_id: tB.id, title: "B's", booking_status: "BOOKED" });
    const fileB = await makeFile(customerB.id, { allocationType: "Booking", allocationId: bookingB.id });
    expect((await portalDocumentsService.list(customerA.id)).map((d) => d.id)).not.toContain(fileB.id);
    await expect(portalDocumentsService.getDownload(customerA.id, fileB.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(portalDocumentsService.getDownload(customerA.id, "00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({ statusCode: 404 });
    expect((await portalDocumentsService.list(customerB.id)).map((d) => d.id)).toEqual([fileB.id]);
  });

  it("a test deal's files are hidden", async () => {
    const t = await deal(customerA.id, { is_test: true });
    const b = await makeBooking({ transaction_id: t.id, title: "Test", booking_status: "BOOKED" });
    const q = await makeQuote({ transaction_id: t.id });
    await makeFile(customerA.id, { allocationType: "Booking", allocationId: b.id });
    await makeFile(customerA.id, { allocationType: "Quote", allocationId: q.id });
    expect(await portalDocumentsService.list(customerA.id)).toEqual([]);
  });

  it("a lost booking's files are hidden; a live booking on a deactivated deal stays visible", async () => {
    const lostDeal = await deal(customerA.id);
    const lost = await makeBooking({ transaction_id: lostDeal.id, title: "Lost", booking_status: "LOST" });
    const lostQuote = await makeQuote({ transaction_id: lostDeal.id });
    await makeFile(customerA.id, { allocationType: "Booking", allocationId: lost.id });
    await makeFile(customerA.id, { allocationType: "Quote", allocationId: lostQuote.id });

    const inactiveDeal = await deal(customerA.id, { is_active: false });
    const live = await makeBooking({ transaction_id: inactiveDeal.id, title: "Still a trip", booking_status: "BOOKED" });
    const kept = await makeFile(customerA.id, { allocationType: "Booking", allocationId: live.id });

    expect((await portalDocumentsService.list(customerA.id)).map((d) => d.id)).toEqual([kept.id]);
  });

  it("a note attachment id is a 404, never a document", async () => {
    await expect(portalDocumentsService.getDownload(customerA.id, noteAttachmentId)).rejects.toMatchObject({ statusCode: 404 });
    expect((await portalDocumentsService.list(customerA.id)).map((d) => d.id)).not.toContain(noteAttachmentId);
  });
});
