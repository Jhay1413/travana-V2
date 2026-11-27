import { describe, it, expect } from "vitest";
import { portalDocumentDownloadValidator, portalDocumentListValidator, portalDocumentViewValidator } from "./portal-documents.validator";

describe("portalDocumentListValidator", () => {
  it("accepts no filter or a uuid", () => {
    expect(portalDocumentListValidator.safeParse({ query: {} }).success).toBe(true);
    expect(portalDocumentListValidator.safeParse({ query: { bookingId: "3f2b8c1e-5d4a-4b7e-9c0d-1a2b3c4d5e6f" } }).success).toBe(true);
  });
  it("rejects a filter that is not a uuid", () => {
    expect(portalDocumentListValidator.safeParse({ query: { bookingId: "x" } }).success).toBe(false);
    expect(portalDocumentListValidator.safeParse({ query: { bookingId: ["a", "b"] } }).success).toBe(false);
  });
});

describe("portalDocumentDownloadValidator", () => {
  it("bounds the id but leaves format to the service (same 404 for any wrong id)", () => {
    expect(portalDocumentDownloadValidator.safeParse({ params: { id: "anything" } }).success).toBe(true);
    expect(portalDocumentDownloadValidator.safeParse({ params: { id: "" } }).success).toBe(false);
    expect(portalDocumentDownloadValidator.safeParse({ params: { id: "x".repeat(101) } }).success).toBe(false);
  });
});

describe("portalDocumentViewValidator", () => {
  it("bounds the id exactly like the download (format is the service's 404)", () => {
    expect(portalDocumentViewValidator.safeParse({ params: { id: "anything" } }).success).toBe(true);
    expect(portalDocumentViewValidator.safeParse({ params: { id: "" } }).success).toBe(false);
    expect(portalDocumentViewValidator.safeParse({ params: { id: "x".repeat(101) } }).success).toBe(false);
  });
});
