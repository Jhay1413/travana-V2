import type { Page } from "@playwright/test";
import { apiCreateClient, apiCreateQuoteDeal, dataOf, openHoliday, signIn } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { fakeProviders } from "../helpers/fake-providers";
import { connectFakeWhatsapp, disconnectAll, logRows, optOut, saveQuoteTemplate, savePinResetTemplate, switchOn } from "../helpers/messaging";
import { addInterest } from "../helpers/portal";
import { queryRows, seedDealsAgency, seedHomeworker, type DealsAgency } from "../helpers/seed";

/**
 * Staff-pressed sends with a "Send by" choice (quote link, portal sign-in link), the "Messages sent" history on the client
 * page, and the 48-hour single-use sign-in link. Both providers are the loopback fakes (helpers/fake-providers.ts), so nothing
 * leaves this machine and every call is counted: "exactly one template send, zero SMS".
 *
 * Every customer stays reachable: WhatsApp is offered whenever the customer has a phone, and when it cannot go through the
 * agency's inbox (homeworker, no integration) the staff member gets an "Open in WhatsApp" (wa.me) button instead.
 */

const AVAILABILITY = "/api/v2/customer-messaging/availability";
const SEND = "/api/v2/customer-messaging/send";
const LOG = "/api/v2/customer-messaging/log";

/** No fixed agency name ever reaches a customer, whichever tenant sends. */
const NO_FIXED_NAME = /Tina|Travana/i;

test.beforeEach(async () => {
  await fakeProviders.reset();
  await fakeProviders.armConnexa();
});
test.afterAll(async () => {
  await disconnectAll();
});

/** An agency whose WhatsApp is connected with a quote template and a sign-in template. */
async function whatsappAgency(): Promise<DealsAgency> {
  const agency = await seedDealsAgency();
  await connectFakeWhatsapp(agency.orgId);
  await saveQuoteTemplate(agency.orgId);
  await savePinResetTemplate(agency.orgId);
  return agency;
}

async function sendsevenCalls(): Promise<number> {
  return (await fakeProviders.calls()).filter((c) => c.provider === "sendseven" && c.method === "POST").length;
}

/** Opens the share dialog of a fresh quote for a new client of the given staff member (the agent by default). */
async function openShareDialog(page: Page, agency: DealsAgency, email: string = agency.agentEmail): Promise<{ clientId: string; quoteId: string }> {
  const userId = await signIn(page, email);
  const client = await apiCreateClient(page.request, { phoneNumber: "07700900123" });
  const deal = await apiCreateQuoteDeal(page.request, agency, client.id, userId);
  await openHoliday(page, client.id, "quote", deal.quoteId);
  await page.getByTestId("holiday-top-share").click();
  await expect(page.getByTestId("dialog-share-quote")).toBeVisible();
  return { clientId: client.id, quoteId: deal.quoteId };
}

async function openPortalPanel(page: Page, clientId: string): Promise<void> {
  await page.goto(`/clients/${clientId}`);
  await page.getByTestId("client-side-tab-portal").click();
  await expect(page.getByTestId("portal-send-link-row")).toBeVisible();
}

/** The sign-in link a template send carried (placeholder 2), as a path the test browser can open. */
function linkFrom(send: { body: { variable_values?: Record<string, string> } }): string {
  const link = send.body.variable_values?.["2"] ?? "";
  expect(link).toContain("/portal/login?mt=");
  const url = new URL(link);
  return `${url.pathname}${url.search}`;
}

/** The text inside a wa.me button's address (the only place a hand-over message, and any link in it, may appear). */
function whatsappText(href: string | null): string {
  expect(href).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
  return decodeURIComponent((href as string).split("?text=")[1]);
}

