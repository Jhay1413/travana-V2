import type { APIRequestContext } from "@playwright/test";
import { expect, expectLoginOk, expectToast, loginViaApi, test } from "../helpers/fixtures";
import { INVITE_PASSWORD, inviteAndAccept, inviteViaApi } from "../helpers/flows";
import {
  countSessionsFor,
  findUser,
  listMemberships,
  ownerOfOpenWork,
  requireUser,
  seedAgency,
  seedMember,
  seedOpenWork,
  uniqueEmail,
} from "../helpers/seed";

const REMOVE_BODY = { confirm: "REMOVE" };

function removePath(userId: string): string {
  return `/api/v2/organizations/me/members/${userId}/remove`;
}

async function workload(request: APIRequestContext, userId: string) {
  const res = await request.get(`/api/v2/organizations/me/members/${userId}/workload`);
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()).data as { openDeals: number; openTasks: number; openTickets: number; clients: number };
}

test.describe("remove a team member", () => {
  test("hands their open work to a new owner, then blocks sign-in and kills their session (through the Teams page)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const agency = await seedAgency();
    const leaver = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "agent", firstName: "Lee", lastName: "Leaver" });
    const heir = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "agent", firstName: "Hana", lastName: "Heir" });
    await seedOpenWork({ userId: leaver.id, orgId: agency.orgId, branchId: agency.branchId });

    // The leaver is signed in somewhere else when the owner removes them.
    const leaverCtx = await playwright.request.newContext({ baseURL: baseURL! });
    await expectLoginOk(leaverCtx, leaver.email);
    expect((await leaverCtx.get("/api/auth/user")).status()).toBe(200);
    expect(await countSessionsFor(leaver.id)).toBeGreaterThan(0);

    await expectLoginOk(page.request, agency.adminEmail);
    await page.goto("/agency/team");
    await expect(page.getByTestId(`row-member-${leaver.id}`)).toBeVisible();

    await page.getByTestId(`menu-member-${leaver.id}`).click();
    await page.getByTestId(`action-remove-${leaver.id}`).click();

    const dialog = page.getByTestId("remove-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("workload-open-tasks")).toContainText("1");
    await expect(dialog.getByTestId("workload-clients")).toContainText("1");

    // Remove stays disabled until the word is typed.
    await expect(page.getByTestId("button-confirm-remove")).toBeDisabled();
    await dialog.getByRole("combobox", { name: "New owner" }).click();
    await page.getByRole("option", { name: /Hana Heir/ }).click();
    await page.getByTestId("input-remove-confirm").fill("REMOVE");
    await page.getByTestId("button-confirm-remove").click();

    await expectToast(page, "Lee Leaver removed");
    await expectToast(page, "Their work moved to Hana Heir.");

    // The work moved.
    expect(await ownerOfOpenWork(leaver.id)).toEqual({ clients: 0, tasks: 0 });
    expect(await ownerOfOpenWork(heir.id)).toEqual({ clients: 1, tasks: 1 });

    // The account is deactivated and the seat is free.
    const removed = await requireUser(leaver.email);
    expect(removed.banned).toBe(true);
    expect(removed.banReason).toMatch(/^Removed by /);
    expect((await listMemberships(leaver.id)).every((m) => m.isActive === false)).toBe(true);

    // Their session is gone and they can no longer sign in.
    expect(await countSessionsFor(leaver.id)).toBe(0);
    expect((await leaverCtx.get("/api/auth/user")).status()).toBe(401);
    const login = await loginViaApi(leaverCtx, leaver.email);
    expect(login.status()).toBe(403);
    expect((await login.json()).code).toBe("ACCOUNT_DEACTIVATED");
    await leaverCtx.dispose();
  });

  test("a member with open work cannot be removed without a new owner, and nothing changes", async ({ request }) => {
    const agency = await seedAgency();
    const leaver = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "agent" });
    await seedOpenWork({ userId: leaver.id, orgId: agency.orgId, branchId: agency.branchId });
    await expectLoginOk(request, agency.adminEmail);

    expect(await workload(request, leaver.id)).toEqual({ openDeals: 0, openTasks: 1, openTickets: 0, clients: 1 });

    const res = await request.post(removePath(leaver.id), { data: REMOVE_BODY });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Choose who takes over their open work");

    expect((await requireUser(leaver.email)).banned).toBeFalsy();
    expect(await ownerOfOpenWork(leaver.id)).toEqual({ clients: 1, tasks: 1 });
  });

  test("the new owner must be someone who can take work over", async ({ request }) => {
    const agency = await seedAgency();
    const leaver = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "agent" });
    const social = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "social_media_manager" });
    await seedOpenWork({ userId: leaver.id, orgId: agency.orgId, branchId: agency.branchId });
    await expectLoginOk(request, agency.adminEmail);

    const self = await request.post(removePath(leaver.id), { data: { ...REMOVE_BODY, newOwnerId: leaver.id } });
    expect(self.status()).toBe(400);
    expect((await self.json()).message).toBe("Choose someone other than the person being removed");

    const wrongRole = await request.post(removePath(leaver.id), { data: { ...REMOVE_BODY, newOwnerId: social.id } });
    expect(wrongRole.status()).toBe(400);

    const stranger = await seedAgency();
    const outsider = await request.post(removePath(leaver.id), { data: { ...REMOVE_BODY, newOwnerId: stranger.adminId } });
    expect(outsider.status()).toBe(400);

    expect((await requireUser(leaver.email)).banned).toBeFalsy();
  });

  test("a member with nothing open is removed without choosing a new owner", async ({ request }) => {
    const agency = await seedAgency();
    const leaver = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "agent" });
    await expectLoginOk(request, agency.adminEmail);

    const res = await request.post(removePath(leaver.id), { data: REMOVE_BODY });
    expect(res.status(), await res.text()).toBe(200);
    expect((await res.json()).data.moved).toEqual({ openDeals: 0, openTasks: 0, openTickets: 0, clients: 0 });
    expect((await requireUser(leaver.email)).banned).toBe(true);
  });

  test("the REMOVE confirmation is required by the API", async ({ request }) => {
    const agency = await seedAgency();
    const leaver = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "agent" });
    await expectLoginOk(request, agency.adminEmail);

    const missing = await request.post(removePath(leaver.id), { data: {} });
    expect(missing.status()).toBe(400);
    const wrong = await request.post(removePath(leaver.id), { data: { confirm: "remove" } });
    expect(wrong.status()).toBe(400);
    expect((await requireUser(leaver.email)).banned).toBeFalsy();
  });

  test("removing the same person twice is refused with 409", async ({ request }) => {
    const agency = await seedAgency();
    const leaver = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "agent" });
    await expectLoginOk(request, agency.adminEmail);

    expect((await request.post(removePath(leaver.id), { data: REMOVE_BODY })).status()).toBe(200);
    const again = await request.post(removePath(leaver.id), { data: REMOVE_BODY });
    expect(again.status()).toBe(409);
    expect((await again.json()).message).toBe("This member has already been removed");
  });

  test("you cannot remove yourself: the API says 400 and your own menu has no Remove item", async ({ page }) => {
    const agency = await seedAgency();
    await expectLoginOk(page.request, agency.adminEmail);

    const res = await page.request.post(removePath(agency.adminId), { data: REMOVE_BODY });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("You cannot remove yourself");
    expect((await requireUser(agency.adminEmail)).banned).toBeFalsy();

    await page.goto("/agency/team");
    await expect(page.getByTestId(`row-member-${agency.adminId}`)).toBeVisible();
    await page.getByTestId(`menu-member-${agency.adminId}`).click();
    await expect(page.getByRole("menuitem", { name: "View details" })).toBeVisible();
    await expect(page.getByTestId(`action-remove-${agency.adminId}`)).toHaveCount(0);
  });

  async function openHomeworkerArchiveDialog(page: import("@playwright/test").Page, request: APIRequestContext) {
    const agency = await seedAgency();
    await expectLoginOk(request, agency.adminEmail);
    const email = uniqueEmail("homeworker");
    await inviteAndAccept(request, agency, "homeworker", email);
    const homeworker = await requireUser(email);

    await expectLoginOk(page.request, agency.adminEmail);
    await page.goto("/agency/team");
    await expect(page.getByTestId(`row-member-${homeworker.id}`)).toBeVisible();
    await page.getByTestId(`menu-member-${homeworker.id}`).click();
    return { agency, email, homeworker };
  }

  test("a homeworker is archived, not removed: no Remove item, the API refuses, Archive locks them out", async ({ page, request }) => {
    const { email, homeworker } = await openHomeworkerArchiveDialog(page, request);

    const res = await request.post(removePath(homeworker.id), { data: REMOVE_BODY });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Homeworkers are archived, not removed");

    await expect(page.getByTestId(`action-remove-${homeworker.id}`)).toHaveCount(0);
    await page.getByTestId(`action-archive-${homeworker.id}`).click();
    await expect(page.getByRole("alertdialog")).toContainText("Archive");
    await page.getByTestId("button-confirm-archive-homeworker").click();

    // Archived homeworkers lose their sign-in (their branch membership is deactivated).
    await expect
      .poll(async () => (await loginViaApi(request, email, INVITE_PASSWORD)).status(), { timeout: 15_000 })
      .toBe(403);
  });

  test("archiving a homeworker from the Teams page confirms with a toast", async ({ page, request }) => {
    const { homeworker } = await openHomeworkerArchiveDialog(page, request);
    await page.getByTestId(`action-archive-${homeworker.id}`).click();
    await page.getByTestId("button-confirm-archive-homeworker").click();
    await expectToast(page, "Homeworker archived");
  });

  test("a pending invite is revoked, not removed: the API says to revoke and Revoke deletes the invite", async ({ page, request }) => {
    const agency = await seedAgency();
    await expectLoginOk(request, agency.adminEmail);
    const email = uniqueEmail("pending");
    const sent = await inviteViaApi(request, { email, orgRole: "agent", branchId: agency.branchId });
    const pendingId = sent.data?.userId as string;

    const res = await request.post(removePath(pendingId), { data: REMOVE_BODY });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Revoke the invite instead");
    expect(await findUser(email)).toBeDefined();

    await expectLoginOk(page.request, agency.adminEmail);
    await page.goto("/agency/team");
    await expect(page.getByTestId(`row-invite-${pendingId}`)).toBeVisible();
    await expect(page.getByTestId(`row-member-${pendingId}`)).toHaveCount(0);

    await page.getByTestId(`button-revoke-${pendingId}`).click();
    await expectToast(page, "Invite revoked");
    await expect(page.getByTestId(`row-invite-${pendingId}`)).toHaveCount(0);
    expect(await findUser(email)).toBeUndefined();
  });

  test("a branch manager cannot remove anyone", async ({ request }) => {
    const agency = await seedAgency();
    const manager = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "branch_manager" });
    const agent = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "agent" });
    await expectLoginOk(request, manager.email);

    const res = await request.post(removePath(agent.id), { data: REMOVE_BODY });
    expect(res.status()).toBe(403);
    expect((await requireUser(agent.email)).banned).toBeFalsy();
  });

  test("someone in another organisation is a 404, not a 403", async ({ request }) => {
    const mine = await seedAgency();
    const theirs = await seedAgency();
    const outsider = await seedMember({ orgId: theirs.orgId, branchId: theirs.branchId, orgRole: "agent" });
    await expectLoginOk(request, mine.adminEmail);

    const res = await request.post(removePath(outsider.id), { data: REMOVE_BODY });
    expect(res.status()).toBe(404);
    const load = await request.get(`/api/v2/organizations/me/members/${outsider.id}/workload`);
    expect(load.status()).toBe(404);
    expect((await requireUser(outsider.email)).banned).toBeFalsy();
  });

  test("the removed person's seat is free again", async ({ request }) => {
    const agency = await seedAgency({ seatLimit: 2 });
    const leaver = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "agent" });
    await expectLoginOk(request, agency.adminEmail);

    const full = await inviteViaApi(request, { email: uniqueEmail("full"), orgRole: "agent", branchId: agency.branchId });
    expect(full.status).toBe(409);

    expect((await request.post(removePath(leaver.id), { data: REMOVE_BODY })).status()).toBe(200);
    const free = await inviteViaApi(request, { email: uniqueEmail("free"), orgRole: "agent", branchId: agency.branchId });
    expect(free.status, free.raw).toBe(201);
  });
});
