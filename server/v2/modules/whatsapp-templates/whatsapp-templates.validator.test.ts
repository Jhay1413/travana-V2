import { describe, it, expect, vi } from "vitest";
import { validate } from "../../middlewares/validation.middleware";
import { createTemplateBodySchema, createTemplateValidator, syncTemplatesValidator } from "./whatsapp-templates.validator";

type Schema = Parameters<typeof validate>[0];

async function run(schema: Schema, body: unknown) {
  const next = vi.fn();
  await validate(schema)({ body, query: {}, params: {} } as never, {} as never, next);
  return next;
}

async function expect400(schema: Schema, body: unknown, message?: string) {
  const next = await run(schema, body);
  expect(next).toHaveBeenCalledTimes(1);
  expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 400 });
  if (message) expect(next.mock.calls[0][0].message).toContain(message);
}

async function expectOk(schema: Schema, body: unknown) {
  const next = await run(schema, body);
  expect(next).toHaveBeenCalledTimes(1);
  expect(next.mock.calls[0]).toEqual([]);
}

const ok = {
  channel_id: "6f1c2b0e-3b0a-4c55-9d53-2a5d8e3f7a11",
  name: "order_update",
  category: "UTILITY",
  body_text: "Hi {{1}}, order {{2}} shipped",
  body_examples: ["John", "12345"],
};

describe("createTemplateValidator", () => {
  it("accepts a valid body", () =>
    expectOk(createTemplateValidator, {
      ...ok,
      header_text: "Order",
      footer_text: "Reply STOP",
      buttons: [{ type: "URL", text: "View", url: "https://example.com/x" }],
    }));
  it("accepts a body with no placeholders and no examples", () =>
    expectOk(createTemplateValidator, { ...ok, body_text: "Hello there", body_examples: [] }));
  it("rejects a placeholder gap", () =>
    expect400(createTemplateValidator, { ...ok, body_text: "{{1}} and {{3}}", body_examples: ["a", "b"] }, "consecutively"));
  it("rejects an examples count mismatch", () =>
    expect400(createTemplateValidator, { ...ok, body_examples: ["only"] }, "example"));
  it("rejects a URL button without url", () =>
    expect400(createTemplateValidator, { ...ok, buttons: [{ type: "URL", text: "View" }] }, "url"));
  it("rejects a phone button without phone_number", () =>
    expect400(createTemplateValidator, { ...ok, buttons: [{ type: "PHONE_NUMBER", text: "Call" }] }, "phone_number"));
  it("rejects a bad name", () => expect400(createTemplateValidator, { ...ok, name: "Order Update" }));
  it("rejects unknown keys", () => expect400(createTemplateValidator, { ...ok, extra: 1 }));
  it("rejects AUTHENTICATION category", () => expect400(createTemplateValidator, { ...ok, category: "AUTHENTICATION" }));
  it("rejects more than 3 buttons", () =>
    expect400(createTemplateValidator, {
      ...ok,
      buttons: Array.from({ length: 4 }, () => ({ type: "QUICK_REPLY", text: "Hi" })),
    }));
});

describe("syncTemplatesValidator", () => {
  it("accepts a uuid channel_id", () => expectOk(syncTemplatesValidator, { channel_id: ok.channel_id }));
  it("rejects a missing or bad channel_id", async () => {
    await expect400(syncTemplatesValidator, {});
    await expect400(syncTemplatesValidator, { channel_id: "nope" });
  });

  it("defaults language to en when omitted", () => {
    const parsed = createTemplateBodySchema.parse({
      channel_id: "6f1c2b0e-3b0a-4c55-9d53-2a5d8e3f7a11",
      name: "hello",
      category: "MARKETING",
      body_text: "Hi",
      body_examples: [],
    });
    expect(parsed.language).toBe("en");
  });
});
