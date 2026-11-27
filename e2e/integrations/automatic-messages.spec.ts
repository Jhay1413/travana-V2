import { chooseOption } from "../helpers/ui";
import type { Page } from "@playwright/test";
import { apiCreateClient, apiCreateQuoteDeal, dataOf, dbBookingFor, signIn, type ClientRow } from "../helpers/deals";
import { expect, expectLoginOk, expectToast, test } from "../helpers/fixtures";
import { fakeProviders } from "../helpers/fake-providers";
import { connectFakeWhatsapp, disconnectAll, logRows, optOut, saveAutoTemplate, setStoredChannel, switchOn } from "../helpers/messaging";
import { seedPortalCustomer } from "../helpers/portal";
import { queryRows, seedDealsAgency, seedHomeworker, seedMember, type DealsAgency } from "../helpers/seed";

/**
 * Automatic customer messages: the agency chooses WhatsApp (the default) or SMS, and what cannot be delivered on that
 * channel is not sent at all. Both providers are the loopback fakes (helpers/fake-providers.ts): nothing leaves this
 * machine, and every call they receive is recorded so a spec can say "exactly one template send, zero SMS".
 */

const PHONE = "07700900123";
const PHONE_DIGITS = "447700900123";
const SETTINGS = "/api/v2/customer-messaging/settings";
const READINESS = "/api/v2/customer-messaging/readiness";
const TEMPLATE = (purpose: string) => `/api/v2/customer-messaging/templates/${purpose}`;

test.beforeEach(async () => {
  await fakeProviders.reset();
});
test.afterAll(async () => {
  await disconnectAll();
});

/** The messages are sent in the background after the booking: give a stray one time to show up before saying there is none. */
const settle = (page: Page) => page.waitForTimeout(1_500);

/** An agency with a WhatsApp workspace, the booking-confirmation message switched on and a template chosen for it. */
async function readyAgency(): Promise<DealsAgency> {
  const agency = await seedDealsAgency();
  await connectFakeWhatsapp(agency.orgId);
  await switchOn(agency.orgId, "on_booking_create", "booking_confirmation");
  await saveAutoTemplate(agency.orgId, "booking_confirmation", {
    templateName: "booking_confirmed",
    variables: { "1": { source: "client_first_name" }, "2": { source: "destination" } },
  });
  return agency;
}

/** Books a deal for a new client of this agency (the same conversion the pipeline's Booked column does). */
async function book(page: Page, agency: DealsAgency, phone = PHONE): Promise<ClientRow> {
  const userId = await signIn(page, agency.agentEmail);
  const client = await apiCreateClient(page.request, { phoneNumber: phone });
  const deal = await apiCreateQuoteDeal(page.request, agency, client.id, userId);
  const res = await page.request.post(`/api/v2/bookings/convert/${deal.quoteId}`, { data: { haysRef: "HAY-1234567", supplierRef: "TUI 1" } });
  expect(res.status(), await res.text()).toBe(201);
  expect(await dbBookingFor(deal.transactionId)).toBeTruthy();
  return client;
}

/** Waits for the background send to finish (it always leaves one log row), then returns the rows. */
async function waitForLog(clientId: string, count = 1) {
  await expect.poll(async () => (await logRows(clientId)).length, { timeout: 20_000 }).toBeGreaterThanOrEqual(count);
  return logRows(clientId);
}

async function openIntegrations(page: Page, email: string): Promise<void> {
  await signIn(page, email);
  await page.goto("/agency/integrations");
  // The first visit compiles the page in the dev server, which can take a while.
  await expect(page.getByTestId("integrations-auto-messages")).toBeVisible({ timeout: 60_000 });
}

