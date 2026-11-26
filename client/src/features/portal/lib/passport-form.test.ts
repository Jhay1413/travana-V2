import { describe, expect, it } from "vitest";
import type { PortalPassenger, PortalPassportReadResult } from "@shared/portal-passengers";
import {
  DATES_CHECK_HINT,
  DATE_HINT,
  EMPTY_PASSPORT_FORM,
  PASSPORT_FIELDS,
  checkBoxTone,
  formFromPassenger,
  formFromReadResult,
  normaliseSex,
  passengerName,
  passengerStatus,
  passportCountText,
  passportRows,
  previewPassportCheck,
  titleCaseName,
  travellerLabel,
  validatePassportForm,
  type PassportFormValues,
} from "./passport-form";

const TODAY = "2026-11-26";

const valid: PassportFormValues = {
  surname: "BOUY",
  givenNames: "JIMMY",
  nationality: "BRITISH CITIZEN",
  dateOfBirth: "14 Jun 1988",
  sex: "M",
  passportNumber: "531764821",
  dateOfIssue: "9 Feb 2021",
  expiryDate: "9 Feb 2031",
};

const read: PortalPassportReadResult = {
  surname: "BOUY",
  givenNames: "EMMA",
  nationality: "BRITISH CITIZEN",
  dateOfBirth: "1990-03-03",
  sex: "F",
  passportNumber: "548193027",
  dateOfIssue: "2022-10-22",
  expiryDate: "2032-10-22",
  mrzVerified: true,
};

const passenger = (over: Partial<PortalPassenger> = {}): PortalPassenger => ({
  id: "p1",
  isLead: false,
  firstName: "EMMA",
  surname: "BOUY",
  dateOfBirth: "1990-03-03",
  nationality: "BRITISH CITIZEN",
  sex: "F",
  passportLast4: "3027",
  passportExpiry: "2032-10-22",
  passportIssueDate: "2022-10-22",
  hasPassport: true,
  check: { status: "ok", text: "Valid." },
  ...over,
});

describe("the review form from a read result", () => {
  it("fills all eight fields, dates written as 22 Oct 2032", () => {
    expect(formFromReadResult(read)).toEqual({
      surname: "BOUY",
      givenNames: "EMMA",
      nationality: "BRITISH CITIZEN",
      dateOfBirth: "3 Mar 1990",
      sex: "F",
      passportNumber: "548193027",
      dateOfIssue: "22 Oct 2022",
      expiryDate: "22 Oct 2032",
    });
    expect(PASSPORT_FIELDS).toHaveLength(8);
  });

  it("leaves anything the read missed blank, and upper-cases the number", () => {
    const form = formFromReadResult({ ...read, surname: null, sex: null, passportNumber: "ab123456", dateOfIssue: null });
    expect(form).toMatchObject({ surname: "", sex: "", passportNumber: "AB123456", dateOfIssue: "" });
  });

  it("starts empty for typing the details in, or from a listed traveller for an update", () => {
    expect(formFromPassenger(null)).toEqual(EMPTY_PASSPORT_FORM);
    expect(formFromPassenger(passenger())).toMatchObject({ givenNames: "EMMA", passportNumber: "", expiryDate: "22 Oct 2032" });
  });
});

describe("validatePassportForm", () => {
  it("builds the server's input with ISO dates and an upper-cased number", () => {
    const result = validatePassportForm({ ...valid, passportNumber: " 5317 64821 ", surname: " Bouy " }, TODAY);
    expect(result).toEqual({
      ok: true,
      input: {
        firstName: "JIMMY",
        surname: "Bouy",
        dateOfBirth: "1988-06-14",
        nationality: "BRITISH CITIZEN",
        sex: "M",
        passportNumber: "531764821",
        passportIssueDate: "2021-02-09",
        passportExpiry: "2031-02-09",
      },
    });
  });

  it("accepts a typed-in lower-case number and common date styles", () => {
    const result = validatePassportForm({ ...valid, passportNumber: "ab123456", dateOfBirth: "14/06/1988", expiryDate: "2031-02-09" }, TODAY);
    expect(result).toMatchObject({ ok: true, input: { passportNumber: "AB123456", dateOfBirth: "1988-06-14", passportExpiry: "2031-02-09" } });
  });

  it("treats nationality, sex and issue date as optional", () => {
    const result = validatePassportForm({ ...valid, nationality: " ", sex: "", dateOfIssue: "" }, TODAY);
    expect(result).toMatchObject({ ok: true, input: { nationality: null, sex: null, passportIssueDate: null } });
  });

  it("requires names, date of birth, number and expiry", () => {
    const result = validatePassportForm(EMPTY_PASSPORT_FORM, TODAY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["dateOfBirth", "expiryDate", "givenNames", "passportNumber", "surname"]);
    }
  });

  it("flags a date that cannot be read with the design's hint, on that field only", () => {
    const result = validatePassportForm({ ...valid, expiryDate: "22/10/32", dateOfIssue: "last year" }, TODAY);
    expect(result).toEqual({ ok: false, errors: { expiryDate: DATE_HINT, dateOfIssue: DATE_HINT } });
  });

  it("refuses an impossible date", () => {
    const result = validatePassportForm({ ...valid, dateOfBirth: "31 Feb 1990" }, TODAY);
    expect(result).toEqual({ ok: false, errors: { dateOfBirth: DATE_HINT } });
  });

  it("refuses a date of birth in the future and an expiry before the issue date", () => {
    const future = validatePassportForm({ ...valid, dateOfBirth: "1 Jan 2030" }, TODAY);
    expect(future.ok === false && future.errors.dateOfBirth).toMatch(/future/);
    const backwards = validatePassportForm({ ...valid, dateOfIssue: "9 Feb 2031", expiryDate: "9 Feb 2021" }, TODAY);
    expect(backwards.ok === false && backwards.errors.expiryDate).toMatch(/before the date of issue/);
  });

  it("holds the number to 6-12 letters or digits", () => {
    for (const bad of ["12345", "1234567890123", "AB-123456", "AB!23456"]) {
      const result = validatePassportForm({ ...valid, passportNumber: bad }, TODAY);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.errors.passportNumber).toBeTruthy();
    }
  });

  it("maps sex to M, F or X and refuses anything else", () => {
    expect(normaliseSex("m")).toBe("M");
    expect(normaliseSex("Female")).toBe("F");
    expect(normaliseSex("x")).toBe("X");
    expect(normaliseSex("")).toBe("");
    expect(normaliseSex("maybe")).toBeNull();
    const result = validatePassportForm({ ...valid, sex: "maybe" }, TODAY);
    expect(result).toEqual({ ok: false, errors: { sex: "Choose M, F or X." } });
  });
});