test.describe("quote link: Send by WhatsApp or SMS", () => {
  test("by WhatsApp (template path) sends exactly one template and no SMS; switching to SMS sends exactly one SMS and no further WhatsApp", async ({ page }) => {
    const agency = await whatsappAgency();
    const { clientId } = await openShareDialog(page, agency);

    // The agency has not chosen a channel, so the choice starts on WhatsApp and both options work.
    await expect(page.getByTestId("send-by-whatsapp")).toBeEnabled();
    await expect(page.getByTestId("send-by-sms")).toBeEnabled();
    await expect(page.getByTestId("send-by-whatsapp")).toHaveAttribute("aria-checked", "true");

    await page.getByTestId("button-copy-share-link").click();
    await expect.poll(async () => (await fakeProviders.templateSends()).length).toBe(1);
    expect(await fakeProviders.sms()).toHaveLength(0);

    await page.getByTestId("send-by-sms").click();
    await expect(page.getByTestId("send-by-sms")).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("button-copy-share-link").click();
    await expect.poll(async () => (await fakeProviders.sms()).length).toBe(1);
    expect(await fakeProviders.templateSends()).toHaveLength(1);

    const sms = (await fakeProviders.sms())[0];
    expect(sms.to).toBe("447700900123");
    expect(sms.message).toContain("/view-quote/");
    // Signed with this customer's own agency (from data), never a fixed name.
    expect(sms.message).toContain(`- ${agency.orgName}`);
    expect(sms.message).not.toMatch(NO_FIXED_NAME);
    expect(JSON.stringify((await fakeProviders.templateSends())[0].body)).not.toMatch(NO_FIXED_NAME);

    // Both outcomes are in the history, by staff, with the template named for the WhatsApp one.
    await expect.poll(async () => (await logRows(clientId)).length).toBe(2);
    const rows = await logRows(clientId);
    expect(rows.map((r) => `${r.purpose}/${r.channel}/${r.status}/${r.trigger_source}`)).toEqual(["quote_link/whatsapp/sent/staff", "quote_link/sms/sent/staff"]);
    expect(rows[0].template_name).toBe("portal_ready_msg");
  });

  test("with the agency set to SMS the choice starts on SMS", async ({ page }) => {
    const agency = await whatsappAgency();
    await queryRows(`update organization set settings = coalesce(settings, '{}'::jsonb) || '{"messaging":{"autoChannel":"sms"}}'::jsonb where id = $1`, [agency.orgId]);
    await openShareDialog(page, agency);
    await expect(page.getByTestId("send-by-sms")).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("button-copy-share-link").click();
    await expect.poll(async () => (await fakeProviders.sms()).length).toBe(1);
    expect(await fakeProviders.templateSends()).toHaveLength(0);
    expect(await sendsevenCalls()).toBe(0);
  });

  test("WhatsApp not connected: the option stays available and says it opens WhatsApp on the device; Send hands over the wa.me button and sends nothing", async ({ page }) => {
    const agency = await seedDealsAgency();
    const { clientId } = await openShareDialog(page, agency);

    await expect(page.getByTestId("send-by-whatsapp")).toBeEnabled();
    await expect(page.getByTestId("send-by-note-whatsapp")).toContainText("Opens WhatsApp on your device");
    await expect(page.getByTestId("send-by-whatsapp")).toHaveAttribute("aria-checked", "true");

    await page.getByTestId("button-copy-share-link").click();
    await expect(page.getByTestId("whatsapp-fallback")).toBeVisible();
    const text = whatsappText(await page.getByTestId("link-open-in-whatsapp").getAttribute("href"));
    expect(text).toContain("/view-quote/");
    // The wa.me text carries the customer's own agency name, not a fixed one.
    expect(text).toContain(`- ${agency.orgName}`);
    expect(text).not.toMatch(NO_FIXED_NAME);
    expect(await fakeProviders.sms()).toHaveLength(0);
    expect(await sendsevenCalls()).toBe(0);
    await expect.poll(async () => (await logRows(clientId)).map((r) => `${r.channel}/${r.status}/${r.reason}`)).toEqual(["whatsapp/skipped/staff_fallback"]);

    // Switching to SMS is the staff member's own choice: exactly one SMS, still nothing on WhatsApp.
    await page.getByTestId("send-by-sms").click();
    await page.getByTestId("button-copy-share-link").click();
    await expect.poll(async () => (await fakeProviders.sms()).length).toBe(1);
    expect(await sendsevenCalls()).toBe(0);
  });

  test("a customer with no phone number: both options are disabled with the reason, Send is off and Copy link still works", async ({ page }) => {
    const agency = await whatsappAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request, { phoneNumber: "07700900123" });
    await queryRows(`update client_table set "phoneNumber" = '' where id = $1`, [client.id]);
    const deal = await apiCreateQuoteDeal(page.request, agency, client.id, userId);
    await openHoliday(page, client.id, "quote", deal.quoteId);
    await page.getByTestId("holiday-top-share").click();

    await expect(page.getByTestId("send-by-whatsapp")).toBeDisabled();
    await expect(page.getByTestId("send-by-sms")).toBeDisabled();
    await expect(page.getByTestId("send-by-reason-whatsapp")).toContainText("no phone number");
    await expect(page.getByTestId("send-by-reason-sms")).toContainText("no phone number");
    await expect(page.getByTestId("button-copy-share-link")).toBeDisabled();
    await expect(page.getByTestId("button-copy-link-only")).toBeEnabled();
    expect(await fakeProviders.sms()).toHaveLength(0);
    expect(await sendsevenCalls()).toBe(0);
  });

  test("a customer who opted out of texts: SMS is disabled with its reason and nothing is sent by SMS", async ({ page }) => {
    const agency = await whatsappAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request, { phoneNumber: "07700900123" });
    await optOut(client.id);
    const deal = await apiCreateQuoteDeal(page.request, agency, client.id, userId);
    await openHoliday(page, client.id, "quote", deal.quoteId);
    await page.getByTestId("holiday-top-share").click();

    await expect(page.getByTestId("send-by-sms")).toBeDisabled();
    await expect(page.getByTestId("send-by-reason-sms")).toContainText("opted out of text messages");
    await expect(page.getByTestId("send-by-whatsapp")).toHaveAttribute("aria-checked", "true");
  });

  test("a template that fails is not sent, shows the wa.me button, and sends no SMS", async ({ page }) => {
    const agency = await whatsappAgency();
    await fakeProviders.configure({ templateSendFails: true });
    const { clientId } = await openShareDialog(page, agency);
    await page.getByTestId("button-copy-share-link").click();
    await expect(page.getByTestId("whatsapp-fallback")).toBeVisible();
    await expect(page.getByTestId("link-open-in-whatsapp")).toBeVisible();
    expect(await fakeProviders.sms()).toHaveLength(0);
    await expect.poll(async () => (await logRows(clientId)).map((r) => `${r.channel}/${r.status}/${r.reason}`)).toEqual(["whatsapp/skipped/staff_fallback"]);
  });

  test("a homeworker always gets the wa.me hand-over for the quote link, with no SendSeven call", async ({ page }) => {
    const agency = await whatsappAgency();
    const hw = await seedHomeworker(agency.orgId);
    const { clientId } = await openShareDialog(page, agency, hw.email);

    await expect(page.getByTestId("send-by-whatsapp")).toBeEnabled();
    await expect(page.getByTestId("send-by-note-whatsapp")).toContainText("Opens WhatsApp on your device");
    await page.getByTestId("button-copy-share-link").click();
    await expect(page.getByTestId("whatsapp-fallback")).toBeVisible();
    const text = whatsappText(await page.getByTestId("link-open-in-whatsapp").getAttribute("href"));
    expect(text).toContain(`- ${agency.orgName}`);
    expect(text).not.toMatch(NO_FIXED_NAME);
    expect(await sendsevenCalls()).toBe(0);
    expect(await fakeProviders.sms()).toHaveLength(0);
    await expect.poll(async () => (await logRows(clientId)).map((r) => `${r.channel}/${r.status}/${r.reason}`)).toEqual(["whatsapp/skipped/staff_fallback"]);
  });

  test("a homeworker gets the wa.me hand-over for the sign-in link (link minted on Send, shown only inside the wa.me address); SMS still works", async ({ page }) => {
    const agency = await whatsappAgency();
    const hw = await seedHomeworker(agency.orgId);
    await signIn(page, hw.email);
    const client = await apiCreateClient(page.request, { phoneNumber: "07700900123" });

    await openPortalPanel(page, client.id);
    await expect(page.getByTestId("portal-send-by-whatsapp")).toBeEnabled();
    await expect(page.getByTestId("portal-send-by-note-whatsapp")).toContainText("Opens WhatsApp on your device");
    // Nothing is minted until Send is pressed.
    expect(await queryRows(`select 1 from portal_login_tokens where client_id = $1`, [client.id])).toHaveLength(0);

    await page.getByTestId("button-send-portal-link").click();
    await expect(page.getByTestId("portal-whatsapp-fallback")).toBeVisible();
    const text = whatsappText(await page.getByTestId("portal-whatsapp-fallback-open").getAttribute("href"));
    expect(text).toContain("/portal/login?mt=");
    expect(text).toContain("valid for 48 hours");
    expect(text).not.toMatch(NO_FIXED_NAME);
    // The raw link is nowhere on the page itself.
    expect(await page.locator("body").innerText()).not.toContain("mt=");
    expect(await queryRows(`select 1 from portal_login_tokens where client_id = $1`, [client.id])).toHaveLength(1);
    expect(await sendsevenCalls()).toBe(0);
    expect(await fakeProviders.sms()).toHaveLength(0);
    await expect.poll(async () => (await logRows(client.id)).map((r) => `${r.purpose}/${r.channel}/${r.status}/${r.reason}`)).toEqual(["portal_sign_in/whatsapp/skipped/staff_fallback"]);

    // A second press inside a minute is refused: no second link.
    const again = await page.request.post(SEND, { data: { clientId: client.id, purpose: "portal_sign_in", channel: "whatsapp" } });
    expect(again.status()).toBe(429);
    expect(await queryRows(`select 1 from portal_login_tokens where client_id = $1`, [client.id])).toHaveLength(1);

    // SMS stays available to a homeworker (for another customer: this one holds its one-minute sign-in claim).
    const other = await apiCreateClient(page.request, { phoneNumber: "07700900124" });
    await openPortalPanel(page, other.id);
    await page.getByTestId("portal-send-by-sms").click();
    await page.getByTestId("button-send-portal-link").click();
    await expect.poll(async () => (await fakeProviders.sms()).length).toBe(1);
    expect(await sendsevenCalls()).toBe(0);
  });
});

