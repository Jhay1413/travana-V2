import { describe, expect, it } from "vitest";
import { CSV_HEADERS, templateCsv } from "./csv-template";
import { mapHeaders } from "./header-aliases";
import { importButtonLabel, importToast, importableCount, previewCommission, previewSubtitle } from "./import-preview";
import { IMPORT_MESSAGES, ImportFileError, checkFile, tableToImportRows } from "./parse-import";
import type { ImportPreview } from "../types";

describe("csv template", () => {
  it("has the seven headers and one example row", () => {
    const [head, example] = templateCsv().split("\n");
    expect(head).toBe(CSV_HEADERS.join(","));
    expect(example).toBe("Example Holidays,0203 000 0000,https://trade.example.com,agent01,Password123,10,14");
  });
});

describe("mapHeaders", () => {
  it("maps every alias, ignoring case and spacing", () => {
    const cols = mapHeaders(["Supplier", "Telephone", "URL", "Login", "PASSWORD", "Commission %", "  Balance   Due (weeks) "]);
    expect(cols).toEqual({ name: 0, phone: 1, website: 2, username: 3, password: 4, commission: 5, balanceWeeks: 6 });
  });

  it("leaves unknown columns out", () => {
    expect(mapHeaders(["Tour Operator", "Notes"])).toEqual({ name: 0 });
  });
});

describe("tableToImportRows", () => {
  const header = ["Tour Operator", "Phone", "Commission Rate"];

  it("numbers lines from 2 and skips blank rows", () => {
    const rows = tableToImportRows([header, ["TUI", "0203", "10"], ["", "", ""], ["Jet2", "", "9"]]);
    expect(rows.map((r) => [r.line, r.name, r.commission])).toEqual([
      [2, "TUI", "10"],
      [4, "Jet2", "9"],
    ]);
    expect(rows[0]?.website).toBe("");
  });

  it("rejects a file without a name column", () => {
    expect(() => tableToImportRows([["Phone"], ["1"]])).toThrow(IMPORT_MESSAGES.noNameColumn);
  });

  it("rejects an empty file", () => {
    expect(() => tableToImportRows([header])).toThrow(IMPORT_MESSAGES.noRows);
  });

  it("rejects more than 500 rows", () => {
    const body = Array.from({ length: 501 }, (_, i) => [`Op ${i}`, "", ""]);
    expect(() => tableToImportRows([header, ...body])).toThrow(IMPORT_MESSAGES.tooManyRows);
  });
});

describe("checkFile", () => {
  it("accepts csv, tsv and txt", () => {
    for (const name of ["a.csv", "a.TSV", "a.txt"]) expect(() => checkFile({ name, size: 10 })).not.toThrow();
  });

  it("rejects spreadsheets with the Save As hint", () => {
    expect(() => checkFile({ name: "a.xlsx", size: 10 })).toThrow(IMPORT_MESSAGES.notCsv);
  });

  it("rejects files over 2 MB", () => {
    expect(() => checkFile({ name: "a.csv", size: 2 * 1024 * 1024 + 1 })).toThrow(ImportFileError);
  });
});

describe("import preview text", () => {
  const preview: ImportPreview = {
    counts: {},
    rows: [
      { line: 2, name: "A", status: "new" },
      { line: 3, name: "B", status: "update" },
      { line: 4, name: "C", status: "same" },
    ],
  };

  it("writes the subtitle without an errors clause", () => {
    expect(previewSubtitle("ops.csv", preview)).toBe("ops.csv: 1 new, 1 to update, 1 unchanged.");
  });

  it("adds the errors clause", () => {
    const withError: ImportPreview = { ...preview, rows: [...preview.rows, { line: 5, name: "", status: "error" }] };
    expect(previewSubtitle("ops.csv", withError)).toBe("ops.csv: 1 new, 1 to update, 1 unchanged, 1 with errors (these are skipped).");
  });

  it("counts only new and update rows as importable", () => {
    expect(importableCount(preview.rows)).toBe(2);
    expect(importableCount([])).toBe(0);
  });

  it("pluralises the button and writes the toast", () => {
    expect(importButtonLabel(1)).toBe("Import 1 operator");
    expect(importButtonLabel(3)).toBe("Import 3 operators");
    expect(importToast({ added: 2, updated: 1 })).toBe("Imported: 2 added, 1 updated");
  });

  it("shows a dash for a missing commission", () => {
    expect(previewCommission(undefined)).toBe("—");
    expect(previewCommission(null)).toBe("—");
    expect(previewCommission("12.50")).toBe("12.5%");
  });
});
