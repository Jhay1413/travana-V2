import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { validate } from "../../middlewares/validation.middleware";
import { AppError } from "../../utils/error-handler";
import { createClientValidator, updateClientValidator } from "./client.validator";
import { createNeonClientValidator, updateNeonClientValidator } from "../neon-client/neon-client.validator";
import { PHONE_ERROR_MESSAGE } from "@shared/phone";

const ID = "6f1c2f0e-8c3a-4a39-9d1e-2f6c5b9f7a11";
const NEW_CLIENT = { orgId: ID, branchId: ID, createdBy: ID, firstName: "Ada", surename: "Lovelace" };

async function run(schema: Parameters<typeof validate>[0], req: Partial<Request>) {
  const next = vi.fn();
  await validate(schema)({ body: {}, query: {}, params: {}, ...req } as Request, {} as Response, next);
  return next.mock.calls[0]?.[0] as AppError | undefined;
}

describe.each([
  ["v2 clients", createClientValidator, updateClientValidator, { id: ID }],
  ["neon clients", createNeonClientValidator, updateNeonClientValidator, { id: ID }],
])("%s phone number rule", (_name, create, update, params) => {
  it("create accepts a valid phone", async () => {
    expect(await run(create, { body: { ...NEW_CLIENT, phoneNumber: "+44 7123 456789" } })).toBeUndefined();
  });

  it.each(["1234567890123456789012345678", "123", "abcdefghij", ""])("create rejects %j with 400", async (phoneNumber) => {
    const err = await run(create, { body: { ...NEW_CLIENT, phoneNumber } });
    expect(err?.statusCode).toBe(400);
    expect(err?.message).toBe(PHONE_ERROR_MESSAGE);
  });

  it("update without phoneNumber passes", async () => {
    expect(await run(update, { params, body: { firstName: "Grace" } })).toBeUndefined();
  });

  it("update with a valid phone passes", async () => {
    expect(await run(update, { params, body: { phoneNumber: "07123456789" } })).toBeUndefined();
  });

  it("update with a bad phone is a 400", async () => {
    const err = await run(update, { params, body: { phoneNumber: "9".repeat(40) } });
    expect(err?.statusCode).toBe(400);
    expect(err?.message).toBe(PHONE_ERROR_MESSAGE);
  });
});
