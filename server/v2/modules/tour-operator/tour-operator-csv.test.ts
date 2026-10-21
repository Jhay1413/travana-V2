import { describe, expect, it } from "vitest";
import { buildOperatorsCsv, guardFormula, quoteCell, type ExportRow } from "./tour-operator-csv";

const row: ExportRow = {
  name: "TUI",
  phone: "0203 451 2720",
  website: "https://tui.co.uk",
  username: "ann",
  password: "Sunshine#2026",
  commission_percentage: "10.00",
  balance_due_weeks: 14,
};

describe("guardFormula", () => {
  it("prefixes formula starters", () => {
    expect(guardFormula("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(guardFormula("@cmd")).toBe("'@cmd");
    expect(guardFormula("\tx")).toBe("'\tx");
    expect(guardFormula("\rx")).toBe("'\rx");
    expect(guardFormula("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(guardFormula("-2+3")).toBe("'-2+3");
  });

  it("leaves phones, numbers and plain text alone", () => {
    expect(guardFormula("+44 (0)203 451 2720")).toBe("+44 (0)203 451 2720");
    expect(guardFormula("-5")).toBe("-5");
    expect(guardFormula("TUI")).toBe("TUI");
    expect(guardFormula("")).toBe("");
  });
});

describe("quoteCell", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(quoteCell("a,b")).toBe('"a,b"');
    expect(quoteCell('say "hi"')).toBe('"say ""hi"""');
    expect(quoteCell("a\nb")).toBe('"a\nb"');
    expect(quoteCell("plain")).toBe("plain");
  });
});

describe("buildOperatorsCsv", () => {
  it("writes the header and one CRLF line per row, with passwords for admins", () => {
    const csv = buildOperatorsCsv([row], true);
    expect(csv).toBe(
      "Tour Operator,Phone,Weblink,Username,Password,Commission Rate,Balance Due (weeks)\r\n" +
        "TUI,0203 451 2720,https://tui.co.uk,ann,Sunshine#2026,10,14\r\n",
    );
  });

  it("blanks the password column when not allowed and never leaks it", () => {
    const csv = buildOperatorsCsv([row], false);
    expect(csv).not.toContain("Sunshine");
    expect(csv).toContain("ann,,10,14");
  });

  it("handles nulls and guards formulas in every cell", () => {
    const csv = buildOperatorsCsv(
      [{ ...row, name: "=HYPERLINK(1)", phone: null, website: null, username: null, password: "=1+1", commission_percentage: null }],
      true,
    );
    expect(csv).toContain("'=HYPERLINK(1),,,,=1+1,,14");
  });

  it("never guards the password cell (a re-import would change the stored password) but still quotes it", () => {
    const csv = buildOperatorsCsv([{ ...row, password: '=a,"b"' }], true);
    expect(csv).toContain(',"=a,""b""",');
    expect(csv).not.toContain("'=a");
  });

  it("quotes names with commas", () => {
    expect(buildOperatorsCsv([{ ...row, name: "Jet2, holidays" }], false)).toContain('"Jet2, holidays",');
  });
});
