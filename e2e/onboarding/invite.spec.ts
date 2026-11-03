import { expect, expectLoginOk, expectToast, loginViaApi, test } from "../helpers/fixtures";
import {
  INVITE_PASSWORD,
  INVITE_PHONE,
  acceptInviteViaApi,
  inviteViaApi,
} from "../helpers/flows";
import {
  expireInviteToken,
  findUser,
  makeSecondBranch,
  readInviteToken,
  seedAgency,
  seedMember,
  uniqueEmail,
} from "../helpers/seed";

/** Where each role should land after signing in, and why. */
const ROLE_HOMES: Array<{ role: string; home: RegExp; label: string }> = [
  { role: "branch_manager", home: /\/branch-overview$/, label: "branch overview" },
  { role: "agent", home: /\/agent-overview$/, label: "agent dashboard" },
  { role: "homeworker", home: /\/agent-overview$/, label: "agent dashboard" },
  { role: "referral_agent", home: /\/referral-hub$/, label: "referral hub" },
  { role: "social_media_manager", home: /\/social-posts$/, label: "social posts" },
];

test.describe("invite and accept", () => {
  for (const { role, home, label } of ROLE_HOMES) {
    test(`${role}: invited by the owner, accepts on the invite page and lands on the ${label}`, async ({ page, request }) => {
      const agency = await seedAgency();
      await expectLoginOk(request, agency.adminEmail);

      const email = uniqueEmail(role);
      const body: Record<string, unknown> = { email, orgRole: role };
      if (role !== "homeworker") body.branchId = agency.branchId;
      const sent = await inviteViaApi(request, body);
      expect(sent.status, sent.raw).toBe(201);

      const pending = await findUser(email);
      expect(pending?.orgRole).toBe(role);
      expect(pending?.orgId).toBe(agency.orgId);
      expect(pending?.password).toBeNull();

      // The invitee, in a browser with no session.
      const token = await readInviteToken(email);
      await page.goto(`/accept-invite?token=${token}`);
      await expect(page.getByTestId("text-accept-title")).toContainText(`Join ${agency.orgName}`);
      await expect(page.getByText(email)).toBeVisible();

      await page.getByTestId("input-first-name").fill("Ivy");
      await page.getByTestId("input-last-name").fill("Invited");
      await page.getByTestId("input-phone").fill(INVITE_PHONE);
      await page.getByTestId("input-password").fill(INVITE_PASSWORD);
      await page.getByTestId("button-accept-invite").click();
      await expect(page.getByRole("heading", { name: "You're all set" })).toBeVisible();

      const accepted = await findUser(email);
      expect(accepted?.inviteToken).toBeNull();
      expect(accepted?.emailVerified).toBe(true);
      expect(accepted?.phoneNumber).toBe(INVITE_PHONE);
      expect(accepted?.password).toBeTruthy();

      await page.getByTestId("button-continue-to-signin").click();
      await page.getByTestId("input-email").fill(email);
      await page.getByTestId("input-password").fill(INVITE_PASSWORD);
      await page.getByTestId("button-login").click();
      await expect(page).toHaveURL(home);
    });
  }

  test("an unknown token shows 'Invalid or expired invitation' on the page and at the API", async ({ page, request }) => {
    await page.goto("/accept-invite?token=not-a-real-token");
    await expect(page.getByRole("heading", { name: "Invitation unavailable" })).toBeVisible();
    await expect(page.getByText("Invalid or expired invitation")).toBeVisible();

    const res = await request.get("/api/v2/invites/accept?token=not-a-real-token");
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Invalid or expired invitation");
  });

  test("a link with no token says so", async ({ page }) => {
    await page.goto("/accept-invite");
    await expect(page.getByText("No invitation token in the link.")).toBeVisible();
  });

  test("an expired invitation is refused on the page and at the API, and cannot be accepted", async ({ page, request }) => {
    const agency = await seedAgency();
    await expectLoginOk(request, agency.adminEmail);
    const email = uniqueEmail("expired");
    expect((await inviteViaApi(request, { email, orgRole: "agent", branchId: agency.branchId })).status).toBe(201);
    const token = await readInviteToken(email);
    await expireInviteToken(email);

    await page.goto(`/accept-invite?token=${token}`);
    await expect(page.getByRole("heading", { name: "Invitation unavailable" })).toBeVisible();
    await expect(page.getByText("This invitation has expired")).toBeVisible();

    const accept = await request.post("/api/v2/invites/accept", {
      data: { token, firstName: "Ivy", lastName: "Invited", phoneNumber: INVITE_PHONE, password: INVITE_PASSWORD },
    });
    expect(accept.status()).toBe(400);
    expect((await accept.json()).message).toBe("This invitation has expired");
    expect((await findUser(email))?.password).toBeNull();
  });

  test("a resent invitation works with the new link and the old link stops working", async ({ page, request }) => {
    const agency = await seedAgency();
    await expectLoginOk(request, agency.adminEmail);
    const email = uniqueEmail("resent");
    const sent = await inviteViaApi(request, { email, orgRole: "agent", branchId: agency.branchId });
    const oldToken = await readInviteToken(email);

    const resend = await request.post(`/api/v2/invites/${sent.data?.userId}/resend`);
    expect(resend.status()).toBe(200);
    const newToken = await readInviteToken(email);
    expect(newToken).not.toBe(oldToken);

    await page.goto(`/accept-invite?token=${oldToken}`);
    await expect(page.getByRole("heading", { name: "Invitation unavailable" })).toBeVisible();
    await page.goto(`/accept-invite?token=${newToken}`);
    await expect(page.getByTestId("form-accept-invite")).toBeVisible();
  });

  test("a revoked invitation can no longer be opened and the pending user is deleted", async ({ page, request }) => {
    const agency = await seedAgency();
    await expectLoginOk(request, agency.adminEmail);
    const email = uniqueEmail("revoked");
    const sent = await inviteViaApi(request, { email, orgRole: "agent", branchId: agency.branchId });
    const token = await readInviteToken(email);

    const revoke = await request.delete(`/api/v2/invites/${sent.data?.userId}`);
    expect(revoke.status()).toBe(200);
    expect(await findUser(email)).toBeUndefined();

    await page.goto(`/accept-invite?token=${token}`);
    await expect(page.getByRole("heading", { name: "Invitation unavailable" })).toBeVisible();
    await expect(page.getByText("Invalid or expired invitation")).toBeVisible();
  });

  test("an invitation can be used only once", async ({ request }) => {
    const agency = await seedAgency();
    await expectLoginOk(request, agency.adminEmail);
    const email = uniqueEmail("once");
    await inviteViaApi(request, { email, orgRole: "agent", branchId: agency.branchId });
    const token = await readInviteToken(email);

    expect(await acceptInviteViaApi(request, email)).toBe(200);
    const again = await request.post("/api/v2/invites/accept", {
      data: { token, firstName: "Eve", lastName: "Intruder", phoneNumber: INVITE_PHONE, password: "Another-Passw0rd!" },
    });
    expect(again.status()).toBe(400);
    expect((await findUser(email))?.firstName).toBe("Ivy");
  });

  test("an invitee cannot sign in before accepting", async ({ request }) => {
    const agency = await seedAgency();
    await expectLoginOk(request, agency.adminEmail);
    const email = uniqueEmail("early");
    await inviteViaApi(request, { email, orgRole: "agent", branchId: agency.branchId });

    const res = await loginViaApi(request, email, INVITE_PASSWORD);
    expect(res.status()).toBe(401);
  });

  test("an email that already has an account is refused with 409", async ({ request }) => {
    const agency = await seedAgency();
    const existing = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "agent" });
    await expectLoginOk(request, agency.adminEmail);

    const res = await inviteViaApi(request, { email: existing.email, orgRole: "agent", branchId: agency.branchId });
    expect(res.status).toBe(409);
    expect(res.message).toBe("A user with this email already exists");

    // The same goes for the owner's own address and for a different letter case.
    const owner = await inviteViaApi(request, { email: agency.adminEmail.toUpperCase(), orgRole: "agent", branchId: agency.branchId });
    expect(owner.status).toBe(409);
  });

  test("an email already invited for a different role is refused until the first invite is revoked", async ({ request }) => {
    const agency = await seedAgency();
    await expectLoginOk(request, agency.adminEmail);
    const email = uniqueEmail("twice");
    const first = await inviteViaApi(request, { email, orgRole: "agent", branchId: agency.branchId });
    expect(first.status).toBe(201);

    const clash = await inviteViaApi(request, { email, orgRole: "branch_manager", branchId: agency.branchId });
    expect(clash.status).toBe(409);
    expect(clash.message).toMatch(/pending invite for a different role/);
  });

  test("an invite to another organisation's branch is a 404", async ({ request }) => {
    const mine = await seedAgency();
    const other = await seedAgency();
    await expectLoginOk(request, mine.adminEmail);

    const res = await inviteViaApi(request, { email: uniqueEmail("foreign"), orgRole: "agent", branchId: other.branchId });
    expect(res.status).toBe(404);
  });

  test("when every seat is taken a new invite is refused with 409 'All N seats are in use'", async ({ request }) => {
    // Two seats: the owner and one pending invite.
    const agency = await seedAgency({ seatLimit: 2 });
    await expectLoginOk(request, agency.adminEmail);

    const first = await inviteViaApi(request, { email: uniqueEmail("seat1"), orgRole: "agent", branchId: agency.branchId });
    expect(first.status).toBe(201);

    const second = await inviteViaApi(request, { email: uniqueEmail("seat2"), orgRole: "agent", branchId: agency.branchId });
    expect(second.status).toBe(409);
    expect(second.message).toBe("All 2 seats are in use");

    const homeworker = await inviteViaApi(request, { email: uniqueEmail("seat3"), orgRole: "homeworker" });
    expect(homeworker.status).toBe(409);
  });

  test("a referral partner does not use a seat, so it can be invited when the seats are full", async ({ request }) => {
    const agency = await seedAgency({ seatLimit: 1 });
    await expectLoginOk(request, agency.adminEmail);

    const agent = await inviteViaApi(request, { email: uniqueEmail("full"), orgRole: "agent", branchId: agency.branchId });
    expect(agent.status).toBe(409);
    const referral = await inviteViaApi(request, { email: uniqueEmail("ref"), orgRole: "referral_agent", branchId: agency.branchId });
    expect(referral.status).toBe(201);
  });

  test("a branch manager sends an invite from the invite page (own branch is preset) and it shows as pending on the team page", async ({ page }) => {
    const agency = await seedAgency();
    const manager = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "branch_manager" });
    await expectLoginOk(page.request, manager.email);

    await page.goto("/agency/team/invite");
    await expect(page.getByTestId("invite-title")).toBeVisible();

    const email = uniqueEmail("ui");
    await page.getByLabel("First name, row 1").fill("Una");
    await page.getByLabel("Last name, row 1").fill("Interface");
    await page.getByLabel("Email, row 1").fill(email);
    await page.getByRole("combobox", { name: "Role, row 1" }).click();
    await page.getByRole("option", { name: "Agent", exact: true }).click();

    await expect(page.getByTestId("ready-count")).toHaveText("1 invite ready");
    await page.getByTestId("button-send-invites").click();

    await expectToast(page, "1 invite sent");
    await expect(page).toHaveURL(/\/agency\/team$/);
    await expect(page.getByText(email)).toBeVisible();

    const created = await findUser(email);
    expect(created?.orgRole).toBe("agent");
    expect(created?.firstName).toBe("Una");
    expect(created?.orgId).toBe(agency.orgId);
  });

  test("an owner can pick a branch in an invite row and carry on", async ({ page }) => {
    const agency = await seedAgency();
    await expectLoginOk(page.request, agency.adminEmail);

    await page.goto("/agency/team/invite");
    await expect(page.getByTestId("invite-title")).toBeVisible();
    await page.getByLabel("First name, row 1").fill("Una");
    await page.getByLabel("Last name, row 1").fill("Owner");
    await page.getByLabel("Email, row 1").fill(uniqueEmail("ui-owner"));
    await page.getByRole("combobox", { name: "Role, row 1" }).click();
    await page.getByRole("option", { name: "Agent", exact: true }).click();
    await page.getByRole("combobox", { name: "Branch, row 1" }).click();
    await page.getByRole("option").first().click();

    // The page survives and both triggers show what was chosen rather than a placeholder or nothing.
    await expect(page.getByTestId("invite-title")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Role, row 1" })).toHaveText("Agent");
    await expect(page.getByRole("combobox", { name: "Branch, row 1" })).not.toHaveText("Select branch");
    await expect(page.getByTestId("ready-count")).toHaveText("1 invite ready");

    await page.getByTestId("button-send-invites").click();
    await expectToast(page, "1 invite sent");
    await expect(page).toHaveURL(/\/agency\/team$/);
  });

  test("the invite page flags a row with a bad email and sends nothing", async ({ page }) => {
    const agency = await seedAgency();
    await expectLoginOk(page.request, agency.adminEmail);

    await page.goto("/agency/team/invite");
    await page.getByLabel("First name, row 1").fill("Bad");
    await page.getByLabel("Email, row 1").fill("not-an-email");
    await page.getByTestId("button-send-invites").click();
    await expect(page.getByTestId("invite-row-error-1")).toBeVisible();
    await expect(page).toHaveURL(/\/agency\/team\/invite$/);
    expect(await findUser("not-an-email")).toBeUndefined();
  });

  test.describe("accepting with bad details", () => {
    test("the accept button stays disabled for a short password or a missing phone number", async ({ page, request }) => {
      const agency = await seedAgency();
      await expectLoginOk(request, agency.adminEmail);
      const email = uniqueEmail("weak");
      await inviteViaApi(request, { email, orgRole: "agent", branchId: agency.branchId });
      const token = await readInviteToken(email);

      await page.goto(`/accept-invite?token=${token}`);
      await page.getByTestId("input-first-name").fill("Wes");
      await page.getByTestId("input-last-name").fill("Weak");
      await page.getByTestId("input-phone").fill(INVITE_PHONE);
      await page.getByTestId("input-password").fill("short7!");
      await expect(page.getByTestId("button-accept-invite")).toBeDisabled();

      await page.getByTestId("input-password").fill(INVITE_PASSWORD);
      await expect(page.getByTestId("button-accept-invite")).toBeEnabled();
      await page.getByTestId("input-phone").fill("");
      await expect(page.getByTestId("button-accept-invite")).toBeDisabled();
      await page.getByTestId("input-phone").fill("   ");
      await expect(page.getByTestId("button-accept-invite")).toBeDisabled();

      expect((await findUser(email))?.password).toBeNull();
    });

    test("the API refuses a weak password, a missing phone and missing names, and keeps the invite open", async ({ request }) => {
      const agency = await seedAgency();
      await expectLoginOk(request, agency.adminEmail);
      const email = uniqueEmail("api");
      await inviteViaApi(request, { email, orgRole: "agent", branchId: agency.branchId });
      const token = await readInviteToken(email);
      const base = { token, firstName: "Ivy", lastName: "Invited", phoneNumber: INVITE_PHONE, password: INVITE_PASSWORD };

      const weak = await request.post("/api/v2/invites/accept", { data: { ...base, password: "1234567" } });
      expect(weak.status()).toBe(400);
      expect((await weak.json()).message).toBe("Password must be at least 8 characters");

      const noPhone = await request.post("/api/v2/invites/accept", { data: { ...base, phoneNumber: "" } });
      expect(noPhone.status()).toBe(400);
      expect((await noPhone.json()).message).toBe("Phone number is required");

      const blankPhone = await request.post("/api/v2/invites/accept", { data: { ...base, phoneNumber: "   " } });
      expect(blankPhone.status()).toBe(400);

      const noFirst = await request.post("/api/v2/invites/accept", { data: { ...base, firstName: "" } });
      expect(noFirst.status()).toBe(400);
      const noLast = await request.post("/api/v2/invites/accept", { data: { ...base, lastName: "" } });
      expect(noLast.status()).toBe(400);

      // Still open after all those failures.
      expect((await findUser(email))?.inviteToken).toBe(token);
      expect(await acceptInviteViaApi(request, email)).toBe(200);
    });
  });

  test.describe("branch manager", () => {
    test("can invite agents into their own branch only", async ({ request }) => {
      const agency = await seedAgency();
      const otherBranch = await makeSecondBranch(agency.orgId);
      const manager = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "branch_manager" });
      await expectLoginOk(request, manager.email);

      const own = await inviteViaApi(request, { email: uniqueEmail("bmagent"), orgRole: "agent", branchId: agency.branchId });
      expect(own.status, own.raw).toBe(201);

      const elsewhere = await inviteViaApi(request, { email: uniqueEmail("bmother"), orgRole: "agent", branchId: otherBranch.id });
      expect(elsewhere.status).toBe(403);
      expect(elsewhere.message).toBe("You can only invite to your own branch");
    });

    test("cannot invite any other role: the API answers 403", async ({ request }) => {
      const agency = await seedAgency();
      const manager = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "branch_manager" });
      await expectLoginOk(request, manager.email);

      for (const role of ["branch_manager", "referral_agent", "social_media_manager"]) {
        const res = await inviteViaApi(request, { email: uniqueEmail(`bm-${role}`), orgRole: role, branchId: agency.branchId });
        expect(res.status, `${role}: ${res.raw}`).toBe(403);
        expect(res.message).toBe("Branch managers can only invite agents");
      }

      const homeworker = await inviteViaApi(request, { email: uniqueEmail("bm-hw"), orgRole: "homeworker" });
      expect(homeworker.status).toBe(403);
      expect(homeworker.message).toBe("Only organisation admins can invite homeworkers");
    });

    test("sees only Agent in the role list on the invite page", async ({ page }) => {
      const agency = await seedAgency();
      const manager = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "branch_manager" });
      await expectLoginOk(page.request, manager.email);

      await page.goto("/agency/team/invite");
      await expect(page.getByTestId("invite-title")).toBeVisible();
      await page.getByRole("combobox", { name: "Role, row 1" }).click();
      const options = page.getByRole("option");
      await expect(options).toHaveCount(1);
      await expect(options.first()).toHaveText("Agent");
    });

    test("cannot revoke an invite that belongs to another branch", async ({ request }) => {
      const agency = await seedAgency();
      const otherBranch = await makeSecondBranch(agency.orgId);
      const manager = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "branch_manager" });

      // The owner invites into the other branch; the manager then tries to revoke it.
      const ownerCtx = request;
      await expectLoginOk(ownerCtx, agency.adminEmail);
      const sent = await inviteViaApi(ownerCtx, { email: uniqueEmail("otherbranch"), orgRole: "agent", branchId: otherBranch.id });
      expect(sent.status).toBe(201);

      await expectLoginOk(request, manager.email);
      const res = await request.delete(`/api/v2/invites/${sent.data?.userId}`);
      expect(res.status()).toBe(403);
    });
  });

  test("a plain agent cannot send invites", async ({ request }) => {
    const agency = await seedAgency();
    const agent = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "agent" });
    await expectLoginOk(request, agent.email);

    const res = await inviteViaApi(request, { email: uniqueEmail("nope"), orgRole: "agent", branchId: agency.branchId });
    expect([401, 403]).toContain(res.status);
  });

  test("an anonymous caller cannot send invites", async ({ request }) => {
    const res = await inviteViaApi(request, { email: uniqueEmail("anon"), orgRole: "agent", branchId: "00000000-0000-4000-8000-000000000000" });
    expect(res.status).toBe(401);
  });
});