test.describe("portal sign-in link: Send by WhatsApp or SMS", () => {
  test("by WhatsApp: one template send carrying a 48-hour single-use link; the link signs the customer in once, then shows the expired message", async ({ page, context }) => {
    const agency = await whatsappAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request, { phoneNumber: "07700900123" });
    await addInterest(client.id);
    await openPortalPanel(page, client.id);

    await page.getByTestId("portal-send-by-whatsapp").click();
    await page.getByTestId("button-send-portal-link").click();
    await expect.poll(async () => (await fakeProviders.templateSends()).length).toBe(1);
    expect(await fakeProviders.sms()).toHaveLength(0);
    const link = linkFrom((await fakeProviders.templateSends())[0]);

    // The link lasts 48 hours (not the old 7 days, not the 60-minute reset).
    const [token] = await queryRows<{ hours: number }>(
      `select extract(epoch from (expires_at - now())) / 3600 as hours from portal_login_tokens where client_id = $1 order by created_at desc limit 1`,
      [client.id],
    );
    expect(Number(token.hours)).toBeGreaterThan(47.5);
    expect(Number(token.hours)).toBeLessThanOrEqual(48);

    // The customer taps it on their own device: signed in once...
    // A second tab in the same browser stands in for the customer's own device (the portal keeps its own token in local storage).
    const customer = await context.newPage();
    await customer.addInitScript(() => localStorage.setItem("portal_setup_wizard_done", "1"));
    await customer.goto(link);
    await expect(customer).toHaveURL(/\/portal(\?|$|\/(?!login))/);
    await expect(customer).not.toHaveURL(/mt=/);
    // ...and a second tap says what happened and what to do.
    await customer.goto(link);
    await expect(customer.getByTestId("text-error")).toHaveText("That link has expired or was already used. Ask your agent for a new one, or use Forgotten your PIN?");
    await customer.close();

    await expect.poll(async () => (await logRows(client.id)).map((r) => `${r.purpose}/${r.channel}/${r.status}/${r.trigger_source}`)).toEqual(["portal_sign_in/whatsapp/sent/staff"]);
  });

  test("an agency with no WhatsApp integration: Send hands over the wa.me button and the link inside it signs the customer in once", async ({ page, context }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request, { phoneNumber: "07700900123" });
    await addInterest(client.id);
    await openPortalPanel(page, client.id);
    await expect(page.getByTestId("portal-send-by-note-whatsapp")).toContainText("Opens WhatsApp on your device");

    await page.getByTestId("button-send-portal-link").click();
    await expect(page.getByTestId("portal-whatsapp-fallback")).toBeVisible();
    const text = whatsappText(await page.getByTestId("portal-whatsapp-fallback-open").getAttribute("href"));
    expect(await sendsevenCalls()).toBe(0);
    expect(await fakeProviders.sms()).toHaveLength(0);

    const url = new URL((text.match(/https?:\/\/\S+/) as RegExpMatchArray)[0]);
    const customer = await context.newPage();
    await customer.addInitScript(() => localStorage.setItem("portal_setup_wizard_done", "1"));
    await customer.goto(`${url.pathname}${url.search}`);
    await expect(customer).not.toHaveURL(/mt=/);
    await customer.goto(`${url.pathname}${url.search}`);
    await expect(customer.getByTestId("text-error")).toContainText("That link has expired or was already used");
    await customer.close();
  });

  test("by SMS the agency's own portal-login wording is used when it has the link placeholder; the built-in text (with its lifetime) otherwise", async ({ page }) => {
    const agency = await whatsappAgency();
    await switchOn(agency.orgId, "on_pin_set", "portal_login", "Hello {{first_name}}, sign in here: {{portal_link}} from {{company_name}}");
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request, { phoneNumber: "07700900123", firstName: "Cora" });
    await openPortalPanel(page, client.id);
    await page.getByTestId("portal-send-by-sms").click();
    await page.getByTestId("button-send-portal-link").click();
    await expect.poll(async () => (await fakeProviders.sms()).length).toBe(1);
    const message = (await fakeProviders.sms())[0].message;
    expect(message).toMatch(new RegExp(`^Hello Cora, sign in here: https?://\\S+/portal/login\\?mt=\\w+&next=%2Fportal from ${agency.orgName}$`));
    expect(message).not.toContain("48 hours");
    expect(message).not.toMatch(NO_FIXED_NAME);

    // The same agency with its wording switched off falls back to the built-in text.
    await queryRows(`update sms_templates set active = false where org_id = $1 and category = 'portal_login'`, [agency.orgId]);
    const other = await apiCreateClient(page.request, { phoneNumber: "07700900124" });
    await dataOf(await page.request.post(SEND, { data: { clientId: other.id, purpose: "portal_sign_in", channel: "sms" } }));
    const builtIn = (await fakeProviders.sms())[1].message;
    expect(builtIn).toContain("valid for 48 hours");
    expect(builtIn).not.toMatch(NO_FIXED_NAME);
  });

  test("by SMS the SEEDED Portal Login default is never used: the built-in text goes out, with no fixed agency name and no PIN promise", async ({ page }) => {
    const agency = await whatsappAgency();
    await switchOn(
      agency.orgId,
      "on_pin_set",
      "portal_login",
      "Hi {{first_name}}, your client portal is ready. Log in here: {{portal_link}} (use your email and the PIN we shared). - Tina's Travel",
    );
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request, { phoneNumber: "07700900123" });
    await openPortalPanel(page, client.id);
    await page.getByTestId("portal-send-by-sms").click();
    await page.getByTestId("button-send-portal-link").click();
    await expect.poll(async () => (await fakeProviders.sms()).length).toBe(1);
    const message = (await fakeProviders.sms())[0].message;
    expect(message).toContain("valid for 48 hours");
    expect(message).toContain(agency.orgName);
    expect(message).not.toMatch(NO_FIXED_NAME);
    expect(message).not.toContain("PIN we shared");
  });

  test("by SMS: one text with the link and its lifetime, no WhatsApp; a customer who opted out cannot be texted", async ({ page }) => {
    const agency = await whatsappAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request, { phoneNumber: "07700900123" });
    await openPortalPanel(page, client.id);

    await page.getByTestId("portal-send-by-sms").click();
    await page.getByTestId("button-send-portal-link").click();
    await expect.poll(async () => (await fakeProviders.sms()).length).toBe(1);
    const text = (await fakeProviders.sms())[0].message;
    expect(text).toContain("/portal/login?mt=");
    expect(text).toContain("valid for 48 hours");
    expect(text).not.toContain("1234");
    expect(text).not.toMatch(NO_FIXED_NAME);
    expect(await fakeProviders.templateSends()).toHaveLength(0);

    // Opted-out: refused at the API, nothing minted, nothing sent.
    const other = await apiCreateClient(page.request, { phoneNumber: "07700900124" });
    await optOut(other.id);
    const res = await page.request.post(SEND, { data: { clientId: other.id, purpose: "portal_sign_in", channel: "sms" } });
    const result = await dataOf<{ status: string; reason: string }>(res);
    expect(result).toMatchObject({ status: "not_sent", reason: "opted_out" });
    expect(await fakeProviders.sms()).toHaveLength(1);
    expect(await queryRows(`select 1 from portal_login_tokens where client_id = $1`, [other.id])).toHaveLength(0);
  });

  test("a customer with no PIN taps the link, chooses a PIN at the gate, signs out, and signs in with email and PIN; no default PIN was ever stored", async ({ page, context }) => {
    const agency = await whatsappAgency();
    await signIn(page, agency.agentEmail);
    const email = `nopin-${Date.now()}@e2e.test`;
    const client = await apiCreateClient(page.request, { phoneNumber: "07700900123", email });
    await addInterest(client.id);
    const [{ slug }] = await queryRows<{ slug: string }>(`select slug from organization where id = $1`, [agency.orgId]);

    await openPortalPanel(page, client.id);
    await expect(page.getByTestId("portal-pin-masked")).toHaveText("—");
    await page.getByTestId("portal-send-by-whatsapp").click();
    await page.getByTestId("button-send-portal-link").click();
    await expect.poll(async () => (await fakeProviders.templateSends()).length).toBe(1);
    const link = linkFrom((await fakeProviders.templateSends())[0]);

    // No PIN value was written; the customer is only flagged to choose one.
    const [state] = await queryRows<{ portal_pin: string | null; must_change_pin: boolean }>(`select portal_pin, must_change_pin from client_table where id = $1`, [client.id]);
    expect(state).toEqual({ portal_pin: null, must_change_pin: true });

    // A second tab in the same browser stands in for the customer's own device (the portal keeps its own token in local storage).
    const customer = await context.newPage();
    await customer.addInitScript(() => localStorage.setItem("portal_setup_wizard_done", "1"));
    await customer.goto(link);
    await expect(customer.getByTestId("text-set-pin-title")).toBeVisible();
    // The old default is never accepted.
    await customer.getByTestId("input-new-pin").fill("1234");
    await customer.getByTestId("input-confirm-pin").fill("1234");
    await customer.getByTestId("button-save-pin").click();
    await expect(customer.getByTestId("text-set-pin-error")).toBeVisible();
    await customer.getByTestId("input-new-pin").fill("9073");
    await customer.getByTestId("input-confirm-pin").fill("9073");
    await customer.getByTestId("button-save-pin").click();
    await expect(customer.getByTestId("text-set-pin-title")).toHaveCount(0);

    // Sign out (this device forgets them), then email + PIN works.
    await customer.evaluate(() => localStorage.clear());
    await customer.addInitScript(() => localStorage.setItem("portal_setup_wizard_done", "1"));
    await customer.goto(`/portal/login?org=${slug}`);
    await customer.getByTestId("input-email").fill(email);
    await customer.getByTestId("input-pin").fill("9073");
    await customer.getByTestId("button-login").click();
    await expect(customer).toHaveURL(/\/portal$/);
    const [after] = await queryRows<{ must_change_pin: boolean; has_pin: boolean }>(`select must_change_pin, portal_pin is not null as has_pin from client_table where id = $1`, [client.id]);
    expect(after).toEqual({ must_change_pin: false, has_pin: true });
    await customer.close();
  });
});

