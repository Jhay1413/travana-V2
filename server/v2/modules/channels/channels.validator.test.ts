import { describe, it, expect, vi } from "vitest";
import { validate } from "../../middlewares/validation.middleware";
import { connectTokenValidator, delegateConnectValidator } from "./channels.validator";

type Schema = Parameters<typeof validate>[0];

async function run(schema: Schema, body: unknown) {
  const next = vi.fn();
  await validate(schema)({ body, query: {}, params: {} } as never, {} as never, next);
  return next;
}

async function expect400(schema: Schema, body: unknown) {
  const next = await run(schema, body);
  expect(next).toHaveBeenCalledTimes(1);
  expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 400 });
}

async function expectOk(schema: Schema, body: unknown) {
  const next = await run(schema, body);
  expect(next).toHaveBeenCalledTimes(1);
  expect(next.mock.calls[0]).toEqual([]);
}

describe("connectTokenValidator", () => {
  const ok = { allowed_channel_types: ["whatsapp"] };
  it("rejects a missing allowed_channel_types", () => expect400(connectTokenValidator, {}));
  it("rejects an empty allowed_channel_types", () => expect400(connectTokenValidator, { allowed_channel_types: [] }));
  it("accepts a valid body", () => expectOk(connectTokenValidator, { ...ok, partner_name: "P", max_uses: 3 }));
  it("rejects http redirect urls", () => expect400(connectTokenValidator, { ...ok, partner_redirect_url: "http://x" }));
  it("rejects javascript: redirect urls", () =>
    expect400(connectTokenValidator, { ...ok, partner_redirect_url: "javascript:alert(1)" }));
  it("accepts an https redirect url", () =>
    expectOk(connectTokenValidator, { ...ok, partner_redirect_url: "https://app.example.com/agency/integrations" }));
  it("rejects a partner_name over 120 chars", () =>
    expect400(connectTokenValidator, { ...ok, partner_name: "a".repeat(121) }));
});

describe("delegateConnectValidator", () => {
  const ok = { email: "a@b.co", channel_types: ["whatsapp"] };
  it("rejects a bad email", () => expect400(delegateConnectValidator, { ...ok, email: "nope" }));
  it("rejects expires_in_hours 0", () => expect400(delegateConnectValidator, { ...ok, expires_in_hours: 0 }));
  it("rejects expires_in_hours 169", () => expect400(delegateConnectValidator, { ...ok, expires_in_hours: 169 }));
  it("accepts expires_in_hours 48", () => expectOk(delegateConnectValidator, { ...ok, expires_in_hours: 48 }));
  it("rejects empty channel_types", () => expect400(delegateConnectValidator, { ...ok, channel_types: [] }));
});
