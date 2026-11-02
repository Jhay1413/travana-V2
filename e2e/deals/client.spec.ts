import type { Page } from "@playwright/test";
import { FAKE_POSTCODE } from "../helpers/browser-guard";
import { apiCreateClient, apiCreateEnquiry, dataOf, dbClient, signIn, uniqueSurname } from "../helpers/deals";
import { expect, expectLoginOk, expectToast, test } from "../helpers/fixtures";
import { queryRows, seedAgency, seedDealsAgency, seedMember, unique } from "../helpers/seed";

/** Opens the New Client drawer from the header + menu, on the /clients page. */
async function openNewClientDrawer(page: Page) {
  await page.goto("/clients");
  await page.getByTestId("button-primary-action").click();
  await page.getByTestId("button-primary-action-client").click();
  const drawer = page.getByTestId("client-create-drawer");
  await expect(drawer).toBeVisible();
  return drawer;
}

async function fillRequired(page: Page, last: string, phone = "07700900222") {
  await page.getByTestId("input-first-name").fill("Nina");
  await page.getByTestId("input-last-name").fill(last);
  await page.getByTestId("input-phone").fill(phone);
}

test.describe("clients", () => {
  test("creates a client through the New Client drawer and lands on their page with the saved details", async ({ page }) => {
    const agency = await seedDealsAgency();
    const agentId = await signIn(page, agency.agentEmail);
    const last = uniqueSurname();
    const email = `${unique("n")}@e2e.test`;

    await openNewClientDrawer(page);
    await expect(page.getByTestId("form-drawer-submit")).toBeDisabled();
    await page.getByTestId("select-title").click();
    await page.getByRole("option", { name: "Ms", exact: true }).click();
    await fillRequired(page, last);
    await page.getByTestId("input-email").fill(email);
    await page.getByTestId("select-client-type").click();
    await page.getByRole("option", { name: "Repeat Client", exact: true }).click();
    await expect(page.getByTestId("form-drawer-submit")).toBeEnabled();
    await page.getByTestId("form-drawer-submit").click();

    await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("client-center-header")).toContainText(`Nina ${last}`);

    const id = page.url().split("/").pop()!;
    const row = await dbClient(id);
    expect(row).toMatchObject({
      firstName: "Nina",
      surename: last,
      phoneNumber: "07700900222",
      email,
      title: "Ms",
      badge: "Repeat Client",
      orgId: agency.orgId,
      branchId: agency.branchId,
      createdBy: agentId,
      status: "active",
    });
  });

  test("Create Client stays disabled, with a hint, until first name, last name and phone are all filled; nothing is saved", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const last = uniqueSurname();
    await openNewClientDrawer(page);

    const submit = page.getByTestId("form-drawer-submit");
    const hint = page.getByText("Enter a first name, last name and phone number to save.");
    await expect(submit).toBeDisabled();
    await expect(hint).toBeVisible();

    await page.getByTestId("input-first-name").fill("Nina");
    await page.getByTestId("input-last-name").fill(last);
    await expect(submit).toBeDisabled(); // phone still missing
    await page.getByTestId("input-phone").fill("07700900222");
    await expect(submit).toBeEnabled();
    await page.getByTestId("input-phone").fill("");
    await expect(submit).toBeDisabled();
    await expect(hint).toBeVisible();

    expect(await queryRows(`select id from client_table where surename = $1`, [last])).toHaveLength(0);
  });

  test("the API refuses a client with no first name, no surname or no phone number (400) and stores nothing", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const last = uniqueSurname();
    for (const body of [
      { surename: last, phoneNumber: "07700900333" },
      { firstName: "Nina", phoneNumber: "07700900333" },
      { firstName: "Nina", surename: last },
    ]) {
      const res = await page.request.post("/api/v2/neon-clients", { data: body });
      expect(res.status(), JSON.stringify(body)).toBe(400);
    }
    expect(await queryRows(`select id from client_table where surename = $1`, [last])).toHaveLength(0);
  });

  test("closing the drawer saves nothing and a reopened drawer is empty", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const last = uniqueSurname();
    await openNewClientDrawer(page);
    await fillRequired(page, last);
    await page.getByTestId("form-drawer-close").click();
    await expect(page.getByTestId("client-create-drawer")).toBeHidden();
    expect(await queryRows(`select id from client_table where surename = $1`, [last])).toHaveLength(0);

    await page.getByTestId("button-primary-action").click();
    await page.getByTestId("button-primary-action-client").click();
    await expect(page.getByTestId("input-first-name")).toHaveValue("");
    await expect(page.getByTestId("input-phone")).toHaveValue("");
  });

  test("postcode lookup fills city, country and postcode from the (fake) postcode service, and says when a postcode is unknown", async ({
    page,
    abortedRequests,
  }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const last = uniqueSurname();
    await openNewClientDrawer(page);
    await fillRequired(page, last);

    await page.getByTestId("drawer-section-client-address").getByRole("button", { name: "Expand section" }).click();
    await page.getByTestId("input-postcode-search").fill("zz9 9zz");
    await page.getByTestId("button-lookup-postcode").click();
    await expect(page.getByText("Postcode not found. Please enter address manually.")).toBeVisible();
    await expect(page.getByTestId("input-city")).toHaveValue("");

    await page.getByTestId("input-postcode-search").fill("ne1 4st");
    await expect(page.getByTestId("input-postcode-search")).toHaveValue("NE1 4ST"); // upper-cased as typed
    await page.getByTestId("button-lookup-postcode").click();
    await expect(page.getByText("Postcode found! Please enter house number and street manually.")).toBeVisible();
    await expect(page.getByTestId("input-city")).toHaveValue(FAKE_POSTCODE.district);
    await expect(page.getByTestId("input-country")).toHaveValue(FAKE_POSTCODE.country);
    await expect(page.getByTestId("input-postcode")).toHaveValue(FAKE_POSTCODE.postcode);

    await page.getByTestId("input-house-number").fill("12");
    await page.getByTestId("input-street").fill("Grey Street");
    await page.getByTestId("form-drawer-submit").click();
    await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);

    const row = await dbClient(page.url().split("/").pop()!);
    expect(row).toMatchObject({
      houseNumber: "12",
      street: "Grey Street",
      city: FAKE_POSTCODE.district,
      country: FAKE_POSTCODE.country,
      post_code: FAKE_POSTCODE.postcode,
    });
    // Nothing but the postcode lookup left the browser, and that was answered by the fake.
    expect(abortedRequests.filter((r) => !r.ignored)).toEqual([]);
  });

  test("the postcode Find button is disabled while the search box is empty", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    await openNewClientDrawer(page);
    await page.getByTestId("drawer-section-client-address").getByRole("button", { name: "Expand section" }).click();
    await expect(page.getByTestId("button-lookup-postcode")).toBeDisabled();
    await page.getByTestId("input-postcode-search").fill("NE1 4ST");
    await expect(page.getByTestId("button-lookup-postcode")).toBeEnabled();
  });

  test("edits a client from their page: the dialog is prefilled, saving shows a toast and the database changes", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request, { city: "Leeds" });

    await page.goto(`/clients/${client.id}`);
    await expect(page.getByTestId("client-center-header")).toContainText(client.surename);
    await page.getByTestId("client-index-more").click();
    await page.getByTestId("client-index-menu-edit").click();
    const dialog = page.getByTestId("dialog-edit-client");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("input-edit-firstName")).toHaveValue("Cora");
    await expect(dialog.getByTestId("input-edit-city")).toHaveValue("Leeds");

    await dialog.getByTestId("input-edit-firstName").fill("Cordelia");
    await dialog.getByTestId("input-edit-phoneNumber").fill("07700900444");
    await dialog.getByTestId("input-edit-city").fill("York");
    await dialog.getByTestId("button-save-client").click();
    await expectToast(page, "Client updated successfully");
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("client-center-header")).toContainText("Cordelia");

    expect(await dbClient(client.id)).toMatchObject({
      firstName: "Cordelia",
      phoneNumber: "07700900444",
      city: "York",
      surename: client.surename,
    });
  });

  test("the edit dialog will not save with the first name, surname or phone cleared", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    await page.goto(`/clients/${client.id}`);
    await page.getByTestId("client-index-more").click();
    await page.getByTestId("client-index-menu-edit").click();
    const dialog = page.getByTestId("dialog-edit-client");
    const save = dialog.getByTestId("button-save-client");
    for (const field of ["input-edit-firstName", "input-edit-surename", "input-edit-phoneNumber"]) {
      const input = dialog.getByTestId(field);
      const before = await input.inputValue();
      await input.fill("");
      await expect(save, field).toBeDisabled();
      await input.fill(before);
      await expect(save, field).toBeEnabled();
    }
  });

  test("two clients with the same phone number are both accepted (no duplicate block); only an org admin can see the duplicate group", async ({
    page,
  }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const phone = `07${Math.floor(100000000 + Math.random() * 899999999)}`;
    const a = await apiCreateClient(page.request, { phoneNumber: phone });
    const b = await apiCreateClient(page.request, { phoneNumber: phone });
    expect(a.id).not.toBe(b.id);

    const key = phone.replace(/\D/g, "").slice(-9);
    // An agent cannot open duplicate resolution.
    expect((await page.request.get(`/api/v2/neon-clients/duplicates/phone/${key}`)).status()).toBe(403);

    await signIn(page, agency.adminEmail);
    const group = await dataOf<{ clients: { id: string }[] }>(await page.request.get(`/api/v2/neon-clients/duplicates/phone/${key}`));
    expect(group.clients.map((c) => c.id).sort()).toEqual([a.id, b.id].sort());
  });

  test("another agency gets 404 for a client: opening, editing, merging and deleting are all refused, and its list does not show them", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const agency = await seedDealsAgency();
    const other = await seedAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);

    // Positive control: the owning agency finds this very client by the same search the outsider will use.
    const own = await dataOf<{ clients: { id: string }[] }>(await page.request.get(`/api/v2/neon-clients?search=${client.surename}`));
    expect(own.clients.map((c) => c.id)).toEqual([client.id]);

    const outsider = await playwright.request.newContext({ baseURL: baseURL!, extraHTTPHeaders: { "X-Forwarded-For": "10.9.9.9" } });
    await expectLoginOk(outsider, other.adminEmail);
    expect((await outsider.get(`/api/v2/neon-clients/${client.id}`)).status()).toBe(404);
    expect((await outsider.patch(`/api/v2/neon-clients/${client.id}`, { data: { city: "Hacked" } })).status()).toBe(404);
    expect((await outsider.delete(`/api/v2/neon-clients/${client.id}`)).status()).toBe(404);
    const mine = await apiCreateClient(outsider);
    expect((await outsider.post(`/api/v2/neon-clients/${client.id}/merge`, { data: { targetId: mine.id } })).status()).toBe(404);
    const list = await dataOf<{ clients: { id: string }[] }>(await outsider.get(`/api/v2/neon-clients?search=${client.surename}`));
    expect(list.clients).toEqual([]);
    expect((await dbClient(client.id)).city).toBeNull();
    await outsider.dispose();

    // On screen. The owner sees the client's name (control)...
    await page.goto(`/clients/${client.id}`);
    await expect(page.getByTestId("client-center-header")).toContainText(client.surename);

    // ...and the outsider's page has finished loading (the client request came back 404) and shows no name.
    await signIn(page, other.adminEmail);
    const lookup = page.waitForResponse((r) => r.url().includes(`/api/v2/neon-clients/${client.id}`) && r.request().method() === "GET");
    await page.goto(`/clients/${client.id}`);
    expect((await lookup).status()).toBe(404);
    await expect(page.getByText(client.surename)).toHaveCount(0);
  });

  test("merging moves the duplicate's deals to the kept client, archives the duplicate and lands on the kept client's page", async ({
    page,
  }) => {
    const agency = await seedDealsAgency();
    const agentId = await signIn(page, agency.agentEmail);
    const source = await apiCreateClient(page.request, { firstName: "Dupe", surename: uniqueSurname() });
    const target = await apiCreateClient(page.request, { firstName: "Keeper", surename: uniqueSurname() });
    const deal = await apiCreateEnquiry(page.request, agency, source.id, agentId, { title: "Dupe trip" });
    // Control: before the merge the same search finds the duplicate.
    const before = await dataOf<{ clients: { id: string }[] }>(await page.request.get(`/api/v2/neon-clients?search=${source.surename}`));
    expect(before.clients.map((c) => c.id)).toEqual([source.id]);

    await page.goto(`/clients/${source.id}`);
    await page.getByTestId("client-index-more").click();
    await page.getByTestId("client-index-button-merge").click();
    await expect(page.getByTestId("dialog-merge-client")).toBeVisible();
    await expect(page.getByTestId("button-merge-confirm")).toBeDisabled();
    await page.getByTestId("input-merge-target-search").fill(target.surename);
    await page.getByTestId(`merge-target-option-${target.id}`).click();
    await page.getByTestId("button-merge-confirm").click();
    await expectToast(page, "Clients merged successfully");

    await expect(page).toHaveURL(new RegExp(`/clients/${target.id}$`));
    const [txn] = await queryRows<{ client_id: string }>(`select client_id from transaction where id = $1`, [deal.transactionId]);
    expect(txn.client_id).toBe(target.id);
    expect(await dbClient(source.id)).toMatchObject({ status: "merged", mergedIntoId: target.id });
    expect(await dbClient(target.id)).toMatchObject({ status: "active" });
    // The duplicate no longer shows in the client search.
    const list = await dataOf<{ clients: { id: string }[] }>(await page.request.get(`/api/v2/neon-clients?search=${source.surename}`));
    expect(list.clients.map((c) => c.id)).not.toContain(source.id);
  });

  test("merging a client into itself, or using an already merged client as source or target, is refused (400)", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const a = await apiCreateClient(page.request);
    const b = await apiCreateClient(page.request);
    const c = await apiCreateClient(page.request);
    expect((await page.request.post(`/api/v2/neon-clients/${a.id}/merge`, { data: { targetId: a.id } })).status()).toBe(400);
    expect((await page.request.post(`/api/v2/neon-clients/${a.id}/merge`, { data: { targetId: b.id } })).status()).toBe(200);
    // a is now merged: it cannot be a source again, nor a target.
    expect((await page.request.post(`/api/v2/neon-clients/${a.id}/merge`, { data: { targetId: c.id } })).status()).toBe(400);
    expect((await page.request.post(`/api/v2/neon-clients/${c.id}/merge`, { data: { targetId: a.id } })).status()).toBe(400);
  });

  test("control: after a merge the duplicate reads as merged, and editing an ordinary client still works", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const source = await apiCreateClient(page.request);
    const target = await apiCreateClient(page.request);
    expect((await page.request.post(`/api/v2/neon-clients/${source.id}/merge`, { data: { targetId: target.id } })).status()).toBe(200);
    expect(await dbClient(source.id)).toMatchObject({ status: "merged", mergedIntoId: target.id });
    const ok = await page.request.patch(`/api/v2/neon-clients/${target.id}`, { data: { city: "Edited active" } });
    expect(ok.status()).toBe(200);
    expect((await dbClient(target.id)).city).toBe("Edited active");
  });

  // The merge set-up is proven by the control test above, which runs the identical steps and must pass.
  test("a merged client cannot be edited (400) and is left unchanged", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const source = await apiCreateClient(page.request);
    const target = await apiCreateClient(page.request);
    await page.request.post(`/api/v2/neon-clients/${source.id}/merge`, { data: { targetId: target.id } });

    const res = await page.request.patch(`/api/v2/neon-clients/${source.id}`, { data: { city: "Edited after merge" } });
    expect(res.status()).toBe(400);
    expect((await dbClient(source.id)).city).toBeNull();
  });

  test("a read-only role (social media manager) cannot create a client", async ({ page }) => {
    const agency = await seedDealsAgency();
    const smm = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "social_media_manager" });
    await signIn(page, smm.email);
    const res = await page.request.post("/api/v2/neon-clients", { data: { firstName: "No", surename: uniqueSurname(), phoneNumber: "07700900555" } });
    expect(res.status()).toBe(403);
  });
});
