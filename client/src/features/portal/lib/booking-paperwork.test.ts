import { describe, expect, it } from "vitest";
import { DOCUMENTS_NOTE, buildChecklist, documentDetail, formatFileSize } from "./booking-paperwork";

describe("formatFileSize", () => {
  it("uses decimal units and keeps one decimal only for small megabyte counts", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(240_000)).toBe("240 KB");
    expect(formatFileSize(240_400)).toBe("240 KB");
    expect(formatFileSize(999_999)).toBe("1000 KB");
    expect(formatFileSize(1_400_000)).toBe("1.4 MB");
    expect(formatFileSize(12_600_000)).toBe("13 MB");
  });
  it("is blank when the size is not known", () => {
    for (const bad of [0, -5, Number.NaN, null, undefined]) expect(formatFileSize(bad)).toBe("");
  });
});

describe("documentDetail", () => {
  it("joins kind, category and size", () => {
    expect(documentDetail({ kind: "PDF", category: "Tickets", sizeBytes: 240_000 })).toBe("PDF · Tickets · 240 KB");
  });
  it("leaves out what is not known", () => {
    expect(documentDetail({ kind: "PDF", category: null, sizeBytes: 240_000 })).toBe("PDF · 240 KB");
    expect(documentDetail({ kind: "Image", category: "Passport", sizeBytes: 0 })).toBe("Image · Passport");
    expect(documentDetail({ kind: "", category: null, sizeBytes: 0 })).toBe("");
  });
});

describe("the empty-state note", () => {
  it("is the design's voice", () => {
    expect(DOCUMENTS_NOTE).toBe("We'll let you know as soon as your tickets and documents are ready.");
  });
});

describe("buildChecklist", () => {
  const added = { hasPassport: true };
  const missing = { hasPassport: false };

  it("marks passports done only when every traveller has one", () => {
    const [row] = buildChecklist([added, added], 0);
    expect(row).toMatchObject({ key: "passports", numeral: "I", label: "Passport details", note: "We have them for everyone", done: true, status: "✓ Done" });
  });

  it("counts the passports that are in when some are missing", () => {
    const [row] = buildChecklist([added, missing, missing], 0);
    expect(row).toMatchObject({ note: "1 of 3 added. Add the rest above", done: false, status: "To do" });
  });

  it("marks travel documents done when at least one document is listed", () => {
    const rows = buildChecklist([added], 2);
    expect(rows[1]).toMatchObject({ key: "documents", numeral: "II", label: "Travel documents", note: "Ready to download above", done: true, status: "✓ Done" });
    expect(buildChecklist([added], 0)[1]).toMatchObject({ note: "We'll let you know when they are ready", done: false, status: "To do" });
  });

  it("has no balance or check-in row", () => {
    expect(buildChecklist([added], 1).map((r) => r.label)).toEqual(["Passport details", "Travel documents"]);
  });

  it("leaves out a row whose data has not arrived, and renumbers", () => {
    expect(buildChecklist(null, 1).map((r) => [r.numeral, r.label])).toEqual([["I", "Travel documents"]]);
    expect(buildChecklist([added], null).map((r) => [r.numeral, r.label])).toEqual([["I", "Passport details"]]);
    expect(buildChecklist(null, null)).toEqual([]);
    expect(buildChecklist([], null)).toEqual([]);
  });
});
