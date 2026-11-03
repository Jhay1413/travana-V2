import { describe, expect, it } from "vitest";
import { enquiryHref, readCreated } from "./read-created";

describe("readCreated", () => {
  it("reads both ids from { transaction, enquiry }", () => {
    expect(readCreated({ transaction: { id: "t1" }, enquiry: { id: "e1" } })).toEqual({ transactionId: "t1", enquiryId: "e1" });
  });
  it("returns null when either is missing or the shape is wrong", () => {
    expect(readCreated({ id: "t1" })).toBeNull();
    expect(readCreated({ transaction: { id: "t1" } })).toBeNull();
    expect(readCreated(null)).toBeNull();
    expect(readCreated("x")).toBeNull();
  });
});

describe("enquiryHref", () => {
  it("links to the holiday on the client page", () => {
    expect(enquiryHref("c1", "e1")).toBe("/clients/c1?holiday=enquiry:e1");
  });
});

describe("readCreated unreadable shapes", () => {
  it("rejects empty ids and non-object entries", () => {
    expect(readCreated({ transaction: { id: "" }, enquiry: { id: "e1" } })).toBeNull();
    expect(readCreated({ transaction: "t1", enquiry: "e1" })).toBeNull();
    expect(readCreated(undefined)).toBeNull();
  });
});