test.describe("Messages sent on the client page", () => {
  test("shows sent and not-sent rows, latest 5 with View all that pages", async ({ page }) => {
    const agency = await whatsappAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request, { phoneNumber: "07700900123" });

    // Nothing yet.
    await page.goto(`/clients/${client.id}`);
    await expect(page.getByTestId("messages-sent-empty")).toHaveText("No automatic messages yet");

    // One sent (by WhatsApp), then the customer opts out and 22 texts are refused: each leaves a "not sent" row.
    // The one sent row is written straight into the log (an hour old): a real send would hold this customer's one-minute
    // sign-in claim and the refused presses below would be refused for that instead.
    await queryRows(
      `insert into customer_message_log (org_id, client_id, purpose, channel, status, trigger_source, triggered_by, created_at)
       values ($1, $2, 'portal_sign_in', 'whatsapp', 'sent', 'staff', $3, now() - interval '1 hour')`,
      [agency.orgId, client.id, userId],
    );
    await optOut(client.id);
    for (let i = 0; i < 22; i++) {
      const res = await dataOf<{ status: string }>(await page.request.post(SEND, { data: { clientId: client.id, purpose: "portal_sign_in", channel: "sms" } }));
      expect(res.status).toBe("not_sent");
    }

    await page.reload();
    const lines = page.getByTestId("messages-sent-list").getByTestId("message-log-line");
    await expect(lines).toHaveCount(5);
    await expect(lines.first()).toContainText("Portal sign-in link · SMS · Not sent — customer opted out");

    await page.getByTestId("button-view-all-messages").click();
    const all = page.getByTestId("messages-sent-all").getByTestId("message-log-line");
    await expect(all).toHaveCount(20);
    await page.getByTestId("messages-sent-load-more").click();
    await expect(all).toHaveCount(23);
    await expect(page.getByTestId("messages-sent-load-more")).toHaveCount(0);
    await expect(all.last()).toContainText("Portal sign-in link · WhatsApp · Sent");
    // Who pressed send is shown, and no phone number or link appears anywhere in the sheet.
    await expect(page.getByTestId("messages-sent-sheet")).toContainText("by Ann Agent");
    const sheetText = (await page.getByTestId("messages-sent-sheet").innerText()) ?? "";
    expect(sheetText).not.toMatch(/07700|\+44|mt=|http/);
  });

  test("a fallback shows as not sent with its own reason, and the log endpoint's rows carry exactly the documented keys", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request, { phoneNumber: "07700900123" });
    await page.request.post(SEND, { data: { clientId: client.id, purpose: "portal_sign_in", channel: "whatsapp" } });
    const page1 = await dataOf<{ items: Record<string, unknown>[]; nextCursor: string | null; unavailable: boolean }>(await page.request.get(`${LOG}?clientId=${client.id}`));
    expect(page1.unavailable).toBe(false);
    expect(Object.keys(page1.items[0]).sort()).toEqual(["channel", "createdAt", "id", "purpose", "reason", "status", "templateName", "triggerSource", "triggeredByName"]);
    expect(page1.items[0]).toMatchObject({ status: "skipped", reason: "handed to the agent to send from their own WhatsApp" });
    expect(JSON.stringify(page1)).not.toContain("mt=");
  });
});

