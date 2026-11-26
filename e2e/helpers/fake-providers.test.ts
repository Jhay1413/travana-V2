import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startFakeProviders, type RunningFakeProviders, fakeTemplate, FAKE_WHATSAPP_CHANNEL } from "./fake-providers";

let fake: RunningFakeProviders;

beforeAll(async () => {
  fake = await startFakeProviders(0); // any free port; the suite's own server uses the fixed one
});
afterAll(() => fake.close());
beforeEach(() => fake.state.reset());

const post = (path: string, body: unknown, token = "t") =>
  fetch(`${fake.url}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
const get = (path: string) => fetch(`${fake.url}${path}`, { headers: { Authorization: "Bearer t" } });

describe("fake Connexa", () => {
  it("refuses logins and messages until armed, and records the attempts", async () => {
    expect((await post("/connexa/api/issue-token", { email: "a", password: "b" })).status).toBe(401);
    expect((await post("/connexa/api/schedule-message", { contact_number: "447700900123", message: "hi" })).status).toBe(401);
    expect(fake.state.calls().map((c) => c.path)).toEqual(["/api/issue-token", "/api/schedule-message"]);
  });

  it("when armed, hands out a token and accepts a message in the shape sendSms reads", async () => {
    fake.state.configure({ connexaArmed: true });
    const login = (await (await post("/connexa/api/issue-token", {})).json()) as { access_token: string; expires_in: number };
    expect(login.access_token).toBeTruthy();
    // Short enough that the server never caches it, so each attempt shows up as its own token request.
    expect(login.expires_in).toBe(1);
    const sent = (await (await post("/connexa/api/schedule-message", { contact_number: "447700900123", message: "hi" })).json()) as { response: { status: string; data: { uuid: string } } };
    expect(sent.response.status).toBe("accepted");
    expect(sent.response.data.uuid).toMatch(/^fake-sms-/);
    expect(fake.state.calls().at(-1)).toMatchObject({ provider: "connexa", body: { contact_number: "447700900123", message: "hi" }, token: "t" });
  });
});

describe("fake SendSeven", () => {
  it("lists a verified WhatsApp channel, the channel types and health", async () => {
    expect(await (await get("/sendseven/channels")).json()).toEqual([FAKE_WHATSAPP_CHANNEL]);
    expect(((await (await get("/sendseven/channels/types")).json()) as { available: string[] }).available).toContain("whatsapp");
    expect(await (await get("/sendseven/channels/health")).json()).toMatchObject({ has_errors: false });
  });

  it("lists only the approved templates of the channel asked for", async () => {
    fake.state.configure({ templates: [fakeTemplate("a", "Hi {{1}}"), fakeTemplate("b", "Hi", { channel_id: "other" })] });
    const res = (await (await get(`/sendseven/whatsapp-templates?channel_id=${FAKE_WHATSAPP_CHANNEL.id}`)).json()) as { templates: { name: string }[]; total: number };
    expect(res.templates.map((t) => t.name)).toEqual(["a"]);
    expect(res.total).toBe(1);
  });

  it("answers a template send with the success shape and records who it went to", async () => {
    const res = (await (await post("/sendseven/whatsapp-templates/booking_ok/send", { whatsapp_id: "447700900123", variable_values: { "1": "Ann" } })).json()) as { success: boolean; message_id: string };
    expect(res.success).toBe(true);
    expect(res.message_id).toMatch(/^fake-wa-/);
    expect(fake.state.calls()[0]).toMatchObject({ provider: "sendseven", method: "POST", path: "/whatsapp-templates/booking_ok/send", body: { whatsapp_id: "447700900123" } });
  });

  it("can be told to reject a template or fail with an HTTP error", async () => {
    fake.state.configure({ templateSendFails: true });
    expect(((await (await post("/sendseven/whatsapp-templates/x/send", {})).json()) as { success: boolean }).success).toBe(false);
    fake.state.configure({ templateSendFails: false, templateSendErrors: true });
    expect((await post("/sendseven/whatsapp-templates/x/send", {})).status).toBe(500);
  });

  it("answers the conversation check (no open chat) and a plain text message", async () => {
    expect(await (await post("/sendseven/conversations/check-existing", {})).json()).toMatchObject({ has_existing_open: false });
    expect(await (await post("/sendseven/messages", { text: "hi" })).json()).toMatchObject({ status: "sent" });
  });

  it("answers an unknown path with 404 (and records it, so a stray call is visible)", async () => {
    expect((await get("/sendseven/nope")).status).toBe(404);
    expect((await get("/elsewhere")).status).toBe(404);
    expect(fake.state.calls().map((c) => c.path)).toEqual(["/nope"]);
  });
});

describe("the control surface", () => {
  it("returns, and resets, the recorded calls and the configuration", async () => {
    await post("/sendseven/messages", { text: "x" });
    expect(((await (await get("/__control/calls")).json()) as unknown[]).length).toBe(1);
    fake.state.configure({ connexaArmed: true });
    await fetch(`${fake.url}/__control/reset`, { method: "POST" });
    expect(fake.state.calls()).toEqual([]);
    expect(fake.state.config().connexaArmed).toBe(false);
  });

  it("never records its own control calls", async () => {
    await get("/__control/calls");
    expect(fake.state.calls()).toEqual([]);
  });
});
