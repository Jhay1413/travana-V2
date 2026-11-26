import { describe, it, expect, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { portalRepository } from "./portal.repository";
import { portalDealsService } from "./portal-deals.service";
import { portalAuthService, INVALID_CREDENTIALS_MESSAGE } from "./portal-auth.service";
import { portalWebauthnService } from "./portal-webauthn.service";
import { signPortalToken } from "./portal-auth";
import { eq } from "drizzle-orm";
import { db } from "../../config/database";
import { webauthnCredentials } from "@shared/schema";
import {
  truncateAll, makeOrg, makeUser, makeClient, makeTransaction, makeQuote, makeBooking,
} from "../../test/factories";

// DB-backed: proves the REAL SQL isolates agencies. Written to run under
// `npm run test:integration` against the disposable test database.

let orgA: { id: string; slug: string };
let orgB: { id: string; slug: string };
let clientA: { id: string };
let clientB: { id: string };
let orphan: { id: string };
let dealA: { id: string };
let dealB: { id: string };

const bearer = (clientId: string) => `Bearer ${signPortalToken({ clientId, email: "" })}`;
const base = { recent: false, interests: false } as const;

async function portalDeal(orgId: string, userId: string, title: string) {
  const txn = await makeTransaction({ user_id: userId, org_id: orgId });
  return makeQuote({
    transaction_id: txn.id,
    title,
    is_active: true,
    quote_token: `tok-${title}`,
    show_on_portal: true,
    isFreeQuote: true,
    portal_added_at: new Date(),
  });
}

beforeEach(async () => {
  await truncateAll();
  orgA = await makeOrg({ slug: "agency-a" });
  orgB = await makeOrg({ slug: "agency-b" });
  const agentA = await makeUser();
  const agentB = await makeUser();
  clientA = await makeClient({ orgId: orgA.id });
  clientB = await makeClient({ orgId: orgB.id });
  orphan = await makeClient({ orgId: null });
  dealA = await portalDeal(orgA.id, agentA.id, "dealA");
  dealB = await portalDeal(orgB.id, agentB.id, "dealB");
});

describe("deals are isolated per agency", () => {
  it("a client of agency A sees only agency A's deals (and B's client only B's)", async () => {
    const a = await portalDealsService.listDeals({ ...base, authorizationHeader: bearer(clientA.id) });
    const b = await portalDealsService.listDeals({ ...base, authorizationHeader: bearer(clientB.id) });
    expect(a.map((d) => d.id)).toEqual([dealA.id]);
    expect(b.map((d) => d.id)).toEqual([dealB.id]);
  });

  it("a session cannot be widened to another agency with ?org=", async () => {
    const a = await portalDealsService.listDeals({ ...base, authorizationHeader: bearer(clientA.id), orgSlug: orgB.slug });
    expect(a.map((d) => d.id)).toEqual([dealA.id]);
  });

  it("without a session, the org slug scopes to that agency only", async () => {
    const b = await portalDealsService.listDeals({ ...base, authorizationHeader: undefined, orgSlug: orgB.slug });
    expect(b.map((d) => d.id)).toEqual([dealB.id]);
  });

  it("no session and no slug sees nothing; an unknown slug sees nothing", async () => {
    expect(await portalDealsService.listDeals({ ...base, authorizationHeader: undefined })).toEqual([]);
    expect(await portalDealsService.listDeals({ ...base, authorizationHeader: undefined, orgSlug: "nope" })).toEqual([]);
  });

  it("a client with a null orgId sees no deals", async () => {
    expect(await portalDealsService.listDeals({ ...base, authorizationHeader: bearer(orphan.id) })).toEqual([]);
  });

  it("deal filters never include another agency's countries or tags", async () => {
    const filtersA = await portalRepository.findDealFilters(orgA.id);
    const filtersEmpty = await portalDealsService.getDealFilters({ authorizationHeader: undefined });
    expect(filtersEmpty).toEqual({ countries: [], popularTags: [] });
    expect(filtersA.popularTags).toEqual([]);
  });

  it("for-you is scoped to the client's agency", async () => {
    // No saved tags -> empty, but never another agency's deals.
    expect(await portalDealsService.listForYouDeals(clientA.id, false)).toEqual([]);
    expect(await portalDealsService.listForYouDeals(orphan.id, false)).toEqual([]);
  });
});

describe("login across agencies with the same email", () => {
  const email = "shared@example.com";

  beforeEach(async () => {
    await makeClient({ orgId: orgA.id, email, portalPin: await bcrypt.hash("1111", 4) });
    await makeClient({ orgId: orgB.id, email, portalPin: await bcrypt.hash("2222", 4) });
  });

  it("without a slug, the agency whose PIN matches signs in", async () => {
    const r = await portalAuthService.login({ email, pin: "2222" });
    const org = await portalRepository.findClientOrg(r.clientId);
    expect(org?.orgId).toBe(orgB.id);
  });

  it("with a slug, only that agency's client can sign in", async () => {
    const ok = await portalAuthService.login({ email, pin: "1111", orgSlug: orgA.slug });
    expect((await portalRepository.findClientOrg(ok.clientId))?.orgId).toBe(orgA.id);
    await expect(portalAuthService.login({ email, pin: "2222", orgSlug: orgA.slug })).rejects.toMatchObject({
      statusCode: 401,
      message: INVALID_CREDENTIALS_MESSAGE,
    });
  });

  it("a PIN-less duplicate never shadows the row that has a PIN", async () => {
    const noPin = await makeClient({ orgId: orgA.id, email: "dup@example.com", portalPin: null });
    const withPin = await makeClient({ orgId: orgA.id, email: "dup@example.com", portalPin: await bcrypt.hash("3333", 4) });
    const r = await portalAuthService.login({ email: "dup@example.com", pin: "3333", orgSlug: orgA.slug });
    expect(r.clientId).toBe(withPin.id);
    expect(r.clientId).not.toBe(noPin.id);
  });

  it("an unknown email and a wrong PIN are indistinguishable", async () => {
    const unknown = await portalAuthService.login({ email: "ghost@example.com", pin: "1111" }).catch((e: Error) => e.message);
    const wrong = await portalAuthService.login({ email, pin: "0000" }).catch((e: Error) => e.message);
    expect(unknown).toBe(wrong);
  });
});

describe("bookings", () => {
  it("LOST bookings are not listed; BOOKED and unset-status ones are", async () => {
    const agent = await makeUser();
    const txn = await makeTransaction({ user_id: agent.id, org_id: orgA.id, client_id: clientA.id });
    const booked = await makeBooking({ transaction_id: txn.id, is_active: true, booking_status: "BOOKED" });
    const unset = await makeBooking({ transaction_id: txn.id, is_active: true, booking_status: null });
    await makeBooking({ transaction_id: txn.id, is_active: true, booking_status: "LOST" });

    const rows = await portalRepository.findClientBookings(clientA.id);
    expect(rows.map((r) => r.bookingId).sort()).toEqual([booked.id, unset.id].sort());
  });
});

describe("Face ID login", () => {
  const rp = { rpID: "localhost", origin: "http://localhost:5000" };

  it("rejects a bad signature for a real, verified credential, and issues no session", async () => {
    await db.insert(webauthnCredentials).values({
      clientId: clientA.id,
      credentialId: "cred-integration",
      publicKey: Buffer.from([1, 2, 3, 4]).toString("base64url"),
      counter: 0,
      verifiedAt: new Date(),
    });
    const { challengeToken } = await portalWebauthnService.loginOptions(rp);

    await expect(
      portalWebauthnService.login(
        {
          challengeToken,
          response: {
            id: "cred-integration",
            rawId: "cred-integration",
            type: "public-key",
            clientExtensionResults: {},
            response: { clientDataJSON: "e30", authenticatorData: "AAAA", signature: "AAAA" },
          },
        },
        rp,
      ),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("a legacy credential (no verified key) cannot sign in", async () => {
    await db.insert(webauthnCredentials).values({
      clientId: clientA.id, credentialId: "cred-legacy", publicKey: "platform-verified", counter: 0,
    });
    const { challengeToken } = await portalWebauthnService.loginOptions(rp);
    await expect(
      portalWebauthnService.login(
        {
          challengeToken,
          response: {
            id: "cred-legacy", rawId: "cred-legacy", type: "public-key", clientExtensionResults: {},
            response: { clientDataJSON: "e30", authenticatorData: "AAAA", signature: "AAAA" },
          },
        },
        rp,
      ),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(await portalRepository.findWebauthnCredentialIdsForClient(clientA.id)).toEqual([]);
  });
});

describe("Face ID enrolment storage", () => {
  const add = (clientId: string, credentialId: string) =>
    portalRepository.replaceWebauthnCredential(5, {
      clientId, credentialId, publicKey: "k", counter: 0, transports: ["internal"], deviceName: "Device",
    });

  it("keeps at most 5 verified credentials per customer, replacing the oldest", async () => {
    for (let i = 1; i <= 7; i++) await add(clientA.id, `cred-${i}`);
    const rows = await db.select().from(webauthnCredentials).where(eq(webauthnCredentials.clientId, clientA.id));
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.credentialId).sort()).toEqual(["cred-3", "cred-4", "cred-5", "cred-6", "cred-7"]);
  });

  it("re-enrolling replaces legacy rows and a row with the same credential id", async () => {
    await db.insert(webauthnCredentials).values({ clientId: clientA.id, credentialId: "legacy", publicKey: "platform-verified", counter: 0 });
    await add(clientA.id, "fresh");
    await add(clientA.id, "fresh");
    const rows = await db.select().from(webauthnCredentials).where(eq(webauthnCredentials.clientId, clientA.id));
    expect(rows.map((r) => r.credentialId)).toEqual(["fresh"]);
  });
});
