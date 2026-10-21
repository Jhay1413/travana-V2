import { describe, expect, it } from "vitest";
import type { Transaction } from "@/features/quote/types";
import { getTaskEntity } from "./task-entity";

const tx = (over: object) => ({ id: "t1", ...over }) as unknown as Transaction;

describe("getTaskEntity", () => {
  it("uses the enquiry for the Enquiry stage", () => {
    expect(getTaskEntity(tx({ enquiry: { id: "e1", user_id: "u" } }), "Enquiry")).toEqual({ type: "enquiry", id: "e1", userId: "u" });
  });
  it("uses the booking id under type quote for Booked", () => {
    expect(getTaskEntity(tx({ booking: { id: "b1" } }), "Booked").id).toBe("b1");
  });
  it("has no id when the deal lacks the record", () => {
    expect(getTaskEntity(tx({}), "Quoted").id).toBeUndefined();
    expect(getTaskEntity(tx({}), "Enquiry").id).toBeUndefined();
  });
});
