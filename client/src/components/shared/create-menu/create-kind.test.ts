import { describe, expect, it } from "vitest";
import { CREATE_MENU_ITEMS, isDealKind, resolveCreateRoute } from "./create-kind";

describe("CREATE_MENU_ITEMS", () => {
  it("lists the six kinds in order with their labels", () => {
    expect(CREATE_MENU_ITEMS.map((i) => [i.kind, i.label])).toEqual([
      ["client", "New client"],
      ["enquiry", "Enquiry"],
      ["quote", "Quote"],
      ["booking", "Booking"],
      ["task", "Task"],
      ["ticket", "Ticket"],
    ]);
  });

  it("starts a new group at enquiry and task only", () => {
    expect(CREATE_MENU_ITEMS.filter((i) => i.groupStart).map((i) => i.kind)).toEqual(["enquiry", "task"]);
  });
});

describe("resolveCreateRoute", () => {
  it("always uses the client form for a new client", () => {
    expect(resolveCreateRoute("client", true)).toBe("client-form");
    expect(resolveCreateRoute("client", false)).toBe("client-form");
  });

  it("defers to the caller when onCreate exists, else runs the built-in flow", () => {
    expect(resolveCreateRoute("quote", true)).toBe("caller");
    expect(resolveCreateRoute("task", false)).toBe("built-in");
  });
});

describe("isDealKind", () => {
  it("is true only for enquiry, quote and booking", () => {
    expect(CREATE_MENU_ITEMS.filter((i) => isDealKind(i.kind)).map((i) => i.kind)).toEqual(["enquiry", "quote", "booking"]);
  });
});
