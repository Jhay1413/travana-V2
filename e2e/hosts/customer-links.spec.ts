/**
 * Two-host run: every link a customer is given points at the portal host, never the staff host. Both providers are the
 * loopback fakes (helpers/fake-providers.ts), so nothing leaves this machine.
 *
 *  - the quote link in the share dialog (what staff copy or send)
 *  - the quote text a staff member sends by SMS
 *  - the sign-in link a staff member sends by SMS, which also opens signed in on the portal host
 */
import { apiCreateClient, apiCreateQuoteDeal, dataOf, openHoliday, signIn } from "../helpers/deals";
import { PORTAL_ORIGIN } from "../helpers/env";
import { fakeProviders } from "../helpers/fake-providers";
import { expect, test } from "../helpers/fixtures";
import { addInterest } from "../helpers/portal";
import { queryRows, seedDealsAgency } from "../helpers/seed";

const SEND = "/api/v2/customer-messaging/send";

test.beforeEach(async () => {
  await fakeProviders.reset();
  await fakeProviders.armConnexa();
});

test.describe("customer links carry the portal origin", () => {
  test("the quote link shown in the share dialog is on the portal host, and the public quote SMS carries the same", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request, { phoneNumber: "07700900123" });
    const deal = await apiCreateQuoteDeal(page.request, agency, client.id, userId);
    await openHoliday(page, client.id, "quote", deal.quoteId);
    await page.getByTestId("holiday-top-share").click();
    await expect(page.getByTestId("dialog-share-quote")).toBeVisible();

    const link = await page.getByTestId("input-share-link").inputValue();
    expect(link).toMatch(new RegExp(`^${PORTAL_ORIGIN}/view-quote/[A-Za-z0-9]+$`));

    const result = await dataOf<{ status: string }>(await page.request.post(SEND, { data: { clientId: client.id, purpose: "quote_link", channel: "sms", quoteId: deal.quoteId } }));
    expect(result.status).toBe("sent");
    const [sms] = await fakeProviders.sms();
    expect(sms.message).toContain(link);
    expect(sms.message).not.toContain("http://localhost:5057/");
  });

  test("a staff-sent sign-in link is on the portal host and opens signed in there, once", async ({ page, context }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request, { phoneNumber: "07700900123" });
    await addInterest(client.id);

    const result = await dataOf<{ status: string }>(await page.request.post(SEND, { data: { clientId: client.id, purpose: "portal_sign_in", channel: "sms" } }));
    expect(result.status).toBe("sent");
    const [sms] = await fakeProviders.sms();
    const link = /https?:\/\/\S+\/portal\/login\?mt=\S+/.exec(sms.message)?.[0] ?? "";
    expect(link.startsWith(`${PORTAL_ORIGIN}/portal/login?mt=`)).toBe(true);

    // The customer's own browser (no staff session) opens it.
    const customer = await context.browser()!.newContext();
    const page2 = await customer.newPage();
    await page2.addInitScript(() => localStorage.setItem("portal_setup_wizard_done", "1"));
    await page2.goto(link);
    await page2.waitForURL((u) => u.origin === PORTAL_ORIGIN && u.pathname.startsWith("/portal") && !u.pathname.startsWith("/portal/login"));
    expect(page2.url()).not.toContain("mt=");
    expect(await page2.evaluate(() => localStorage.getItem("portal_token"))).toBeTruthy();
    await customer.close();

    expect(await queryRows(`select 1 from portal_login_tokens where client_id = $1 and used = true`, [client.id])).toHaveLength(1);
  });
});
