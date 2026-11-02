import { expect, expectLoginOk, test } from "../helpers/fixtures";
import { createVerifiedOwner } from "../helpers/flows";
import {
  findOrgByOwnerEmail,
  findUser,
  listOrgBranches,
  setOrgPlan,
  uniqueEmail,
} from "../helpers/seed";
import {
  VALID_ADDRESS,
  VALID_PHONE,
  choose,
  clickNext,
  csvBuffer,
  expectDoneStep,
  fillBusiness,
  fillPerson,
  fillShop,
  goToDashboard,
  openWizard,
  skipForNow,
} from "../helpers/wizard";

/** A signed-in owner whose onboarding is still pending. */
async function pendingOwner(page: import("@playwright/test").Page, plan?: { code: string; seats: number | null }) {
  const owner = await createVerifiedOwner(page.request);
  if (plan) await setOrgPlan(owner.orgId, plan.code, plan.seats);
  await expectLoginOk(page.request, owner.email, owner.password);
  return owner;
}

async function onboardingStatus(email: string): Promise<string | undefined> {
  const org = await findOrgByOwnerEmail(email);
  return (org?.settings as { onboarding?: { status?: string } } | null)?.onboarding?.status;
}

test.describe("setup wizard", () => {
  test("single shop: business details, invite the team, finish at the dashboard", async ({ page }) => {
    const owner = await pendingOwner(page);
    await openWizard(page);

    await fillBusiness(page);
    await clickNext(page);
    await expect(page.getByRole("heading", { name: "Invite your agents" })).toBeVisible();

    const manager = uniqueEmail("manager");
    const agent = uniqueEmail("agent");
    // Row 1 starts as Branch Manager (the "Do you have a Branch Manager?" answer defaults to yes), the rest as Agent.
    await fillPerson(page, 1, { first: "Morgan", last: "Manager", email: manager });
    await fillPerson(page, 2, { first: "Alex", last: "Agent", email: agent });
    await page.getByRole("button", { name: /Send invites/ }).click();

    await expectDoneStep(page);
    await expect(page.getByText("2 invites sent.")).toBeVisible();

    await goToDashboard(page);

    expect(await onboardingStatus(owner.email)).toBe("complete");
    const invitedManager = await findUser(manager);
    const invitedAgent = await findUser(agent);
    expect(invitedManager?.orgRole).toBe("branch_manager");
    expect(invitedManager?.inviteToken).toBeTruthy();
    expect(invitedAgent?.orgRole).toBe("agent");
    expect(invitedAgent?.orgId).toBe(owner.orgId);

    const org = await findOrgByOwnerEmail(owner.email);
    expect(org?.settings).toMatchObject({ profile: { phone: VALID_PHONE, addressLine1: VALID_ADDRESS } });
  });

  test("multi shop: head office, two shops with a manager invite, a team member, then the dashboard", async ({ page }) => {
    const owner = await pendingOwner(page, { code: "growth", seats: 50 });
    await openWizard(page);

    await fillBusiness(page, { type: "multi" });
    await expect(page.getByText("With Multi Shops you'll add each shop")).toBeVisible();
    await clickNext(page);
    await expect(page.getByRole("heading", { name: "Add your shops" })).toBeVisible();

    const shopA = `Houghton ${Date.now().toString(36)}`;
    const shopB = `Durham ${Date.now().toString(36)}`;
    const managerEmail = uniqueEmail("shopmanager");
    await fillShop(page, { name: shopA, managerEmail });
    await page.getByRole("button", { name: "+ Add shop" }).click();
    await fillShop(page, { name: shopB });
    await page.getByRole("button", { name: /Next: add your team/ }).click();

    await expect(page.getByRole("heading", { name: "Invite your team" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Shop, person 1" })).toBeVisible();

    const agent = uniqueEmail("teamagent");
    await fillPerson(page, 1, { first: "Tess", last: "Team", email: agent });
    await choose(page, "Shop, person 1", shopB);
    await page.getByRole("button", { name: /Send invites/ }).click();

    await expectDoneStep(page);
    await goToDashboard(page);

    const shops = (await listOrgBranches(owner.orgId)).filter((b) => b.branchType === "shop").map((b) => b.name);
    expect(shops).toEqual(expect.arrayContaining([shopA, shopB]));
    expect(shops).toHaveLength(2);

    const manager = await findUser(managerEmail);
    expect(manager?.orgRole).toBe("branch_manager");
    expect(manager?.inviteToken).toBeTruthy();
    const invited = await findUser(agent);
    expect(invited?.orgRole).toBe("agent");
    expect(await onboardingStatus(owner.email)).toBe("complete");
  });

  test("business step: an incomplete phone number and a short address are rejected and nothing is saved", async ({ page }) => {
    const owner = await pendingOwner(page);
    await openWizard(page);

    await fillBusiness(page, { phone: "12345", address: "abc" });
    await clickNext(page);

    await expect(page.getByText("Phone number looks incomplete.")).toBeVisible();
    await expect(page.getByText("Enter your business address.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Welcome to Travana" })).toBeVisible();

    const org = await findOrgByOwnerEmail(owner.email);
    expect((org?.settings as { profile?: { phone?: string } } | null)?.profile?.phone).toBeUndefined();
  });

  test("business step: letters in the phone number and a too-long number are rejected", async ({ page }) => {
    await pendingOwner(page);
    await openWizard(page);

    await fillBusiness(page, { phone: "call me maybe" });
    await clickNext(page);
    await expect(page.getByText("Use digits, spaces, + ( ) and - only.")).toBeVisible();

    await page.getByLabel("Phone", { exact: true }).fill("1234567890123456");
    await expect(page.getByText("Phone number looks too long.")).toBeVisible();
  });

  test("business step: a website that is not a full web address is rejected", async ({ page }) => {
    await pendingOwner(page);
    await openWizard(page);

    await fillBusiness(page);
    await page.getByLabel("Website URL").fill("sunrisetravel");
    await clickNext(page);
    await expect(page.getByText(/Enter the full web address/)).toBeVisible();
  });

  test("shops step: a shop beyond the plan limit fails on its own row while the first is saved", async ({ page }) => {
    const owner = await pendingOwner(page); // starter plan: one shop
    await openWizard(page);
    await fillBusiness(page, { type: "multi" });
    await clickNext(page);

    const first = `Allowed ${Date.now().toString(36)}`;
    const second = `OverLimit ${Date.now().toString(36)}`;
    await fillShop(page, { name: first });
    await page.getByRole("button", { name: "+ Add shop" }).click();
    await fillShop(page, { name: second });
    await page.getByRole("button", { name: /Next: add your team/ }).click();

    await expect(page.getByText("Some shops couldn't be created. The ones that worked are saved.")).toBeVisible();
    await expect(page.getByText("Contact us to add more shops.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Add your shops" })).toBeVisible();
    // The shop that fitted is shown as created.
    await expect(page.getByText("Created", { exact: true })).toBeVisible();

    const names = (await listOrgBranches(owner.orgId)).filter((b) => b.branchType === "shop").map((b) => b.name);
    expect(names).toEqual([first]);
  });

  test("shops step: the reserved name Homeworker is refused", async ({ page }) => {
    await pendingOwner(page, { code: "growth", seats: 50 });
    await openWizard(page);
    await fillBusiness(page, { type: "multi" });
    await clickNext(page);

    await fillShop(page, { name: "Homeworker" });
    await page.getByRole("button", { name: /Next: add your team/ }).click();

    await expect(page.getByText('"Homeworker" is reserved. Choose another shop name.')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Add your shops" })).toBeVisible();
  });

  test("shops step: next with no shop and nothing created asks for a shop or a skip", async ({ page }) => {
    await pendingOwner(page);
    await openWizard(page);
    await fillBusiness(page, { type: "multi" });
    await clickNext(page);

    await page.getByRole("button", { name: /Next: add your team/ }).click();
    await expect(page.getByText("Add at least one shop, or skip for now.")).toBeVisible();
  });

  test("single shop: every people step can be skipped, and the done screen says the invites were skipped", async ({ page }) => {
    const owner = await pendingOwner(page);
    await openWizard(page);
    await fillBusiness(page);
    await clickNext(page);

    await skipForNow(page);
    await expectDoneStep(page);
    await expect(page.getByText("You skipped this. Your agents can't log in until they're invited.")).toBeVisible();

    await goToDashboard(page);
    expect(await onboardingStatus(owner.email)).toBe("complete");
  });

  test("multi shop: shops and team can both be skipped", async ({ page }) => {
    const owner = await pendingOwner(page);
    await openWizard(page);
    await fillBusiness(page, { type: "multi" });
    await clickNext(page);

    await skipForNow(page); // shops
    await expect(page.getByRole("heading", { name: "Invite your team" })).toBeVisible();
    await skipForNow(page); // team
    await expectDoneStep(page);

    await goToDashboard(page);
    expect(await onboardingStatus(owner.email)).toBe("complete");
  });

  test("agents step: send with no one filled in asks for a person or a skip", async ({ page }) => {
    await pendingOwner(page);
    await openWizard(page);
    await fillBusiness(page);
    await clickNext(page);

    await page.getByRole("button", { name: /Send invites/ }).click();
    await expect(page.getByText("Add at least one person, or skip for now.")).toBeVisible();
  });

  test("agents step: a half-filled row blocks sending and nobody is invited", async ({ page }) => {
    const owner = await pendingOwner(page);
    await openWizard(page);
    await fillBusiness(page);
    await clickNext(page);

    await page.getByLabel("First name, person 2").fill("Half");
    await page.getByLabel("Email address, person 2").fill("not-an-email");
    await page.getByRole("button", { name: /Send invites/ }).click();

    await expect(page.getByText("Fix the rows marked in red, or clear them to leave them out.")).toBeVisible();
    expect(await findUser("not-an-email")).toBeUndefined();
    expect(await onboardingStatus(owner.email)).toBe("pending");
  });

  test.describe("spreadsheet upload", () => {
    async function openAgentsStep(page: import("@playwright/test").Page) {
      await pendingOwner(page);
      await openWizard(page);
      await fillBusiness(page);
      await clickNext(page);
      await expect(page.getByRole("heading", { name: "Invite your agents" })).toBeVisible();
    }

    test("rejects a file that is not a .csv", async ({ page }) => {
      await openAgentsStep(page);
      await page.locator('input[type="file"]').setInputFiles({
        name: "agents.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: csvBuffer("not really a spreadsheet"),
      });
      await expect(page.getByText("Upload a .csv file. In Excel, use Save As and pick CSV.")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Invite your agents" })).toBeVisible();
    });

    test("rejects a file with more than 500 rows", async ({ page }) => {
      await openAgentsStep(page);
      const rows = ["first name,last name,email,role"];
      for (let i = 0; i < 501; i++) rows.push(`F${i},L${i},p${i}@e2e.test,Agent`);
      await page.locator('input[type="file"]').setInputFiles({ name: "big.csv", mimeType: "text/csv", buffer: csvBuffer(rows.join("\n")) });
      await expect(page.getByText("That file has more than 500 rows. Split it into smaller files.")).toBeVisible();
    });

    test("accepts a file of exactly 500 lines (header included)", async ({ page }) => {
      await openAgentsStep(page);
      const rows = ["first name,last name,email,role"];
      for (let i = 0; i < 499; i++) rows.push(`F${i},L${i},q${i}@e2e.test,Agent`);
      await page.locator('input[type="file"]').setInputFiles({ name: "edge.csv", mimeType: "text/csv", buffer: csvBuffer(rows.join("\n")) });
      await expect(page.getByRole("heading", { name: "Check your agents" })).toBeVisible();
      await expect(page.getByText("We found 499 people in your file.")).toBeVisible();
    });

    test("rejects a file over 2 MB", async ({ page }) => {
      await openAgentsStep(page);
      const filler = "x".repeat(2 * 1024 * 1024 + 10);
      await page.locator('input[type="file"]').setInputFiles({ name: "huge.csv", mimeType: "text/csv", buffer: csvBuffer(filler) });
      await expect(page.getByText("That file is over 2 MB. Split it into smaller files.")).toBeVisible();
    });

    test("rejects an empty file", async ({ page }) => {
      await openAgentsStep(page);
      await page.locator('input[type="file"]').setInputFiles({ name: "empty.csv", mimeType: "text/csv", buffer: csvBuffer("\n\n") });
      await expect(page.getByText("We couldn't find any rows in that file.")).toBeVisible();
    });

    test("a good file opens the review screen, flags bad rows and sends only the good ones", async ({ page }) => {
      await openAgentsStep(page);
      const good = uniqueEmail("csvgood");
      const csv = ["first name,last name,email,role", `Gina,Good,${good},Agent`, "Bea,Bad,not-an-email,Agent"].join("\n");
      await page.locator('input[type="file"]').setInputFiles({ name: "team.csv", mimeType: "text/csv", buffer: csvBuffer(csv) });

      await expect(page.getByRole("heading", { name: "Check your agents" })).toBeVisible();
      await expect(page.getByText("1 ready")).toBeVisible();
      await expect(page.getByText("1 need attention")).toBeVisible();

      await page.getByRole("button", { name: "Send 1 invite" }).click();
      await expectDoneStep(page);
      expect((await findUser(good))?.inviteToken).toBeTruthy();
      expect(await findUser("not-an-email")).toBeUndefined();
    });
  });

  test("a pending owner is sent to the wizard from the dashboard and from any other page", async ({ page }) => {
    await pendingOwner(page);

    await page.goto("/agency/team");
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { name: "Welcome to Travana" })).toBeVisible();

    await page.goto("/");
    await expect(page).toHaveURL(/\/onboarding$/);

    await page.goto("/agency/overview");
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("signing in as a pending owner lands in the wizard", async ({ page }) => {
    const owner = await createVerifiedOwner(page.request);
    await page.goto("/");
    await page.getByTestId("input-email").fill(owner.email);
    await page.getByTestId("input-password").fill(owner.password);
    await page.getByTestId("button-login").click();
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("after setup is complete the wizard does not restart: the page redirects and the API refuses writes with 409", async ({ page }) => {
    const owner = await pendingOwner(page);
    const done = await page.request.post("/api/v2/onboarding/complete");
    expect(done.status()).toBe(200);

    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/agency\/overview$/);
    await expect(page.getByRole("heading", { name: "Welcome to Travana" })).toHaveCount(0);

    const business = await page.request.put("/api/v2/onboarding/business", {
      data: { businessType: "single", businessName: "Renamed Ltd", phone: VALID_PHONE, address: VALID_ADDRESS, website: "", email: owner.email },
    });
    expect(business.status()).toBe(409);
    expect((await business.json()).code).toBe("ONBOARDING_NOT_PENDING");

    const shops = await page.request.post("/api/v2/onboarding/shops", {
      data: { shops: [{ name: "Late Shop", phone: VALID_PHONE, address: VALID_ADDRESS, email: uniqueEmail("late"), managerEmail: "" }] },
    });
    expect(shops.status()).toBe(409);
    expect((await shops.json()).code).toBe("ONBOARDING_NOT_PENDING");

    const again = await page.request.post("/api/v2/onboarding/complete");
    expect(again.status()).toBe(409);
    expect((await again.json()).code).toBe("ONBOARDING_NOT_PENDING");

    const org = await findOrgByOwnerEmail(owner.email);
    expect(org?.name).not.toBe("Renamed Ltd");
  });

  test("refreshing in the middle of the wizard keeps the step and what was typed", async ({ page }) => {
    await pendingOwner(page);
    await openWizard(page);
    await fillBusiness(page);
    await clickNext(page);

    const email = uniqueEmail("draft");
    await expect(page.getByRole("heading", { name: "Invite your agents" })).toBeVisible();
    await fillPerson(page, 2, { first: "Drew", last: "Draft", email });

    await page.reload();
    await expect(page.getByRole("heading", { name: "Invite your agents" })).toBeVisible();
    await expect(page.getByLabel("First name, person 2")).toHaveValue("Drew");
    await expect(page.getByLabel("Email address, person 2")).toHaveValue(email);
  });

  test("refreshing on the business step keeps the saved business details", async ({ page }) => {
    await pendingOwner(page);
    await openWizard(page);
    await fillBusiness(page, { phone: "0207 123 4567", address: "1 Fleet Street, London" });
    await clickNext(page);
    await expect(page.getByRole("heading", { name: "Invite your agents" })).toBeVisible();

    await page.goto("/onboarding");
    await page.getByRole("button", { name: /Back/ }).click();
    await expect(page.getByLabel("Phone", { exact: true })).toHaveValue("0207 123 4567");
    await expect(page.getByLabel("Address", { exact: true })).toHaveValue("1 Fleet Street, London");
  });

  test("only the owner can run the wizard endpoints: an anonymous caller gets 401", async ({ request }) => {
    const res = await request.get("/api/v2/onboarding/state");
    expect(res.status()).toBe(401);
  });
});
