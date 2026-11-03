import { describe, it, expect } from "vitest";
import { requestErrorMessage, requestErrorStatus } from "./request-error";

describe("requestErrorStatus", () => {
  it("reads the status the axios interceptor puts on the thrown Error", () => {
    const err = Object.assign(new Error("Nope"), { status: 404 });
    expect(requestErrorStatus(err)).toBe(404);
  });

  it("still reads a raw axios-style response status", () => {
    expect(requestErrorStatus({ response: { status: 403 } })).toBe(403);
  });

  it("returns undefined when there is no status", () => {
    expect(requestErrorStatus(new Error("offline"))).toBeUndefined();
    expect(requestErrorStatus(null)).toBeUndefined();
  });
});

describe("requestErrorMessage with an interceptor error", () => {
  it("returns the server message carried on the Error", () => {
    const err = Object.assign(new Error("NEW_PRIMARY_REQUIRED"), { status: 400 });
    expect(requestErrorMessage(err, "")).toBe("NEW_PRIMARY_REQUIRED");
  });
});
