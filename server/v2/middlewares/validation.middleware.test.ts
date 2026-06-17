import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { validate } from "./validation.middleware";
import { AppError } from "../utils/error-handler";

const schema = z.object({
  body: z.object({ name: z.string().min(1, "name is required") }),
});

describe("validate middleware", () => {
  it("calls next with no error when the payload is valid", async () => {
    const next = vi.fn();
    const req = { body: { name: "Ada" }, query: {}, params: {} } as never;

    await validate(schema)(req, {} as never, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it("forwards a 400 AppError carrying the first Zod message on invalid input", async () => {
    const next = vi.fn();
    const req = { body: { name: "" }, query: {}, params: {} } as never;

    await validate(schema)(req, {} as never, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("name is required");
  });
});
