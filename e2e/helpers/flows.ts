import type { APIRequestContext, Page } from "@playwright/test";
import { expect, newSignup, signupViaApi, type SignupInput, expectLoginOk, loginViaUi } from "./fixtures";
import { readInviteToken, readVerificationToken, requireUser, seedMember, type SeededAgency } from "./seed";

export const INVITE_PHONE = "07700900456";
export const INVITE_PASSWORD = "Invited-Passw0rd!";

export interface PendingOwner extends SignupInput {
  userId: string;
  orgId: string;
}

/** Signs up through the API and clicks the "email link" (reads the token from the database). Leaves onboarding pending. */
export async function createVerifiedOwner(request: APIRequestContext, overrides: Partial<SignupInput> = {}): Promise<PendingOwner> {
  const input = newSignup(overrides);
  const res = await signupViaApi(request, input);
  expect(res.status(), await res.text()).toBe(201);
  const token = await readVerificationToken(input.email);
  const verify = await request.get(`/api/v2/onboarding/verify-email?token=${token}`);
  expect(verify.status(), await verify.text()).toBe(200);
  const row = await requireUser(input.email);
  return { ...input, userId: row.id, orgId: row.orgId as string };
}

/** Sends an invite as the signed-in user (the request context must hold the inviter's session). */
export async function inviteViaApi(
  request: APIRequestContext,
  body: Record<string, unknown>,
): Promise<{ status: number; message: string; data: { userId?: string } | null; raw: string }> {
  const res = await request.post("/api/v2/invites", { data: body });
  const raw = await res.text();
  let parsed: { message?: string; data?: { userId?: string } } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // not JSON; leave empty
  }
  return { status: res.status(), message: parsed.message ?? "", data: parsed.data ?? null, raw };
}

/** Accepts an invite through the public API. */
export async function acceptInviteViaApi(
  request: APIRequestContext,
  email: string,
  overrides: Record<string, string> = {},
): Promise<number> {
  const token = await readInviteToken(email);
  const res = await request.post("/api/v2/invites/accept", {
    data: { token, firstName: "Ivy", lastName: "Invited", phoneNumber: INVITE_PHONE, password: INVITE_PASSWORD, ...overrides },
  });
  return res.status();
}

/**
 * Seeds a person who has accepted an invite already: invite as `admin`, accept through the API.
 * Returns their email. Their password is INVITE_PASSWORD.
 */
export async function inviteAndAccept(
  request: APIRequestContext,
  agency: SeededAgency,
  role: string,
  email: string,
  withBranch = true,
): Promise<string> {
  const body: Record<string, unknown> = { email, orgRole: role };
  if (role !== "homeworker" && withBranch) body.branchId = agency.branchId;
  const sent = await inviteViaApi(request, body);
  expect(sent.status, sent.raw).toBe(201);
  expect(await acceptInviteViaApi(request, email)).toBe(200);
  return email;
}

/** Signs in through the form and waits for the app to leave the sign-in screen. */
export async function signInThroughForm(page: Page, email: string, password: string): Promise<void> {
  await loginViaUi(page, email, password);
  await expect(page.getByTestId("button-login")).toBeHidden();
}

export { expectLoginOk, seedMember };
