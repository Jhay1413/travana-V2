import { describe, expect, it } from "vitest";
import { describeUpdateError, isUpdateTemplateMissing } from "./update-errors";

// Same shape the axios response interceptor rejects with (client/src/api/client/interceptors.ts).
const err = (status: number, data: { code?: string; message?: string }) => {
  const wrapped = new Error(data.message || "Request failed") as Error & {
    status?: number;
    code?: string;
    data?: Record<string, unknown>;
  };
  wrapped.status = status;
  wrapped.code = data.code;
  wrapped.data = data;
  return wrapped;
};

describe("describeUpdateError", () => {
  it("maps a missing template to the blocked copy", () => {
    const e = err(409, { code: "update_template_missing", message: "x" });
    expect(describeUpdateError(e, "Sam").description).toContain("A manager needs to choose a General update template");
    expect(describeUpdateError(e, "Sam").description).toContain("message Sam.");
    expect(isUpdateTemplateMissing(e)).toBe(true);
  });
  it("still understands a raw axios-shaped error", () => {
    const e = { response: { status: 409, data: { code: "update_template_missing" } } };
    expect(isUpdateTemplateMissing(e)).toBe(true);
  });
  it("maps a duplicate send", () => {
    expect(describeUpdateError(err(429, { message: "slow" }), "Sam").description).toBe("This update was just sent");
  });
  it("passes through the template failure detail", () => {
    const e = err(502, { code: "template_failed", message: "WhatsApp didn't accept the update: bad param" });
    expect(describeUpdateError(e, "Sam").description).toBe("WhatsApp didn't accept the update: bad param");
    expect(isUpdateTemplateMissing(e)).toBe(false);
  });
  it("falls back to the error message", () => {
    expect(describeUpdateError(new Error("boom"), "Sam").description).toBe("boom");
    expect(describeUpdateError(undefined, "Sam").description).toBe("Unknown error");
  });
});
