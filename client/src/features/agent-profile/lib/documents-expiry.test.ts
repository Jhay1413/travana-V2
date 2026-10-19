import { describe, expect, it } from "vitest";
import type { DocumentEntry } from "@/features/hr";
import { classifyExpiry, documentStatusView, EXPIRY_WARNING_DAYS, expiringDocuments } from "./documents-expiry";

const TODAY = "2026-10-19";

function doc(over: Partial<DocumentEntry>): DocumentEntry {
  return { id: "d1", name: "Public liability insurance", category: "Other", status: "Uploaded", uploadedAt: "2026-01-05T10:00:00.000Z", ...over };
}

describe("classifyExpiry", () => {
  it("flags a document 60 days before it expires, not 61", () => {
    expect(EXPIRY_WARNING_DAYS).toBe(60);
    expect(classifyExpiry("2026-12-18", TODAY)).toMatchObject({ status: "soon", daysLeft: 60 });
    expect(classifyExpiry("2026-12-19", TODAY)).toMatchObject({ status: "valid", daysLeft: 61 });
  });

  it("treats today as expiring soon and yesterday as expired", () => {
    expect(classifyExpiry("2026-10-19", TODAY)).toEqual({ status: "soon", daysLeft: 0, text: "Expires 19 Oct 2026, today" });
    expect(classifyExpiry("2026-10-18", TODAY)).toEqual({ status: "expired", daysLeft: -1, text: "Expired 18 Oct 2026" });
  });

  it("words the days left", () => {
    expect(classifyExpiry("2026-10-20", TODAY).text).toBe("Expires 20 Oct 2026, in 1 day");
    expect(classifyExpiry("2026-11-30", TODAY).text).toBe("Expires 30 Nov 2026, in 42 days");
  });

  it("accepts a full timestamp", () => {
    expect(classifyExpiry("2026-11-30T00:00:00.000Z", TODAY).daysLeft).toBe(42);
  });
});

describe("expiringDocuments", () => {
  it("lists only documents with an expiry date, soonest first, with a pill word", () => {
    const rows = expiringDocuments(
      [
        doc({ id: "a", name: "A", expiresAt: "2027-03-01" }),
        doc({ id: "b", name: "B", expiresAt: null }),
        doc({ id: "c", name: "C", expiresAt: "2026-11-30" }),
        doc({ id: "d", name: "D", expiresAt: "2026-09-01" }),
      ],
      TODAY,
    );
    expect(rows.map((r) => [r.id, r.pillLabel, r.tone])).toEqual([
      ["d", "Expired", "bad"],
      ["c", "Expiring soon", "warn"],
      ["a", "Valid", "info"],
    ]);
  });

  it("is empty when nothing carries an expiry", () => {
    expect(expiringDocuments([doc({})], TODAY)).toEqual([]);
  });
});

describe("documentStatusView", () => {
  it("prefers the expiry wording when there is an expiry date", () => {
    expect(documentStatusView(doc({ expiresAt: "2026-11-30" }), TODAY)).toEqual({ label: "Expiring soon", tone: "warn", date: "Expires 30 Nov 2026, in 42 days" });
  });

  it("falls back to the stored status and the upload date", () => {
    expect(documentStatusView(doc({}), TODAY)).toEqual({ label: "On file", tone: "good", date: "Added 5 Jan 2026" });
    expect(documentStatusView(doc({ status: "Missing" }), TODAY)).toMatchObject({ label: "Missing", tone: "bad" });
    expect(documentStatusView(doc({ status: "Expiring Soon" }), TODAY)).toMatchObject({ label: "Expiring soon", tone: "warn" });
  });
});