test.describe("Automatic messages on the Integrations page", () => {
  test("a manager sees the section, switches the channel, picks a template and the status turns Ready", async ({ page }) => {
    const agency = await seedDealsAgency();
    await connectFakeWhatsapp(agency.orgId);
    await switchOn(agency.orgId, "on_booking_create", "booking_confirmation");
    await openIntegrations(page, agency.adminEmail);

    const status = page.getByTestId("auto-booking_confirmation-status");
    // WhatsApp is the default, and no template has been chosen yet: red, in plain words.
    await expect(page.getByTestId("select-auto-channel")).toContainText("Send by WhatsApp");
    await expect(status).toHaveAttribute("data-state", "not-sent");
    await expect(status).toContainText("Not being sent: no template chosen");
    // A type nobody switched on is grey, not red; the sign-in link is always on.
    await expect(page.getByTestId("auto-portal_ready-status")).toHaveAttribute("data-state", "off");
    await expect(page.getByTestId("auto-portal_sign_in-status")).toHaveAttribute("data-state", "ready");

    const select = page.getByTestId("select-auto-booking_confirmation");
    await expect(select).toBeEnabled();
    await chooseOption(page, select, /booking_confirmed · en_GB/);
    // {{1}} defaults to the client's name; {{2}} needs mapping.
    await expect(page.getByTestId("button-save-auto-booking_confirmation")).toBeDisabled();
    await chooseOption(page, page.getByRole("combobox", { name: "Source for placeholder 2" }), /Destination/);
    await page.getByTestId("button-save-auto-booking_confirmation").click();
    await expectToast(page, "Booking confirmations will use this template");
    await expect(status).toHaveAttribute("data-state", "ready");
    await expect(status).toHaveText(/Ready/);

    // What was saved is what the server holds, for this agency only.
    const saved = await dataOf<{ templateName: string; variables: Record<string, { source: string }> }>(await page.request.get(TEMPLATE("booking_confirmation")));
    expect(saved).toMatchObject({ templateName: "booking_confirmed", variables: { "1": { source: "client_first_name" }, "2": { source: "destination" } } });

    // Switch the channel to text messages and back.
    await chooseOption(page, page.getByTestId("select-auto-channel"), /Send by text message/);
    await expectToast(page, "Automatic messages will go by text");
    expect((await dataOf<{ autoChannel: string }>(await page.request.get(SETTINGS))).autoChannel).toBe("sms");
    await expect(page.getByTestId("select-auto-channel")).toContainText("Send by text message");
    await chooseOption(page, page.getByTestId("select-auto-channel"), /Send by WhatsApp/);
    await expect.poll(async () => (await dataOf<{ autoChannel: string }>(await page.request.get(SETTINGS))).autoChannel).toBe("whatsapp");
  });

  test("the on/off switch lives on the card: it turns the type off and on, and a type with no text message cannot be switched on", async ({ page }) => {
    const agency = await seedDealsAgency();
    await connectFakeWhatsapp(agency.orgId);
    await switchOn(agency.orgId, "on_booking_create", "booking_confirmation");
    await saveAutoTemplate(agency.orgId, "booking_confirmation", { templateName: "booking_confirmed", variables: { "1": { source: "client_first_name" }, "2": { source: "destination" } } });
    await openIntegrations(page, agency.adminEmail);

    const status = page.getByTestId("auto-booking_confirmation-status");
    await expect(status).toHaveAttribute("data-state", "ready");
    const toggle = page.getByTestId("auto-booking_confirmation-switch");
    await toggle.click();
    await expect(status).toHaveAttribute("data-state", "off");
    expect(await queryRows(`select 1 from sms_templates where org_id = $1 and auto_trigger = 'on_booking_create' and active`, [agency.orgId])).toHaveLength(0);
    await toggle.click();
    await expect(status).toHaveAttribute("data-state", "ready");

    // Portal ready has no text message to switch on: a plain explanation, and nothing is created.
    await page.getByTestId("auto-portal_ready-switch").click();
    await expectToast(page, "There is no text message for this type yet");
    expect(await queryRows(`select 1 from sms_templates where org_id = $1 and auto_trigger = 'on_pin_set'`, [agency.orgId])).toHaveLength(0);
  });

  test("an agent cannot switch a customer message on through the text templates or the switch endpoint", async ({ request }) => {
    const agency = await seedDealsAgency();
    await expectLoginOk(request, agency.agentEmail);
    const created = await request.post("/api/v2/sms/templates", { data: { name: "x", body: "y", category: "booking_confirmation", autoTrigger: "on_booking_create", active: true } });
    expect(created.status()).toBe(403);
    expect(await queryRows(`select 1 from sms_templates where org_id = $1 and auto_trigger = 'on_booking_create'`, [agency.orgId])).toHaveLength(0);
    expect((await request.put("/api/v2/customer-messaging/switch/booking_confirmation", { data: { active: true } })).status()).toBe(403);
  });

  test("readiness says why a type is not being sent when WhatsApp is not connected", async ({ page }) => {
    const agency = await seedDealsAgency();
    await switchOn(agency.orgId, "on_booking_create", "booking_confirmation");
    await signIn(page, agency.adminEmail);
    // No workspace for this agency: the Integrations page says so before it shows anything else.
    const readiness = await dataOf<{ autoChannel: string; purposes: { purpose: string; ready: boolean; reason: string | null }[] }>(await page.request.get(READINESS));
    expect(readiness.autoChannel).toBe("whatsapp");
    expect(readiness.purposes.find((p) => p.purpose === "booking_confirmation")).toMatchObject({ ready: false, reason: "not_connected" });
    expect(readiness.purposes.find((p) => p.purpose === "portal_ready")).toMatchObject({ ready: false, reason: "switched_off" });
  });

  test("an agent cannot see the section or call the endpoints; neither can a homeworker", async ({ page, request }) => {
    const agency = await seedDealsAgency();
    const homeworker = await seedHomeworker(agency.orgId);

    await signIn(page, agency.agentEmail);
    await page.goto("/agency/integrations");
    await page.waitForLoadState("load");
    await expect(page.getByTestId("integrations-auto-messages")).toHaveCount(0);

    const body = { templateName: null, templateLanguage: null, channelId: null, variables: {} };
    for (const who of ["agent", "homeworker"]) {
      const email = who === "agent" ? agency.agentEmail : homeworker.email;
      await expectLoginOk(request, email);
      expect((await request.get(SETTINGS)).status(), `${who} GET settings`).toBe(403);
      expect((await request.put(SETTINGS, { data: { autoChannel: "sms" } })).status(), `${who} PUT settings`).toBe(403);
      expect((await request.get(READINESS)).status(), `${who} GET readiness`).toBe(403);
      expect((await request.get(TEMPLATE("booking_confirmation"))).status(), `${who} GET template`).toBe(403);
      expect((await request.put(TEMPLATE("booking_confirmation"), { data: body })).status(), `${who} PUT template`).toBe(403);
    }
    // The agent's refused attempt changed nothing.
    const [org] = await queryRows<{ settings: Record<string, unknown> | null }>(`select settings from organization where id = $1`, [agency.orgId]);
    expect(org.settings?.messaging).toBeUndefined();
  });

  test("a manager of one agency cannot change another agency's channel or templates", async ({ request }) => {
    const a = await seedDealsAgency();
    const b = await seedDealsAgency();
    await expectLoginOk(request, a.adminEmail);
    expect((await request.put(SETTINGS, { data: { autoChannel: "sms" } })).status()).toBe(200);
    const [orgB] = await queryRows<{ settings: Record<string, unknown> | null }>(`select settings from organization where id = $1`, [b.orgId]);
    expect(orgB.settings?.messaging).toBeUndefined();
    await expectLoginOk(request, b.adminEmail);
    expect((await dataOf<{ autoChannel: string }>(await request.get(SETTINGS))).autoChannel).toBe("whatsapp");
  });

  test("the settings endpoint validates, and the general settings save cannot overwrite the channel", async ({ request }) => {
    const agency = await seedDealsAgency();
    await expectLoginOk(request, agency.adminEmail);
    expect((await request.put(SETTINGS, { data: { autoChannel: "carrier-pigeon" } })).status()).toBe(400);
    expect((await request.put(SETTINGS, { data: { autoChannel: "sms" } })).status()).toBe(200);
    // The agency profile screen saves general settings: a stale copy must not undo the choice.
    const patch = await request.patch("/api/v2/organizations/me", { data: { settings: { messaging: { autoChannel: "whatsapp" }, currency: "GBP" } } });
    expect(patch.status(), await patch.text()).toBeLessThan(300);
    expect((await dataOf<{ autoChannel: string }>(await request.get(SETTINGS))).autoChannel).toBe("sms");
    // Money has no place in a message template, and the portal link is required for "portal ready".
    const bad = (variables: unknown) => ({ templateName: "portal_ready_msg", templateLanguage: "en_GB", channelId: "fake-wa-channel", variables });
    expect((await request.put(TEMPLATE("balance_reminder"), { data: bad({ "1": { source: "balance_due" } }) })).status()).toBe(400);
    expect((await request.put(TEMPLATE("portal_ready"), { data: bad({ "1": { source: "client_first_name" } }) })).status()).toBe(400);
  });
});

