import { describe, it, expect } from "vitest";
import {
  attachmentDisposition,
  categoryLabel,
  kindLabel,
  safeContentType,
  sanitiseFileName,
  toPortalDocument,
} from "./portal-documents.mapper";

describe("categoryLabel", () => {
  it("maps the known upload categories to plain labels, whatever the case", () => {
    expect(categoryLabel("Passport")).toBe("Passport");
    expect(categoryLabel("TICKETS")).toBe("Tickets");
    expect(categoryLabel("insurance")).toBe("Insurance");
  });
  it("tidies unknown values and passes them through", () => {
    expect(categoryLabel("  flight_receipts ")).toBe("Flight receipts");
    expect(categoryLabel("supplier-invoice")).toBe("Supplier invoice");
  });
  it("is null when blank", () => {
    expect(categoryLabel(null)).toBeNull();
    expect(categoryLabel("   ")).toBeNull();
  });
});

describe("kindLabel", () => {
  it.each([
    ["application/pdf", "PDF"],
    ["image/png", "Image"],
    ["image/webp", "Image"],
    ["application/msword", "Word document"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Word document"],
    ["application/vnd.ms-excel", "Excel spreadsheet"],
    ["text/plain; charset=utf-8", "Text file"],
    ["text/csv", "CSV file"],
    ["application/zip", "File"],
  ])("%s -> %s", (mime, label) => {
    expect(kindLabel(mime)).toBe(label);
  });
});

describe("safeContentType", () => {
  it("keeps types on the safe list", () => {
    expect(safeContentType("application/pdf")).toBe("application/pdf");
    expect(safeContentType("IMAGE/JPEG")).toBe("image/jpeg");
    expect(safeContentType("text/plain; charset=utf-8")).toBe("text/plain");
  });
  it.each(["text/html", "image/svg+xml", "application/javascript", "application/json", "application/xhtml+xml", "", "weird"])(
    "%s becomes octet-stream",
    (mime) => {
      expect(safeContentType(mime)).toBe("application/octet-stream");
    },
  );
});

describe("sanitiseFileName", () => {
  it("drops path parts, both separators", () => {
    expect(sanitiseFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitiseFileName("C:\\Users\\me\\ticket.pdf")).toBe("ticket.pdf");
    expect(sanitiseFileName("a/b/")).toBe("document");
  });
  it("removes quotes, line breaks and header-breaking characters", () => {
    const out = sanitiseFileName('evil"\r\nSet-Cookie: x=1;.pdf');
    expect(out).not.toMatch(/["\r\n;]/);
    expect(out.endsWith(".pdf")).toBe(true);
  });
  it("keeps unicode letters", () => {
    expect(sanitiseFileName("Réservation café.pdf")).toBe("Réservation café.pdf");
  });
  it("removes bidi overrides and leading dots", () => {
    expect(sanitiseFileName("\u202egpj.exe")).toBe("gpj.exe");
    expect(sanitiseFileName("..hidden.pdf")).toBe("hidden.pdf");
  });
  it("falls back when nothing is left, and caps the length keeping the extension", () => {
    expect(sanitiseFileName('"""')).toBe("document");
    const long = sanitiseFileName(`${"a".repeat(300)}.pdf`);
    expect(long.length).toBeLessThanOrEqual(120);
    expect(long.endsWith(".pdf")).toBe(true);
  });
});

describe("attachmentDisposition", () => {
  it("is an attachment with an ASCII fallback and an encoded UTF-8 name", () => {
    const header = attachmentDisposition("Réservation (1).pdf");
    expect(header.startsWith("attachment;")).toBe(true);
    expect(header).toContain('filename="R_servation (1).pdf"');
    expect(header).toContain("filename*=UTF-8''R%C3%A9servation%20%281%29.pdf");
    expect(header).not.toMatch(/[\r\n]/);
  });
});

describe("toPortalDocument", () => {
  const row = {
    id: "f1",
    title: "  ",
    originalName: "scan.pdf",
    mimeType: "application/pdf",
    size: 1234,
    category: "Visa",
    dealId: "d1",
    createdAt: new Date("2026-11-20T10:00:00Z"),
    // Fields a careless caller might pass in must never come out.
    filename: "client-files/secret-key.pdf",
    uploadedBy: "staff-1",
    clientId: "c1",
  };

  it("exposes exactly the allowlisted keys", () => {
    expect(Object.keys(toPortalDocument(row, null)).sort()).toEqual(
      ["bookingId", "category", "dealId", "id", "kind", "name", "sizeBytes", "uploadedAt", "viewKind", "viewable"].sort(),
    );
  });
  it("falls back to the original name when the title is blank, and uses the title when set", () => {
    expect(toPortalDocument(row, null).name).toBe("scan.pdf");
    expect(toPortalDocument({ ...row, title: "Family passports" }, null).name).toBe("Family passports");
  });
  it("labels, sizes and dates", () => {
    expect(toPortalDocument(row, "b9")).toEqual({
      id: "f1",
      name: "scan.pdf",
      category: "Visa",
      kind: "PDF",
      sizeBytes: 1234,
      uploadedAt: "2026-11-20T10:00:00.000Z",
      viewable: true,
      viewKind: "pdf",
      dealId: "d1",
      bookingId: "b9",
    });
  });
});
