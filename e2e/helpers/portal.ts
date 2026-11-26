/**
 * Helpers for the customer-portal specs. Setup only (rows are written straight to the practice
 * database); the specs assert through the real screens and the portal's own endpoints.
 */
import "./test-db-env";
import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { db } from "../../server/v2/config/database";
import { clientTags, portalLoginTokens, tags } from "../../shared/schema";
import { makeClient, makeOrg } from "../../server/v2/test/factories";
import { expect } from "./fixtures";
import { unique } from "./seed";

export const PORTAL_PIN = "4821";
export const PORTAL_PHONE = "07700900123";

export interface PortalSetup {
  orgId: string;
  slug: string;
  orgName: string;
  clientId: string;
  email: string;
  pin: string;
  tagName: string;
}

export interface PortalSetupOptions {
  brandColor?: string | null;
  /** Must be same-origin: the browser is not allowed to reach anywhere else. */
  logoUrl?: string | null;
  /** Give the customer a saved travel interest, so the shell does not send them to the interests page. */
  withInterest?: boolean;
  phone?: string;
  atol?: string;
  abta?: string;
  /** Overrides the customer's surname (a long one tests the hero at 360px). */
  surname?: string;
  /** The customer is still on a system-seeded PIN and must choose their own at the PIN gate. */
  mustChangePin?: boolean;
  /** Overrides the agency name (a long one wraps in the header). */
  orgName?: string;
}

/** An agency with a portal-ready customer (PIN 4821, a phone number, one saved interest). */
export async function seedPortalCustomer(opts: PortalSetupOptions = {}): Promise<PortalSetup> {
  const tag = unique("pt").toLowerCase().replace(/[^a-z0-9]/g, "");
  const slug = `portal-${tag}`;
  const orgName = opts.orgName ?? `Sunny ${tag}`;
  const org = await makeOrg({
    name: orgName,
    slug,
    brandColor: opts.brandColor ?? null,
    logoUrl: opts.logoUrl ?? null,
    settings: { profile: { phone: "01234 567890", email: `hello-${tag}@e2e.test`, atol: opts.atol, abta: opts.abta } },
  });
  const email = `cust-${tag}@e2e.test`;
  const client = await makeClient({
    firstName: "Pat",
    surename: opts.surname ?? `Portal${tag}`,
    email,
    phoneNumber: opts.phone ?? PORTAL_PHONE,
    orgId: org.id,
    portalPin: await bcrypt.hash(PORTAL_PIN, 4),
    mustChangePin: opts.mustChangePin ?? false,
  });
  // One tag always exists (so the interests page has something to pick); it is linked unless the test wants a customer with none.
  const [t] = await db.insert(tags).values({ name: `Beaches ${tag}` }).returning();
  if (opts.withInterest !== false) await db.insert(clientTags).values({ id: randomUUID(), clientId: client.id, tagId: t.id });
  return { orgId: org.id, slug, orgName, clientId: client.id, email, pin: PORTAL_PIN, tagName: t.name };
}

/** Signs the customer in through the portal's own endpoint and starts the page already signed in. */
export async function startSignedIn(page: Page, setup: PortalSetup): Promise<void> {
  const res = await page.request.post("/api/v2/portal/login", { data: { email: setup.email, pin: setup.pin, org: setup.slug } });
  expect(res.status(), await res.text()).toBe(200);
  const { token, clientId } = (await res.json()) as { token: string; clientId: string };
  await page.addInitScript(
    ([t, id]) => {
      localStorage.setItem("portal_token", t);
      localStorage.setItem("portal_client_id", id);
      // The install wizard opens by itself once per device; it would sit on top of the tab bar.
      localStorage.setItem("portal_setup_wizard_done", "1");
      sessionStorage.setItem("portal_push_banner_dismissed", "1");
    },
    [token, clientId],
  );
}

/** A single-use sign-in code for this customer, as the staff and reset texts mint (12 characters, valid for an hour). */
export async function mintLoginCode(clientId: string): Promise<string> {
  const code = randomUUID().replace(/-/g, "").slice(0, 12);
  await db.insert(portalLoginTokens).values({ code, clientId, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  return code;
}

/** Gives an existing customer one saved travel interest, so the portal does not send them to the interests page. */
export async function addInterest(clientId: string): Promise<void> {
  const [t] = await db.insert(tags).values({ name: `Beaches ${unique("it")}` }).returning();
  await db.insert(clientTags).values({ id: randomUUID(), clientId, tagId: t.id });
}