test.describe("a booking is confirmed by the agency's channel", () => {
  test("WhatsApp ready (the default): exactly one template send to the customer's number, zero SMS", async ({ page }) => {
    const agency = await readyAgency();
    await fakeProviders.armConnexa(); // so a stray text would really be accepted, and counted
    const client = await book(page, agency);

    const [row] = await waitForLog(client.id);
    expect(row).toMatchObject({ purpose: "booking_confirmation", channel: "whatsapp", status: "sent", reason: null, template_name: "booking_confirmed" });
    await settle(page);

    const sends = await fakeProviders.templateSends();
    expect(sends).toHaveLength(1);
    expect(sends[0].templateName).toBe("booking_confirmed");
    expect(sends[0].body).toMatchObject({ whatsapp_id: PHONE_DIGITS, channel_id: "fake-wa-channel", language: "en_GB" });
    expect(sends[0].body.variable_values?.["1"]).toBe(client.firstName);
    expect((sends[0].body.variable_values?.["2"] ?? "").length).toBeGreaterThan(0);
    expect(sends[0].body.contact_id).toBeUndefined();
    expect(await fakeProviders.sms()).toHaveLength(0);
    expect(await fakeProviders.textMessages()).toHaveLength(0);
    expect(await queryRows(`select 1 from sms_messages where client_id = $1`, [client.id])).toHaveLength(0);
    expect(await logRows(client.id)).toHaveLength(1); // and it stays one
  });

  test("two bookings for one customer within five minutes each get their own confirmation, about their own booking", async ({ page }) => {
    const agency = await readyAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request, { phoneNumber: PHONE });
    for (const ref of ["HAY-1111111", "HAY-2222222"]) {
      const deal = await apiCreateQuoteDeal(page.request, agency, client.id, userId);
      const res = await page.request.post(`/api/v2/bookings/convert/${deal.quoteId}`, { data: { haysRef: ref, supplierRef: "TUI 1" } });
      expect(res.status(), await res.text()).toBe(201);
    }
    await expect.poll(async () => (await fakeProviders.templateSends()).length, { timeout: 20_000 }).toBe(2);
    await settle(page);
    expect(await fakeProviders.templateSends()).toHaveLength(2);
    expect((await logRows(client.id)).filter((r) => r.status === "sent")).toHaveLength(2);
    const keys = await queryRows<{ dedupe_key: string }>(`select dedupe_key from customer_message_log where client_id = $1`, [client.id]);
    expect(new Set(keys.map((k) => k.dedupe_key)).size).toBe(2); // a different key per booking
    expect(await fakeProviders.sms()).toHaveLength(0);
  });

  test("no template chosen: nothing goes to either provider, the skip is logged, and the page shows the red warning", async ({ page }) => {
    const agency = await seedDealsAgency();
    await connectFakeWhatsapp(agency.orgId);
    await switchOn(agency.orgId, "on_booking_create", "booking_confirmation");
    await fakeProviders.armConnexa();
    const client = await book(page, agency);

    const [row] = await waitForLog(client.id);
    expect(row).toMatchObject({ channel: "whatsapp", status: "skipped", reason: "no_template" });
    await settle(page);
    expect(await fakeProviders.templateSends()).toHaveLength(0);
    expect(await fakeProviders.sms()).toHaveLength(0);
    expect(await queryRows(`select 1 from sms_messages where client_id = $1`, [client.id])).toHaveLength(0);

    await openIntegrations(page, agency.adminEmail);
    const status = page.getByTestId("auto-booking_confirmation-status");
    await expect(status).toHaveAttribute("data-state", "not-sent");
    await expect(status).toContainText("Not being sent: no template chosen");
  });

  test("WhatsApp not connected: nothing is sent, and it does not fall back to SMS", async ({ page }) => {
    const agency = await seedDealsAgency();
    await switchOn(agency.orgId, "on_booking_create", "booking_confirmation");
    await saveAutoTemplate(agency.orgId, "booking_confirmation", { templateName: "booking_confirmed", variables: { "1": { source: "client_first_name" } } });
    await fakeProviders.armConnexa();
    const client = await book(page, agency);

    const [row] = await waitForLog(client.id);
    expect(row).toMatchObject({ channel: "whatsapp", status: "skipped", reason: "not_connected" });
    await settle(page);
    expect(await fakeProviders.calls()).toEqual([]);
  });

  test("the provider rejects the template: nothing else is tried", async ({ page }) => {
    const agency = await readyAgency();
    await fakeProviders.armConnexa();
    await fakeProviders.configure({ templateSendFails: true });
    const client = await book(page, agency);

    const [row] = await waitForLog(client.id);
    expect(row).toMatchObject({ channel: "whatsapp", status: "skipped", reason: "send_failed" });
    await settle(page);
    expect(await fakeProviders.templateSends()).toHaveLength(1);
    expect(await fakeProviders.sms()).toHaveLength(0);
  });

  test("the SMS setting: exactly one SMS to the customer's number, zero WhatsApp", async ({ page, request }) => {
    const agency = await readyAgency();
    await fakeProviders.armConnexa();
    await expectLoginOk(request, agency.adminEmail);
    expect((await request.put(SETTINGS, { data: { autoChannel: "sms" } })).status()).toBe(200);
    const client = await book(page, agency);

    const [row] = await waitForLog(client.id);
    expect(row).toMatchObject({ purpose: "booking_confirmation", channel: "sms", status: "sent" });
    await settle(page);

    const texts = await fakeProviders.sms();
    expect(texts).toHaveLength(1);
    expect(texts[0].to).toBe(PHONE_DIGITS);
    expect(texts[0].message).toContain("HAY-1234567");
    expect(await fakeProviders.templateSends()).toHaveLength(0);
    expect(await fakeProviders.textMessages()).toHaveLength(0);
    expect(await queryRows(`select 1 from sms_messages where client_id = $1 and status = 'sent'`, [client.id])).toHaveLength(1);
  });

  test("the SMS setting with the provider refusing: nothing falls back to WhatsApp", async ({ page }) => {
    const agency = await readyAgency();
    await setStoredChannel(agency.orgId, "sms"); // Connexa stays disarmed: it refuses the login
    const client = await book(page, agency);

    const [row] = await waitForLog(client.id);
    expect(row).toMatchObject({ channel: "sms", status: "skipped", reason: "send_failed" });
    await settle(page);
    expect(await fakeProviders.templateSends()).toHaveLength(0);
    expect(await queryRows(`select status from sms_messages where client_id = $1`, [client.id])).toEqual([{ status: "failed" }]);
  });

  test("an opted-out customer gets nothing on either channel", async ({ page }) => {
    const agency = await readyAgency();
    await fakeProviders.armConnexa();
    const userId = await signIn(page, agency.agentEmail);

    for (const channel of ["whatsapp", "sms"] as const) {
      await setStoredChannel(agency.orgId, channel);
      const client = await apiCreateClient(page.request, { phoneNumber: PHONE });
      await optOut(client.id);
      const deal = await apiCreateQuoteDeal(page.request, agency, client.id, userId);
      const res = await page.request.post(`/api/v2/bookings/convert/${deal.quoteId}`, { data: { haysRef: "HAY-1234567", supplierRef: "TUI 1" } });
      expect(res.status(), await res.text()).toBe(201);
      const [row] = await waitForLog(client.id);
      expect(row).toMatchObject({ channel, status: "skipped", reason: "opted_out" });
    }
    await settle(page);
    expect(await fakeProviders.templateSends()).toHaveLength(0);
    expect(await fakeProviders.sms()).toHaveLength(0);
  });

  test("a customer with no phone number gets nothing", async ({ page }) => {
    const agency = await readyAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request, { phoneNumber: PHONE });
    await queryRows(`update client_table set "phoneNumber" = '' where id = $1`, [client.id]);
    const deal = await apiCreateQuoteDeal(page.request, agency, client.id, userId);
    const res = await page.request.post(`/api/v2/bookings/convert/${deal.quoteId}`, { data: { haysRef: "HAY-1234567", supplierRef: "TUI 1" } });
    expect(res.status(), await res.text()).toBe(201);
    const [row] = await waitForLog(client.id);
    expect(row).toMatchObject({ status: "skipped", reason: "no_phone" });
    await settle(page);
    expect(await fakeProviders.calls()).toEqual([]);
  });

  test("the message type switched off sends nothing and writes no log row", async ({ page }) => {
    const agency = await seedDealsAgency();
    await connectFakeWhatsapp(agency.orgId);
    await saveAutoTemplate(agency.orgId, "booking_confirmation", { templateName: "booking_confirmed", variables: { "1": { source: "client_first_name" } } });
    const client = await book(page, agency);
    await settle(page);
    expect(await fakeProviders.calls()).toEqual([]);
    expect(await logRows(client.id)).toHaveLength(0);
  });
});