test.describe("another agency", () => {
  test("a staff member of another agency cannot read the history, see availability or send, and nothing is sent", async ({ page }) => {
    const mine = await whatsappAgency();
    await signIn(page, mine.agentEmail);
    const client = await apiCreateClient(page.request, { phoneNumber: "07700900123" });
    await page.request.post(SEND, { data: { clientId: client.id, purpose: "portal_sign_in", channel: "sms" } });
    await fakeProviders.reset();
    await fakeProviders.armConnexa();

    const other = await whatsappAgency();
    await signIn(page, other.agentEmail);
    expect((await page.request.get(`${LOG}?clientId=${client.id}`)).status()).toBe(404);
    expect((await page.request.get(`${AVAILABILITY}?clientId=${client.id}&purpose=portal_sign_in`)).status()).toBe(404);
    for (const channel of ["sms", "whatsapp"]) {
      expect((await page.request.post(SEND, { data: { clientId: client.id, purpose: "portal_sign_in", channel } })).status()).toBe(404);
    }
    expect(await fakeProviders.sms()).toHaveLength(0);
    expect(await sendsevenCalls()).toBe(0);
    expect(await queryRows(`select 1 from portal_login_tokens where client_id = $1`, [client.id])).toHaveLength(1);
  });

  test("the settings endpoints stay manager-only: an agent still cannot read them", async ({ page }) => {
    const agency = await whatsappAgency();
    await signIn(page, agency.agentEmail);
    expect((await page.request.get("/api/v2/customer-messaging/settings")).status()).toBe(403);
    expect((await page.request.get("/api/v2/customer-messaging/readiness")).status()).toBe(403);
  });
});

