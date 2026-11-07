/**
 * Three stakeholder fixes (6 Nov): choosing a destination fills in its country on the quote form, the passenger card on the
 * client page shows passport number and expiry on one line, and Add task on the client page can hand the task to a colleague.
 */
import { apiCreateClient, signIn } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { boardWorld } from "../helpers/pipeline";
import { queryRows, seedDealsAgency } from "../helpers/seed";
import { chooseOption, chooseSearchable } from "../helpers/ui";
import { workWorld } from "../helpers/work";

test.describe("client page fixes", () => {
  test("picking a destination on the quote form fills in the country, and an already-correct country is kept", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    await page.goto(`/clients/${client.id}`);
    await page.getByTestId("client-index-create").click();
    await page.getByTestId("client-index-create-quote").click();
    const drawer = page.getByTestId("quote-create-drawer");
    await expect(drawer).toBeVisible();

    // No country chosen first: the destination brings it.
    await expect(drawer.getByRole("combobox").filter({ hasText: "Select country" })).toBeVisible();
    await chooseSearchable(page, drawer.getByRole("combobox").filter({ hasText: "Search destinations" }), "Majorca");
    await expect(drawer.getByRole("combobox").filter({ hasText: "Spain" })).toBeVisible();
    await expect(drawer.getByRole("combobox").filter({ hasText: "Select country" })).toHaveCount(0);
  });

  test("the passenger card shows Passport number and Passport expiry side by side on one line", async ({ page }) => {
    const w = await boardWorld(page);
    await page.goto(`/clients/${w.clientId}`);
    const lead = page.getByTestId("passenger-card-lead");
    await expect(lead).toBeVisible();
    const row = lead.getByTestId("passenger-passport-row");
    await expect(row).toContainText("Passport number");
    await expect(row).toContainText("Passport expiry");
    const number = await row.getByText("Passport number").boundingBox();
    const expiry = await row.getByText("Passport expiry").boundingBox();
    expect(number && expiry).toBeTruthy();
    expect(Math.abs(number!.y - expiry!.y)).toBeLessThan(2);
    expect(expiry!.x).toBeGreaterThan(number!.x);
  });

  test("Add task on the client page can be given to a colleague picked from Assign to, and the task is saved to them", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const client = await apiCreateClient(page.request);
    await page.goto(`/clients/${client.id}`);
    await page.getByTestId("client-index-add-task").click();
    const modal = page.getByTestId("add-task-modal");
    await expect(modal).toBeVisible();
    await chooseOption(page, modal.getByTestId("add-task-type"), "Enquiry call");

    await modal.getByTestId("add-task-assignee").click();
    await page.getByRole("option", { name: /Bea Agentb/ }).click();
    await expect(modal.getByTestId("add-task-assignee")).toContainText("Bea Agentb");
    await modal.getByTestId("add-task-submit").click();
    await expect(modal).toBeHidden();

    await expect.poll(async () => (await queryRows(`select 1 from tasks where entity_id = $1`, [client.id])).length).toBe(1);
    const [t] = await queryRows<{ user_id: string }>(`select user_id from tasks where entity_id = $1`, [client.id]);
    expect(t.user_id).toBe(w.agentB.id);
  });
});
