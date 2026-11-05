import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { validate } from "../../middlewares/validation.middleware";
import type { AppError } from "../../utils/error-handler";
import { createClientForContactValidator } from "./contact-link.validator";
import { PHONE_ERROR_MESSAGE } from "@shared/phone";

async function run(phoneNumber: unknown) {
  const next = vi.fn();
  await validate(createClientForContactValidator)(
    { body: { firstName: "Ada", surename: "L", phoneNumber }, query: {}, params: { contactId: "ss-contact-123" } } as unknown as Request,
    {} as Response,
    next,
  );
  return next.mock.calls[0]?.[0] as AppError | undefined;
}

describe("createClientForContactValidator phone rule", () => {
  it.each(["07123456789", "07123 456789", "  +44 7123 456789  "])("accepts %j", async (p) => expect(await run(p)).toBeUndefined());

  it.each(["", "   ", "12345", "+1 415 555 2671", "1".repeat(30), "6f1c2f0e-8c3a-4a39-9d1e-2f6c5b9f7a11", "abc"])(
    "rejects %j with 400 and the shared message",
    async (p) => {
      const err = await run(p);
      expect(err?.statusCode).toBe(400);
      expect(err?.message).toBe(PHONE_ERROR_MESSAGE);
    },
  );

  it("rejects a missing phone with 400", async () => expect((await run(undefined))?.statusCode).toBe(400));
});
