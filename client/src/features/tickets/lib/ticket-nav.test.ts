import { describe, expect, it } from "vitest";
import { prevNext } from "./ticket-nav";

describe("prevNext", () => {
  const order = ["a", "b", "c"];
  it("returns both neighbours in the middle", () => {
    expect(prevNext(order, "b")).toEqual({ index: 1, total: 3, prevId: "a", nextId: "c" });
  });
  it("has no previous at the start and no next at the end", () => {
    expect(prevNext(order, "a")).toMatchObject({ prevId: null, nextId: "b" });
    expect(prevNext(order, "c")).toMatchObject({ prevId: "b", nextId: null });
  });
  it("gives no neighbours when the ticket is not in the order", () => {
    expect(prevNext(order, "z")).toEqual({ index: -1, total: 3, prevId: null, nextId: null });
    expect(prevNext([], "a").total).toBe(0);
  });
});