test.describe("sign-in link limits, hand-over scope and the share dialog's failure modes (written, not run: practice database unavailable)", () => {
  test("a new staff link retires the customer's older unused staff links, and a refused press mints nothing", async ({ page }) => {
    const agency = await whatsappAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request, { phoneNumber: "07700900123" });
    await queryRows(`insert into portal_login_tokens (code, client_id, expires_at, source) values ('OLDSTAFFCODE', $1, now() + interval '1 hour', 'staff')`, [client.id]);
    await queryRows(`insert into portal_login_tokens (code, client_id, expires_at, source) values ('OLDRESETCODE', $1, now() + interval '1 hour', 'pin_reset')`, [client.id]);

    const sent = await dataOf<{ status: string }>(await page.request.post(SEND, { data: { clientId: client.id, purpose: "portal_sign_in", channel: "sms" } }));
    expect(sent.status).toBe("sent");
    const rows = await queryRows<{ code: string; used: boolean }>(`select code, used from portal_login_tokens where client_id = $1`, [client.id]);
    expect(rows.find((r) => r.code === "OLDSTAFFCODE")?.used).toBe(true);
    // The customer's own reset link is untouched.
    expect(rows.find((r) => r.code === "OLDRESETCODE")?.used).toBe(false);
    expect(rows.filter((r) => !r.used && r.code !== "OLDRESETCODE")).toHaveLength(1);
  });

  test("ten staff links in 24 hours is the limit: the next press says why and mints nothing", async ({ page }) => {
    const agency = await whatsappAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request, { phoneNumber: "07700900123" });
    for (let i = 0; i < 10; i++) {
      await queryRows(`insert into portal_login_tokens (code, client_id, expires_at, source, used) values ($1, $2, now() + interval '1 hour', 'staff', true)`, [`CAP${i}XXXXXXXXX`.slice(0, 12), client.id]);
    }
    const result = await dataOf<{ status: string; reason: string; message: string }>(await page.request.post(SEND, { data: { clientId: client.id, purpose: "portal_sign_in", channel: "sms" } }));
    expect(result).toMatchObject({ status: "not_sent", reason: "capped", message: "Too many sign-in links were sent to this customer in the last 24 hours." });
    expect(await fakeProviders.sms()).toHaveLength(0);
    expect(await queryRows(`select 1 from portal_login_tokens where client_id = $1`, [client.id])).toHaveLength(10);
  });

  test("a hand-over made for one customer is not shown (or sendable) when the page moves to another customer", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const a = await apiCreateClient(page.request, { phoneNumber: "07700900123" });
    const b = await apiCreateClient(page.request, { phoneNumber: "07700900124" });
    await openPortalPanel(page, a.id);
    await page.getByTestId("button-send-portal-link").click();
    await expect(page.getByTestId("portal-whatsapp-fallback")).toBeVisible();

    // Move to customer B without reloading the app (the page component stays mounted).
    await page.evaluate((id) => {
      window.history.pushState({}, "", `/clients/${id}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, b.id);
    await expect(page).toHaveURL(new RegExp(b.id));
    await page.getByTestId("client-side-tab-portal").click();
    await expect(page.getByTestId("portal-send-link-row")).toBeVisible();
    await expect(page.getByTestId("portal-whatsapp-fallback")).toHaveCount(0);
  });

  test("the share dialog: when the availability check fails there is a short error with a retry, and Copy link is always offered", async ({ page }) => {
    const agency = await whatsappAgency();
    await page.route("**/api/v2/customer-messaging/availability**", (route) => route.abort());
    await openShareDialog(page, agency);
    await expect(page.getByTestId("send-by-error")).toContainText("Couldn't check which channels can be used");
    await expect(page.getByTestId("button-copy-share-link")).toBeDisabled();
    await expect(page.getByTestId("button-copy-link-only")).toBeEnabled();

    await page.unroute("**/api/v2/customer-messaging/availability**");
    await page.getByTestId("button-send-by-retry").click();
    await expect(page.getByTestId("send-by-error")).toHaveCount(0);
    await expect(page.getByTestId("button-copy-share-link")).toBeEnabled();
  });

  test("the sign-in template card tells managers it is used for both PIN resets and links their team sends", async ({ page }) => {
    const agency = await whatsappAgency();
    await signIn(page, agency.adminEmail);
    await page.goto("/agency/integrations");
    await expect(page.getByTestId("pin-reset-template-helper")).toHaveText("Used for both PIN resets and links your team sends. Don't state how long the link lasts in the template.", { timeout: 60_000 });
  });
});
