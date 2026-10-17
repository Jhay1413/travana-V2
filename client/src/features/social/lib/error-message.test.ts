import { describe, expect, it } from "vitest";
import { errorMessage } from "./error-message";

describe("errorMessage", () => {
  it("prefers the server message from an axios-style error", () => {
    const err = Object.assign(new Error("Request failed with status code 400"), {
      response: { data: { message: "Image too large" } },
    });
    expect(errorMessage(err, "fallback")).toBe("Image too large");
  });

  it("falls back to the Error message", () => {
    expect(errorMessage(new Error("boom"), "fallback")).toBe("boom");
  });

  it("uses the fallback for unknown values", () => {
    expect(errorMessage(undefined, "fallback")).toBe("fallback");
    expect(errorMessage("x", "fallback")).toBe("fallback");
    expect(errorMessage({ response: { data: {} } }, "fallback")).toBe("fallback");
  });
});
