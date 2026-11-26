import { describe, it, expect, vi, beforeEach } from "vitest";

// pdfkit is replaced by a recorder so the text the invoice prints can be read.
const printed = vi.hoisted(() => ({ texts: [] as string[] }));
vi.mock("pdfkit", () => {
  class FakeDoc {
    page = { width: 595, height: 842 };
    handlers: Record<string, (arg?: unknown) => void> = {};
    private chain = new Proxy(this, {
      get: (t, prop) => {
        if (prop === "on") return (ev: string, fn: (arg?: unknown) => void) => { t.handlers[ev] = fn; return this.chain; };
        if (prop === "text") return (s: string) => { printed.texts.push(String(s)); return this.chain; };
        if (prop === "end") return () => t.handlers["end"]?.();
        return () => this.chain;
      },
    });
    constructor() { return this.chain as unknown as FakeDoc; }
  }
  return { default: FakeDoc };
});
vi.mock("../../config/s3", () => ({ s3Client: { send: vi.fn() }, S3_BUCKET: "b" }));
vi.mock("@aws-sdk/client-s3", () => ({ PutObjectCommand: class {}, GetObjectCommand: class {} }));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: vi.fn() }));

import { generateWithdrawalInvoiceBuffer as v2 } from "./invoice-pdf.service";
import { generateWithdrawalInvoiceBuffer as legacy } from "../../../services/invoicePdf.service";

const base = {
  withdrawalId: "abcdef12-0000", requestedAt: null, processedAt: null, clientName: "Sam Lee", clientEmail: null, clientPhone: null,
  amount: "10", method: "booking_credit", accountName: null, accountNumber: null, sortCode: null, transferReference: null,
  bookingHaysRef: null, bookingSupplierRef: null, travelDate: null, referredName: null, referredEmail: null,
};

beforeEach(() => { printed.texts.length = 0; });

describe.each([["v2 generator", v2], ["legacy generator", legacy]])("%s header", (_n, gen) => {
  it("prints the invoicing agency's own name and never a fixed one", async () => {
    await gen({ ...base, agencyName: "Sunny Holidays" });
    expect(printed.texts).toContain("Sunny Holidays");
    expect(printed.texts.join(" ")).not.toMatch(/tina/i);
  });
  it("prints no name when the agency is unknown", async () => {
    await gen({ ...base, agencyName: null });
    await gen({ ...base });
    await gen({ ...base, agencyName: "  " });
    expect(printed.texts).toContain("Referral Withdrawal Invoice");
    expect(printed.texts.join(" ")).not.toMatch(/tina/i);
    expect(printed.texts.filter((t) => t.trim() === "")).toEqual([]);
  });
});
