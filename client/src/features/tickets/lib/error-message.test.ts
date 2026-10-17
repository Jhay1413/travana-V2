import { describe, expect, it } from "vitest";
import { ticketErrorMessage } from "./error-message";

describe("ticketErrorMessage", () => {
  it("prefers the server message on the response", () => {
    expect(ticketErrorMessage({ response: { data: { message: "Holiday not found" } } }, "Failed")).toBe("Holiday not found");
  });
  it("reads a message carried on the error data", () => {
    const err = Object.assign(new Error("x"), { data: { message: "Holiday belongs to a different client" } });
    expect(ticketErrorMessage(err, "Failed")).toBe("Holiday belongs to a different client");
  });
  it("uses a plain Error message", () => {
    expect(ticketErrorMessage(new Error("Ticket not found"), "Failed")).toBe("Ticket not found");
  });
  it("hides generic transport messages", () => {
    expect(ticketErrorMessage(new Error("Request failed with status code 400"), "Failed")).toBe("Failed");
    expect(ticketErrorMessage(new Error("Network Error"), "Failed")).toBe("Failed");
  });
  it("falls back for anything else", () => {
    expect(ticketErrorMessage(null, "Failed")).toBe("Failed");
    expect(ticketErrorMessage("boom", "Failed")).toBe("Failed");
    expect(ticketErrorMessage({}, "Failed")).toBe("Failed");
  });
});
