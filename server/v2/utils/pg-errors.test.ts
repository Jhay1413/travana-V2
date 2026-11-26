import { describe, expect, it } from "vitest";
import { isUndefinedColumn, isUniqueViolation, isValueTooLong } from "./pg-errors";

describe("isUniqueViolation", () => {
  it("detects 23505 directly and through a wrapped cause", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ message: "wrapped", cause: { code: "23505" } })).toBe(true);
  });

  it("ignores other errors and non-objects", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(new Error("x"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
  });
});

describe("isUndefinedColumn", () => {
  it("detects 42703 directly and through a wrapped cause", () => {
    expect(isUndefinedColumn({ code: "42703" })).toBe(true);
    expect(isUndefinedColumn({ message: "wrapped", cause: { code: "42703" } })).toBe(true);
  });

  it("ignores other errors and non-objects", () => {
    expect(isUndefinedColumn({ code: "42P01" })).toBe(false);
    expect(isUndefinedColumn(new Error("x"))).toBe(false);
    expect(isUndefinedColumn(undefined)).toBe(false);
  });
});

describe("isValueTooLong", () => {
  it("is true for 22001, also wrapped as a cause, and false otherwise", () => {
    expect(isValueTooLong({ code: "22001" })).toBe(true);
    expect(isValueTooLong({ cause: { code: "22001" } })).toBe(true);
    expect(isValueTooLong({ code: "23505" })).toBe(false);
    expect(isValueTooLong(null)).toBe(false);
  });
});
