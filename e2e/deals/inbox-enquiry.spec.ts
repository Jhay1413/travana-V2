import type { Locator, Page } from "@playwright/test";
import { apiCreateClient, signIn } from "../helpers/deals";
import { expect, expectToast, test } from "../helpers/fixtures";
import { INBOX_CONVERSATION_ID, PACKAGE_INTENT, stubInbox, type StubbedIntent } from "../helpers/inbox";
import { queryRows, REF, seedDealsAgency } from "../helpers/seed";
import { chooseSearchable, expectChip } from "../helpers/ui";

/**
 * The inbox "Create enquiry from this chat" pop-up (InboxEnquiryDialog). The inbox data and the AI call are stubbed in
 * the browser (helpers/inbox.ts) so nothing reaches SendSeven or an AI service; the enquiry itself is saved for real.
 */

async function openInboxEnquiry(page: Page, intent: StubbedIntent | number): Promise<{ popup: Locator; aiCalls: string[]; clientId: string; agency: Awaited<ReturnType<typeof seedDealsAgency>> }> {
  const agency = await seedDealsAgency();
  await signIn(page, agency.agentEmail);
  const client = await apiCreateClient(page.request);
  const { aiCalls } = await stubInbox(page, { client, intent });
  await page.goto(`/conversations?conversation=${INBOX_CONVERSATION_ID}`);
  const generate = page.getByRole("button", { name: "Generate enquiry" });
  await expect(generate).toBeVisible();
  await generate.click();
  const popup = page.getByTestId("drawer-create-enquiry");
  await expect(popup).toBeVisible();
  return { popup, aiCalls, clientId: client.id, agency };
}

test.describe("inbox: create enquiry from this chat", () => {
  test("the AI's reading prefills the pop-up, and Create enquiry saves it against the linked client", async ({ page }) => {
    const { popup, aiCalls, clientId, agency } = await openInboxEnquiry(page, PACKAGE_INTENT);

    // Prefilled from the stubbed AI reading.
    await expect(popup.getByTestId("input-enquiry-title")).toHaveValue(PACKAGE_INTENT.enquiryTitle);
    await expectChip(popup.getByTestId("select-holiday-type"), "Package Holiday");
    await expect(popup.getByTestId("select-enquiry-destination")).toContainText("Majorca");
    await expect(popup.getByTestId("input-travel-date")).toContainText("10/07/2027");
    await expect(popup.getByTestId("input-adults")).toHaveValue("2");
    await expectChip(popup.getByTestId("select-star-rating"), "4 Star");
    await expectChip(popup.getByTestId("select-board-basis"), REF.boardBasis[0]);
    await expect(popup.getByTestId("input-budget")).toHaveValue("2500");
    await expect(popup.getByTestId("textarea-enquiry-notes")).toHaveValue("Quiet resort please");
    await expect(popup.getByTestId("select-lead-source")).toBeVisible();
    // Inbox primary is "Create enquiry"; Save & start quote is offered too.
    await expect(popup.getByTestId("button-create-enquiry")).toBeVisible();
    await expect(popup.getByTestId("button-save-start-quote")).toBeVisible();
    expect(aiCalls).toHaveLength(1);

    await popup.getByTestId("button-create-enquiry").click();
    await expect(page.getByTestId("drawer-create-enquiry")).toBeHidden();

    const [row] = await queryRows<Record<string, any>>(
      `select e.*, t.client_id from enquiry_table e join transaction t on t.id = e.transaction_id where t.client_id = $1`,
      [clientId],
    );
    expect(row).toBeTruthy();
    expect(row).toMatchObject({ client_id: clientId, holiday_type_id: agency.ref.packageType, travel_date: "2027-07-10", adults: 2, accom_min_star_rating: "4 Star" });
    expect(Number(row.budget)).toBe(2500);
    expect((await queryRows(`select 1 from enquiry_destination where enquiry_id = $1 and destination_id = $2`, [row.id, agency.ref.destination])).length).toBe(1);
  });

  test("Save & start quote from the inbox saves the enquiry, opens the quote pop-up prefilled, and saving it marks the enquiry Converted", async ({ page }) => {
    const { popup, clientId } = await openInboxEnquiry(page, PACKAGE_INTENT);
    await popup.getByTestId("button-save-start-quote").click();
    await expect(page.getByTestId("drawer-create-enquiry")).toBeHidden();

    const [enq] = await queryRows<{ id: string; transaction_id: string; status: string }>(
      `select e.id, e.transaction_id, e.status from enquiry_table e join transaction t on t.id = e.transaction_id where t.client_id = $1`,
      [clientId],
    );
    expect(enq.status).toBe("ACTIVE");

    const quote = page.getByTestId("convert-enquiry-drawer");
    await expect(quote).toBeVisible();
    await expect(quote.getByTestId("input-drawer-title")).toHaveValue(PACKAGE_INTENT.enquiryTitle);
    await expect(quote.getByLabel("Travel Date")).toContainText("10/07/2027");
    await expect(quote.getByLabel("Adults")).toHaveValue("2");
    await chooseSearchable(page, quote.getByRole("combobox").filter({ hasText: /Select operator|E2E /i }), REF.operator);
    await quote.getByTestId("drawer-costing-price").fill("2500");
    await quote.getByTestId("form-drawer-submit").click();
    await expectToast(page, "Enquiry converted to quote!");

    await expect
      .poll(async () => (await queryRows<{ status: string }>(`select status from enquiry_table where id = $1`, [enq.id]))[0]?.status)
      .toBe("Converted");
    await expect(page).toHaveURL(new RegExp(`/clients/${clientId}/quotes/`));
  });

  test("when the AI is unavailable the pop-up still opens empty so the agent can fill it by hand", async ({ page }) => {
    const { popup, aiCalls, clientId } = await openInboxEnquiry(page, 502);
    await expect(popup.getByTestId("input-enquiry-title")).toBeVisible();
    await expect(popup.getByTestId("input-enquiry-title")).toHaveValue("");
    expect(aiCalls).toHaveLength(1);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("drawer-create-enquiry")).toBeHidden();
    expect(await queryRows(`select 1 from transaction where client_id = $1`, [clientId])).toHaveLength(0);
  });
});
