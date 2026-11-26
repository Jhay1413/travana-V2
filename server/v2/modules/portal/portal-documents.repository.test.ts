import { describe, it, expect, vi, beforeEach } from "vitest";

// A real drizzle instance over a fake pool: nothing connects, every statement is captured as text + params.
const captured = vi.hoisted(() => ({ queries: [] as Array<{ text: string; values: unknown[] }> }));

vi.mock("../../config/database", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const fakePool = {
    query: async (q: string | { text: string; values?: unknown[] }, values?: unknown[]) => {
      const text = typeof q === "string" ? q : q.text;
      const vals = typeof q === "string" ? (values ?? []) : (q.values ?? values ?? []);
      captured.queries.push({ text, values: vals });
      return { rows: [], rowCount: 0, fields: [] };
    },
  };
  return { db: drizzle(fakePool as never) };
});

import { portalDocumentsRepository } from "./portal-documents.repository";

const last = () => captured.queries[captured.queries.length - 1];

beforeEach(() => {
  captured.queries.length = 0;
});

describe("findVisibleFiles", () => {
  it("is the one visibility join: client_files joined to the booking, quote or enquiry by normalised type, then to a deal of the same customer", async () => {
    expect(await portalDocumentsRepository.findVisibleFiles("client-1")).toEqual([]);
    const { text, values } = last();
    expect(text).toContain(`from "client_files"`);
    expect(text).toContain(`left join "booking_table" "link_booking"`);
    expect(text).toContain(`left join "quote_table" "link_quote"`);
    expect(text).toContain(`left join "enquiry_table" "link_enquiry"`);
    expect(text).toContain(`inner join "transaction" "link_deal"`);
    expect(text).toContain("lower(trim(");
    expect(text).toContain(`"link_booking"."id"::text = lower(trim(`);
    expect(text).toContain(`"link_quote"."id"::text = lower(trim(`);
    expect(text).toContain(`"link_enquiry"."id"::text = lower(trim(`);
    expect(text).toContain(`"link_quote"."deleted_at" is null`);
    // never trusts the stored allocation alone: both the file and the linked deal must belong to the session customer
    expect(text).toContain(`"client_files"."client_id" = $`);
    expect(text).toContain(`"link_deal"."client_id" = $`);
    expect(text).toContain(`"link_deal"."is_test" IS NOT TRUE`);
    expect(values.filter((v) => v === "client-1")).toHaveLength(2);
    expect(text).toContain(`order by "client_files"."created_at" desc`);
  });

  it("narrows to one file when asked, still through the same join", async () => {
    await portalDocumentsRepository.findVisibleFiles("client-1", "file-1");
    const { text, values } = last();
    expect(text).toContain(`"client_files"."id" = $`);
    expect(text).toContain(`inner join "transaction" "link_deal"`);
    expect(values).toEqual(expect.arrayContaining(["client-1", "file-1"]));
  });

  it("never selects the uploader or the allocation columns, and reads no note or ticket file table", async () => {
    await portalDocumentsRepository.findVisibleFiles("client-1");
    const { text } = last();
    const select = text.split(" from ")[0];
    expect(select).not.toContain("uploaded_by");
    expect(select).not.toContain("allocation");
    expect(text).not.toMatch(/note_attachments|ticket_attachments|chat/);
  });
});

describe("booking lookups by deal", () => {
  it("do not query for no deals", async () => {
    expect(await portalDocumentsRepository.findLiveBookingsByDeal("c1", [])).toEqual([]);
    expect(await portalDocumentsRepository.findDealIdsWithAnyBooking("c1", [])).toEqual([]);
    expect(captured.queries).toHaveLength(0);
  });

  it("the live lookup is for the customer's own deals and applies the live-booking rule", async () => {
    await portalDocumentsRepository.findLiveBookingsByDeal("client-1", ["d1", "d2"]);
    const { text, values } = last();
    const where = text.slice(text.lastIndexOf(" where "));
    expect(where).toContain(`"transaction"."client_id" = $`);
    expect(where).toContain(`"booking_table"."is_active" = $`);
    expect(where).toContain(`"transaction"."is_test" = $`);
    expect(where).toContain(`"booking_status" <> 'LOST'`);
    expect(values).toEqual(expect.arrayContaining(["client-1", "d1", "d2"]));
  });

  it("the any-booking lookup is still bound to the customer", async () => {
    await portalDocumentsRepository.findDealIdsWithAnyBooking("client-1", ["d1"]);
    expect(last().text).toContain(`"transaction"."client_id" = $`);
    expect(last().values).toContain("client-1");
  });
});
