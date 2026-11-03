import { describe, expect, it } from "vitest";
import { BLANK_COMMISSION, emptyForm, formFromRow, hasErrors, toCreatePayload, toPatchPayload, validateOperatorForm } from "./form-validation";
import type { OperatorFormValues, OrgOperatorRow } from "../types";

const existing = [{ linkId: "l1", name: "TUI" }];

function form(over: Partial<OperatorFormValues> = {}): OperatorFormValues {
  return { ...emptyForm(), name: "Sandals", commission: "12", ...over };
}

describe("validateOperatorForm", () => {
  it("accepts a good form", () => {
    expect(hasErrors(validateOperatorForm(form(), existing, null))).toBe(false);
  });

  it("explains a short name", () => {
    expect(validateOperatorForm(form({ name: "A" }), existing, null).name).toBe("Enter the tour operator's name.");
  });

  it("flags a duplicate name case-insensitively, but not for the row being edited", () => {
    expect(validateOperatorForm(form({ name: " tui " }), existing, null).name).toBe("TUI is already in the list.");
    expect(validateOperatorForm(form({ name: "tui" }), existing, "l1").name).toBeUndefined();
  });

  it("checks phone and website", () => {
    const e = validateOperatorForm(form({ phone: "abc", web: "not a url" }), existing, null);
    expect(e.phone).toBe("Enter a phone number, e.g. 0203 451 2720.");
    expect(e.web).toBe("Enter a web address, e.g. trade.jet2holidays.com.");
  });

  it("asks for a commission when blank and explains bad ones", () => {
    expect(validateOperatorForm(form({ commission: "" }), existing, null).commission).toBe(BLANK_COMMISSION);
    expect(validateOperatorForm(form({ commission: "abc" }), existing, null).commission).toBe("Enter the commission as a number, e.g. 10.");
    expect(validateOperatorForm(form({ commission: "-1" }), existing, null).commission).toBe("Commission can't be below 0%.");
    expect(validateOperatorForm(form({ commission: "101" }), existing, null).commission).toBe("Commission can't be over 100%.");
    expect(validateOperatorForm(form({ commission: "10%" }), existing, null).commission).toBeUndefined();
  });

  it("checks the weeks", () => {
    expect(validateOperatorForm(form({ balanceWeeks: "x" }), existing, null).balanceWeeks).toBe("Enter the number of weeks, e.g. 14.");
    expect(validateOperatorForm(form({ balanceWeeks: "1.5" }), existing, null).balanceWeeks).toBe("Use whole weeks, e.g. 14.");
    expect(validateOperatorForm(form({ balanceWeeks: "53" }), existing, null).balanceWeeks).toBe("Use 52 weeks or fewer.");
    expect(validateOperatorForm(form({ balanceWeeks: "14 weeks" }), existing, null).balanceWeeks).toBeUndefined();
  });
});

const ROW: OrgOperatorRow = {
  linkId: "l1", id: "c1", name: "TUI", code: null, website: "https://tui.co.uk", phone: "0203 451 2720", logo_url: null,
  username: "u", password: "pw", hasPassword: true, commission_percentage: "10.00", balance_due_weeks: 14,
  is_active: true, updated_at: "2026-10-12T09:00:00Z",
};

describe("payloads", () => {
  it("sends the catalogue id for a catalogue pick", () => {
    const p = toCreatePayload(form({ username: " u ", password: "pw" }), "cat-1");
    expect(p).toEqual({ tourOperatorId: "cat-1", commissionPercentage: 12, balanceDueWeeks: 14, username: "u", password: "pw" });
  });

  it("sends the name with a normalised website for a typed name", () => {
    const p = toCreatePayload(form({ name: " Sandals ", web: "trade.example.com", phone: " 0203 451 2720 " }), null);
    expect(p).toEqual({ name: "Sandals", website: "https://trade.example.com", phone: "0203 451 2720", commissionPercentage: 12, balanceDueWeeks: 14 });
  });

  it("also sends website and phone with a catalogue pick", () => {
    const p = toCreatePayload(form({ web: "trade.example.com", phone: "0203 451 2720" }), "cat-1");
    expect(p).toMatchObject({ tourOperatorId: "cat-1", website: "https://trade.example.com", phone: "0203 451 2720" });
    expect(p.name).toBeUndefined();
  });

  it("sends nothing on a patch when nothing changed", () => {
    expect(toPatchPayload(formFromRow(ROW), ROW)).toEqual({});
  });

  it("never sends an unedited password, even when it could not be shown", () => {
    const hidden = { ...ROW, password: null, hasPassword: true };
    expect(toPatchPayload({ ...formFromRow(hidden), commission: "11" }, hidden)).toEqual({ commissionPercentage: 11 });
  });

  it("sends only the commission when only it changed", () => {
    expect(toPatchPayload({ ...formFromRow(ROW), commission: "8.5%" }, ROW)).toEqual({ commissionPercentage: 8.5 });
  });

  it("sends an edited phone, a changed password and the active flag", () => {
    const p = toPatchPayload({ ...formFromRow(ROW), phone: " 0161 555 0144 ", password: "", isActive: false }, ROW);
    expect(p).toEqual({ phone: "0161 555 0144", password: "", isActive: false });
  });

  it("clears the commission with null when blanked on edit", () => {
    expect(toPatchPayload({ ...formFromRow(ROW), commission: "" }, ROW)).toEqual({ commissionPercentage: null });
  });

  it("allows a blank commission on edit but not on add", () => {
    expect(validateOperatorForm(form({ commission: "" }), existing, "l1").commission).toBeUndefined();
    expect(validateOperatorForm(form({ commission: "" }), existing, null).commission).toBe(BLANK_COMMISSION);
  });
});

describe("formFromRow", () => {
  it("prefills from a row, dropping trailing zeros", () => {
    const row: OrgOperatorRow = {
      linkId: "l1", id: "c1", name: "TUI", code: null, website: "https://tui.co.uk", phone: null, logo_url: null,
      username: "u", password: "pw", hasPassword: true, commission_percentage: "10.00", balance_due_weeks: 12,
      is_active: false, updated_at: "2026-10-12T09:00:00Z",
    };
    expect(formFromRow(row)).toEqual({ name: "TUI", phone: "", web: "https://tui.co.uk", username: "u", password: "pw", commission: "10", balanceWeeks: "12", isActive: false });
  });
});
