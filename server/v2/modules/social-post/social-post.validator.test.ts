import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import { validate } from "../../middlewares/validation.middleware";
import { parseAccountIdsField, scheduleMediaSchema, updateSocialPostSchema } from "./social-post.validator";

const ID = "3f2b8c1e-6a4d-4b1e-9c7a-2d5e8f0a1b3c";

async function run(schema: Parameters<typeof validate>[0], req: Partial<Request>) {
  const next = vi.fn();
  await validate(schema)(req as Request, {} as never, next);
  return next.mock.calls[0]?.[0] as { statusCode?: number; message?: string } | undefined;
}

describe("updateSocialPostSchema (PATCH /social-posts/:id)", () => {
  it("accepts post and accountIds", async () => {
    expect(await run(updateSocialPostSchema, { params: { id: ID }, body: { post: "x", accountIds: [1, 2] } })).toBeUndefined();
    expect(await run(updateSocialPostSchema, { params: { id: ID }, body: {} })).toBeUndefined();
  });

  it.each([
    ["onlySocialsId", { onlySocialsId: "evil" }],
    ["quote_id", { quote_id: ID }],
    ["postSchedule", { postSchedule: "2020-01-01" }],
    ["id", { id: ID }],
  ])("rejects an unknown key (%s) with 400", async (_k, body) => {
    const err = await run(updateSocialPostSchema, { params: { id: ID }, body });
    expect(err?.statusCode).toBe(400);
  });

  it.each([[[]], [["a"]], [[1.5]], [[-1]], [[0]]])("rejects bad accountIds %j", async (accountIds) => {
    expect((await run(updateSocialPostSchema, { params: { id: ID }, body: { accountIds } }))?.statusCode).toBe(400);
  });

  it("rejects a non-string post", async () => {
    expect((await run(updateSocialPostSchema, { params: { id: ID }, body: { post: 5 } }))?.statusCode).toBe(400);
  });
});

describe("scheduleMediaSchema accountIds (multipart JSON string)", () => {
  const body = (accountIds?: string) => ({ postSchedule: "x", ...(accountIds === undefined ? {} : { accountIds }) });

  it("accepts a missing field and a valid JSON int array", async () => {
    expect(await run(scheduleMediaSchema, { body: body() })).toBeUndefined();
    expect(await run(scheduleMediaSchema, { body: body("[81085,7]") })).toBeUndefined();
  });

  it.each(["[]", "not json", "[\"a\"]", "[1.2]", "{\"a\":1}", "[0]", "[-3]"])("rejects %s with 400", async (raw) => {
    const err = await run(scheduleMediaSchema, { body: body(raw) });
    expect(err?.statusCode).toBe(400);
  });
});

describe("parseAccountIdsField", () => {
  it("parses a JSON array and tolerates absence", () => {
    expect(parseAccountIdsField("[1,2]")).toEqual([1, 2]);
    expect(parseAccountIdsField(undefined)).toBeUndefined();
    expect(parseAccountIdsField("")).toBeUndefined();
    expect(parseAccountIdsField("garbage")).toBeUndefined();
  });
});