test.describe("Forgotten your PIN? follows the agency's channel", () => {
  const reset = (request: import("@playwright/test").APIRequestContext, email: string, org: string) => request.post("/api/v2/portal/pin-reset", { data: { email, org } });

  test("on the SMS setting: one SMS with the link, even to an opted-out customer, and the same reply", async ({ request }) => {
    const customer = await seedPortalCustomer();
    await setStoredChannel(customer.orgId, "sms");
    await optOut(customer.clientId); // they asked for this one
    await fakeProviders.armConnexa();

    const real = await reset(request, customer.email, customer.slug);
    const ghost = await reset(request, `ghost-${customer.slug}@e2e.test`, customer.slug);
    expect(real.status()).toBe(ghost.status());
    expect(await real.text()).toBe(await ghost.text());

    await expect.poll(async () => (await fakeProviders.sms()).length, { timeout: 20_000 }).toBe(1);
    await expect.poll(async () => (await logRows(customer.clientId)).length).toBe(1);
    const texts = await fakeProviders.sms();
    expect(texts[0].to).toBe(PHONE_DIGITS);
    expect(texts[0].message).toContain("/portal/login?mt=");
    expect(await logRows(customer.clientId)).toEqual([expect.objectContaining({ purpose: "portal_sign_in", channel: "sms", status: "sent" })]);
    expect(await fakeProviders.templateSends()).toHaveLength(0);
    expect(await queryRows(`select 1 from portal_login_tokens where client_id = $1 and source = 'pin_reset'`, [customer.clientId])).toHaveLength(1);
    // Staff can read the sent-messages log: it keeps no live sign-in code, while the text that was sent had one.
    const sentCode = /mt=([^&\s]+)/.exec(texts[0].message)?.[1] ?? "";
    expect(sentCode.length).toBeGreaterThan(5);
    const [stored] = await queryRows<{ body: string }>(`select body from sms_messages where client_id = $1`, [customer.clientId]);
    expect(stored.body).toContain("mt=[redacted]");
    expect(stored.body).not.toContain(sentCode);
    expect(JSON.stringify(await logRows(customer.clientId))).not.toContain(sentCode);
  });

  test("on the SMS setting the per-email cap of 3 still holds", async ({ request }) => {
    const customer = await seedPortalCustomer();
    await setStoredChannel(customer.orgId, "sms");
    await fakeProviders.armConnexa();
    for (let i = 0; i < 4; i++) {
      expect((await reset(request, customer.email, customer.slug)).status()).toBe(200);
      await expect.poll(async () => (await logRows(customer.clientId)).length, { timeout: 20_000 }).toBeGreaterThanOrEqual(Math.min(i + 1, 3));
    }
    await expect.poll(async () => (await fakeProviders.sms()).length).toBe(3);
    await new Promise((r) => setTimeout(r, 1_500));
    expect(await fakeProviders.sms()).toHaveLength(3);
  });

  test("on the default WhatsApp setting with no workspace: nothing is sent to anyone, and it is logged", async ({ request }) => {
    const customer = await seedPortalCustomer();
    await fakeProviders.armConnexa();
    expect((await reset(request, customer.email, customer.slug)).status()).toBe(200);
    await expect.poll(async () => (await logRows(customer.clientId)).length, { timeout: 20_000 }).toBe(1);
    expect(await logRows(customer.clientId)).toEqual([expect.objectContaining({ purpose: "portal_sign_in", channel: "whatsapp", status: "skipped", reason: "not_connected" })]);
    expect(await fakeProviders.calls()).toEqual([]);
    expect(await queryRows(`select 1 from portal_login_tokens where client_id = $1 and source = 'pin_reset'`, [customer.clientId])).toHaveLength(0);
  });
});

test.describe("other roles in the agency are unaffected", () => {
  test("a branch manager can read the readiness (managers share the rule)", async ({ request }) => {
    const agency = await seedDealsAgency();
    const manager = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "branch_manager" });
    await expectLoginOk(request, manager.email);
    expect((await request.get(READINESS)).status()).toBe(200);
  });
});
