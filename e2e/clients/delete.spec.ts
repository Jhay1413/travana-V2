import { apiCreateClient, apiCreateEnquiry, dataOf, signIn } from "../helpers/deals";
import { expect, expectToast, test } from "../helpers/fixtures";
import { dbClient, seedDealsAgency } from "../helpers/seed";
import { card, openBoard } from "../helpers/pipeline";

test.describe("delete client (soft delete, admin only)", () => {
  test("admin deletes a client with a deal: gone from list, search and its page, the deal stays with the client name", async ({ page }) => {
    const agency = await seedDealsAgency();
    const adminId = await signIn(page, agency.adminEmail);
    const client = await apiCreateClient(page.request);
    const other = await apiCreateClient(page.request);
    const { transactionId } = await apiCreateEnquiry(page.request, agency, client.id, adminId);

    await page.goto(`/clients/${client.id}`);
    await expect(page.getByTestId("client-center-header")).toContainText(client.surename);
    await page.getByTestId("client-index-more").click();
    await page.getByTestId("client-index-button-delete").click();
    const dialog = page.getByTestId("dialog-delete-client");
    await expect(dialog).toContainText("Their deals stay in the Pipeline. The portal link stops working.");
    await page.getByTestId("button-delete-client-confirm").click();
    await expectToast(page, /deleted/i);
    await expect(page).toHaveURL(/\/clients$/);

    // Database: soft deleted, row still there.
    const row = await dbClient(client.id);
    expect(row?.deletedAt).toBeTruthy();
    expect(row?.deletedBy).toBe(adminId);

    // List: the other client is shown, the deleted one is not.
    await page.getByTestId("input-clients-list-search").fill(other.surename);
    await expect(page.getByTestId(`card-clients-list-${other.id}`)).toBeVisible();
    await page.getByTestId("input-clients-list-search").fill(client.surename);
    await expect(page.getByTestId("text-clients-list-count")).toBeVisible();
    await expect(page.getByTestId(`card-clients-list-${client.id}`)).toHaveCount(0);

    // Global search API and the client API.
    const found = await dataOf<{ clients: { id: string }[] }>(await page.request.get(`/api/v2/search?q=${client.surename}`));
    expect(found.clients.map((c) => c.id)).not.toContain(client.id);
    // Admins can still open the deleted client, read-only (banner shown).
    expect((await page.request.get(`/api/v2/neon-clients/${client.id}`)).status()).toBe(200);
    await page.goto(`/clients/${client.id}`);
    await expect(page.getByTestId("client-deleted-banner")).toBeVisible();

    // The deal stays on the pipeline, still showing the client's name.
    await openBoard(page);
    await expect(card(page, transactionId)).toContainText(client.surename);

    // A second delete is refused.
    const again = await page.request.delete(`/api/v2/neon-clients/${client.id}`);
    expect(again.status()).toBe(409);
  });

  test("an agent sees no Delete option and the API refuses with 403", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);

    await page.goto(`/clients/${client.id}`);
    await expect(page.getByTestId("client-center-header")).toContainText(client.surename);
    await page.getByTestId("client-index-more").click();
    await expect(page.getByTestId("client-index-button-merge")).toBeVisible();
    await expect(page.getByTestId("client-index-button-delete")).toHaveCount(0);

    for (const path of [`/api/v2/neon-clients/${client.id}`, `/api/v2/clients/${client.id}`]) {
      expect((await page.request.delete(path)).status(), path).toBe(403);
    }
    expect((await dbClient(client.id))?.deletedAt).toBeNull();
  });
});

test.describe("deleted client page (read-only for admins)", () => {
  test("an admin can open a deleted client read-only with a banner; an agent gets not found", async ({ page, browser }) => {
    const agency = await seedDealsAgency();
    const adminId = await signIn(page, agency.adminEmail);
    const client = await apiCreateClient(page.request);
    await apiCreateEnquiry(page.request, agency, client.id, adminId);
    const del = await page.request.delete(`/api/v2/neon-clients/${client.id}`);
    expect(del.status()).toBe(200);

    await page.goto(`/clients/${client.id}`);
    await expect(page.getByTestId("client-center-header")).toContainText(client.surename);
    await expect(page.getByTestId("client-deleted-banner")).toContainText("Deleted client");
    await expect(page.getByTestId("client-index-more")).toHaveCount(0);
    await expect(page.getByTestId("client-index-create")).toHaveCount(0);
    await expect(page.getByTestId("client-index-button-edit")).toHaveCount(0);

    // Notes, Tasks, Tickets and Files load for the admin, with no add / upload controls.
    for (const tab of ["notes", "tasks", "tickets", "files"]) {
      await page.getByTestId(`client-index-tab-${tab}`).click();
      await expect(page.getByTestId(`client-index-tab-panel-${tab}`)).toBeVisible();
      await expect(page.getByText("Client not found")).toHaveCount(0);
    }
    for (const id of ["client-index-add-task", "button-add-client-note", "button-files-upload", "holiday-tickets-empty-new-ticket"]) {
      await expect(page.getByTestId(id)).toHaveCount(0);
    }
    for (const path of ["notes/client", "tasks/for-client", "tickets/client"]) {
      const res = await page.request.get(`/api/v2/${path}/${client.id}`);
      expect(res.status(), path).not.toBe(404);
    }

    // Writes are still refused by the API.
    const patch = await page.request.patch(`/api/v2/neon-clients/${client.id}`, { data: { city: "Leeds" } });
    expect(patch.status()).toBe(404);

    // An agent in the same shop gets not found.
    const ctx = await browser.newContext();
    const agentPage = await ctx.newPage();
    await signIn(agentPage, agency.agentEmail);
    expect((await agentPage.request.get(`/api/v2/neon-clients/${client.id}`)).status()).toBe(404);
    await ctx.close();
  });
});
