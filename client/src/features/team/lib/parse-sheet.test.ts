import { describe, expect, it } from "vitest";
import { SheetError, csvTextToInviteRows, isCsvFile, parseCsvText } from "./parse-sheet";

const branches = [{ id: "b1", name: "Leeds" }];

describe("parse-sheet", () => {
  it("parses quoted cells, a BOM and blank lines", () => {
    const table = parseCsvText('﻿First name,Last name\r\n"Ann, Marie",O\'Neil\r\n\r\n');
    expect(table).toEqual([
      ["First name", "Last name"],
      ["Ann, Marie", "O'Neil"],
    ]);
  });

  it("turns a CSV into invite rows", () => {
    const rows = csvTextToInviteRows(
      "First name,Last name,Email,Role,Branch\nAlex,Taylor,alex@x.com,Agent,Leeds\nSam,Rivers,sam@x.com,Homeworker,",
      branches,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ email: "alex@x.com", role: "agent", branchId: "b1" });
    expect(rows[1]).toMatchObject({ role: "homeworker", branchId: "" });
  });

  it("throws a readable error for an empty file", () => {
    expect(() => csvTextToInviteRows("", branches)).toThrow(SheetError);
    expect(() => csvTextToInviteRows("First name,Last name,Email,Role,Branch\n", branches)).toThrow(
      "We couldn't find any people in that file.",
    );
  });

  it("accepts csv-like extensions only", () => {
    expect(isCsvFile("people.CSV")).toBe(true);
    expect(isCsvFile("people.tsv")).toBe(true);
    expect(isCsvFile("people.xlsx")).toBe(false);
  });
});

describe("row cap", () => {
  it("rejects more than 200 people with a clear message", () => {
    const lines = Array.from({ length: 201 }, (_, i) => `A,B,p${i}@x.com,Agent,Leeds`).join("\n");
    expect(() => csvTextToInviteRows(`First name,Last name,Email,Role,Branch\n${lines}`, branches)).toThrow(
      "That is more than 200 people. Split the list into smaller files.",
    );
  });

  it("accepts exactly 200", () => {
    const lines = Array.from({ length: 200 }, (_, i) => `A,B,p${i}@x.com,Agent,Leeds`).join("\n");
    expect(csvTextToInviteRows(`First name,Last name,Email,Role,Branch\n${lines}`, branches)).toHaveLength(200);
  });
});
