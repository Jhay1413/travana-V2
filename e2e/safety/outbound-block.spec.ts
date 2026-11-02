import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { apiCreateClient, apiCreateQuoteDeal, dbBookingFor, signIn } from "../helpers/deals";
import { BROWSER_LOG, CANARY_FILE, OUTBOUND_LOG } from "../helpers/env";
import { expect, test } from "../helpers/fixtures";
import { readOutboundAttempts } from "../helpers/outbound-report";
import { countMessagingConfigRows, queryRows, seedDealsAgency, unique } from "../helpers/seed";

const root = fileURLToPath(new URL("../..", import.meta.url));

/**
 * Proves the server under test cannot send anything: the outbound block is loaded in the running
 * server, nothing in the database holds a messaging login, and a booking's SMS trigger (which fires
 * for real inside the server) ends as a failed row with no connection attempt.
 */
test.describe("outbound block", () => {
  test("the running server loaded the outbound block before the app, and the log has no refused connections", async () => {
    const serverLog = readFileSync(path.join(root, "test-results", "e2e-server.log"), "utf8");
    expect(serverLog).toContain("[e2e outbound block] active: only loopback connections are allowed");
    expect(readOutboundAttempts(OUTBOUND_LOG)).toEqual([]);
  });

  test("the canary connection made by the server at start-up was refused (the block really bites)", async () => {
    // The preload writes this after trying to reach 203.0.113.1 from inside the server process.
    await expect.poll(() => existsSync(CANARY_FILE), { timeout: 15_000 }).toBe(true);
    const canary = JSON.parse(readFileSync(CANARY_FILE, "utf8")) as { refused: boolean; code: string };
    expect(canary).toMatchObject({ refused: true, code: "E2E_OUTBOUND_BLOCKED" });
    // The canary is not a violation: it is in its own file, not in the logs the teardown fails on.
    expect(readOutboundAttempts(OUTBOUND_LOG)).toEqual([]);
    expect(readOutboundAttempts(BROWSER_LOG)).toEqual([]);
  });

  test("no SendSeven, WhatsApp or mailbox settings exist anywhere in the test database", async () => {
    expect(await countMessagingConfigRows()).toEqual({ sendseven_integrations: 0, org_whatsapp_settings: 0, email_accounts: 0, facebook_pages: 0 });
  });

  test("a booking conversion's SMS trigger runs in the server, is NOT delivered, and makes no outbound connection", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);

    // An active "on booking" SMS template for this agency, and a client who can be texted.
    const templateName = `E2E booked ${unique("t")}`;
    await queryRows(
      `insert into sms_templates (id, org_id, name, category, body, auto_trigger, active)
       values ($1, $2, $3, 'booking_confirmation', 'Hi {{first_name}}, your booking {{hays_ref}} is confirmed.', 'on_booking_create', true)`,
      [randomUUID(), agency.orgId, templateName],
    );
    const client = await apiCreateClient(page.request, { phoneNumber: "07700900123" });
    const deal = await apiCreateQuoteDeal(page.request, agency, client.id, userId);
    const attemptsBefore = readOutboundAttempts(OUTBOUND_LOG).length;

    const res = await page.request.post(`/api/v2/bookings/convert/${deal.quoteId}`, { data: { haysRef: "HAY-1234567", supplierRef: "TUI 1" } });
    expect(res.status(), await res.text()).toBe(201);
    expect(await dbBookingFor(deal.transactionId)).toBeTruthy();

    // The trigger is fire-and-forget inside the server: wait for its row.
    await expect
      .poll(async () => (await queryRows(`select 1 from sms_messages where client_id = $1`, [client.id])).length, { timeout: 20_000 })
      .toBeGreaterThan(0);

    const rows = await queryRows<{ status: string; provider_error: string | null; provider_message_id: string | null; template_name: string }>(
      `select status, provider_error, provider_message_id, template_name from sms_messages where client_id = $1`,
      [client.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].template_name).toBe(templateName);
    // Never sent or delivered; the send throws before any network call because no SMS login exists.
    expect(rows[0].status).toBe("failed");
    expect(rows[0].provider_message_id).toBeNull();
    expect(rows[0].provider_error).toMatch(/Connexa is not connected/);
    expect(await queryRows(`select 1 from sms_messages where client_id = $1 and status in ('sent', 'delivered')`, [client.id])).toHaveLength(0);

    // And the block saw nothing to refuse: no connection to any outside host was even attempted.
    expect(readOutboundAttempts(OUTBOUND_LOG).length).toBe(attemptsBefore);
    expect(readOutboundAttempts(OUTBOUND_LOG)).toEqual([]);
  });
});