describe("previewPassportCheck", () => {
  const trip = { destination: "Tenerife", departure: "2027-04-09" };

  it("is fine when the passport has more than six months left at departure", () => {
    expect(previewPassportCheck("9 Feb 2031", trip, "Sam", TODAY)).toEqual({ status: "ok", text: "Valid for your trip to Tenerife on 9 April 2027." });
  });

  it("warns when six months or less are left, naming the agent", () => {
    expect(previewPassportCheck("9 Oct 2027", trip, "Sam", TODAY)).toEqual({
      status: "warning",
      text: "This passport has less than 6 months left when you travel on 9 April 2027. Sam will be in touch.",
    });
    expect(previewPassportCheck("9 Oct 2027", trip, "", TODAY)?.text).toMatch(/Your agent will be in touch\.$/);
  });

  it("warns on exactly six months (the server's rule is 'six months or less')", () => {
    expect(previewPassportCheck("9 Oct 2027", trip, "Sam", TODAY)?.status).toBe("warning");
    expect(previewPassportCheck("10 Oct 2027", trip, "Sam", TODAY)?.status).toBe("ok");
  });

  it("says so when it expires before the trip", () => {
    expect(previewPassportCheck("1 Mar 2027", trip, "Sam", TODAY)?.text).toBe("This passport expires before you travel on 9 April 2027. Sam will be in touch.");
  });

  it("measures from today when there is no trip", () => {
    expect(previewPassportCheck("9 Feb 2031", null, "Sam", TODAY)).toEqual({ status: "ok", text: "Valid until 9 February 2031." });
    expect(previewPassportCheck("1 Jan 2027", null, "Sam", TODAY)?.text).toBe("This passport has less than 6 months left (it expires on 1 January 2027). Sam will be in touch.");
    expect(previewPassportCheck("1 Jan 2026", null, "Sam", TODAY)?.text).toBe("This passport expired on 1 January 2026. Sam will be in touch.");
  });

  it("gives nothing while the expiry date cannot be read", () => {
    expect(previewPassportCheck("soon", trip, "Sam", TODAY)).toBeNull();
    expect(DATES_CHECK_HINT).toBe("Write the dates like 22 Oct 2032 so we can check them.");
  });

  it("tints the box white with a tick when fine, soft red otherwise", () => {
    expect(checkBoxTone("ok")).toEqual({ background: "#FFFFFF", borderColor: "#D9C7B1", prefix: "✓ " });
    expect(checkBoxTone("warning")).toEqual({ background: "#FDECEA", borderColor: "#E7B4AD", prefix: "" });
  });
});

describe("traveller rows", () => {
  it("maps the status word from the passport and its check", () => {
    expect(passengerStatus({ hasPassport: false, check: { status: "missing", text: "" } })).toEqual({ label: "Needed", tone: "needed" });
    expect(passengerStatus({ hasPassport: true, check: { status: "ok", text: "" } })).toEqual({ label: "✓ Added", tone: "added" });
    expect(passengerStatus({ hasPassport: true, check: { status: "warning", text: "" } })).toEqual({ label: "Check", tone: "check" });
  });

  it("labels the lead, then Traveller 2, 3...", () => {
    expect([0, 1, 2].map(travellerLabel)).toEqual(["Lead passenger", "Traveller 2", "Traveller 3"]);
  });

  it("title-cases names read in capitals and falls back to the label", () => {
    expect(titleCaseName("JEAN-PAUL O'NEIL")).toBe("Jean-Paul O'Neil");
    expect(passengerName({ firstName: "EMMA", surname: "BOUY" }, 1)).toBe("Emma Bouy");
    expect(passengerName({ firstName: "", surname: "" }, 2)).toBe("Traveller 3");
  });

  it("shows only the last four of the number, dates as 9 Feb 2031", () => {
    expect(passportRows(passenger())).toEqual([
      { label: "Passport no.", value: "•••••3027" },
      { label: "Expires", value: "22 Oct 2032" },
      { label: "Nationality", value: "British Citizen" },
      { label: "Date of birth", value: "3 Mar 1990" },
    ]);
    expect(passportRows(passenger({ passportLast4: null }))[0].value).toBe("");
  });

  it("counts how many passports are in", () => {
    expect(passportCountText([{ hasPassport: true }, { hasPassport: false }])).toBe("1 of 2 added");
  });
});
