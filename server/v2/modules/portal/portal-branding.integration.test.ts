import { describe, it, expect, beforeEach, vi } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "../../config/database";
import { portalLoginTokens } from "@shared/schema";
import { truncateAll, makeOrg, makeUser, makeClient, makeTransaction } from "../../test/factories";

// The real sender would reach SendSeven: it is replaced for every test in this file. The mock reserves the link
// the way the real one does, once a message is certain to be attempted.
vi.mock("./portal-pin-reset-sender", () => ({
  sendPinResetWhatsapp: vi.fn(async (input: { reserve: () => Promise<string | null> }) => {
    const link = await input.reserve();
    return link ? { status: "sent", viaTemplate: false } : { status: "skipped", reason: "capped" };
  }),
}));
// A site address for the link (the test environment has none).
vi.mock("../../utils/public-url", () => ({ getPublicBaseUrl: () => "https://portal.example" }));

import { portalBrandingService } from "./portal-branding.service";
import { pinResetTiming, portalPinResetLimiter, portalPinResetService } from "./portal-pin-reset.service";
import { sendPinResetWhatsapp } from "./portal-pin-reset-sender";

// DB-backed: proves the REAL SQL isolates agencies and that a reset writes exactly one login token.
// Written to run under `npm run test:integration` against the disposable test database.

let orgA: { id: string; slug: string };
let orgB: { id: string; slug: string };
let clientA: { id: string };
let agentA: { id: string };

beforeEach(async () => {
  await truncateAll();
  vi.clearAllMocks();
  pinResetTiming.minMs = 0;
  portalPinResetLimiter.clearAll();

  const a = await makeOrg({
    name: "Agency A",
    slug: "agency-a",
    brandColor: "#1a5fb4",
    logoUrl: "https://cdn.example.com/a.png",
    settings: { plan: "secret-a", profile: { phone: "0111 111 1111", atol: "ATOL-A" } },
  });
  const b = await makeOrg({
    name: "Agency B",
    slug: "agency-b",
    brandColor: "#b3261e",
    logoUrl: "https://cdn.example.com/b.png",
    settings: { profile: { phone: "0222 222 2222", abta: "ABTA-B" } },
  });
  orgA = a;
  orgB = b;
  agentA = await makeUser({ firstName: "Alice", lastName: "Alpha", orgId: a.id });
  clientA = await makeClient({ orgId: a.id, email: "ann@example.com", phoneNumber: "07700900123", portalPin: "hash" });
  await makeTransaction({ user_id: agentA.id, org_id: a.id, client_id: clientA.id, is_active: true, is_test: false });
});

describe("branding is isolated per agency", () => {
  it("by slug returns only that agency's allowlisted fields", async () => {
    const a = await portalBrandingService.getForSlug(orgA.slug);
    expect(a).toMatchObject({ name: "Agency A", brandColor: "#1a5fb4", phone: "0111 111 1111", atol: "ATOL-A" });
    const text = JSON.stringify(a);
    for (const other of ["Agency B", "0222 222 2222", "ABTA-B", "#b3261e", "b.png", "secret-a"]) {
      expect(text).not.toContain(other);
    }
    expect("agentName" in a).toBe(false);
  });

  it("an unknown slug and an inactive agency both get the neutral default", async () => {
    await makeOrg({ name: "Dormant", slug: "dormant", isActive: false, brandColor: "#123456" });
    for (const slug of ["nobody", "dormant"]) {
      expect(await portalBrandingService.getForSlug(slug)).toEqual({
        name: null, logoUrl: null, iconUrl: null, brandColor: null, phone: null, email: null, address: null,
      });
    }
  });

  it("signed in: the customer sees their own agency and their own agent's first name only", async () => {
    const mine = await portalBrandingService.getForClient(clientA.id);
    expect(mine.name).toBe("Agency A");
    expect(mine.agentName).toBe("Alice");
    expect(JSON.stringify(mine)).not.toContain("Agency B");
    expect(JSON.stringify(mine)).not.toContain("Alpha");
  });

  it("an agent from another agency is never named, and a test deal does not count", async () => {
    const stranger = await makeUser({ firstName: "Bob", lastName: "Beta", orgId: orgB.id });
    const lone = await makeClient({ orgId: orgA.id, email: "lone@example.com" });
    await makeTransaction({ user_id: stranger.id, org_id: orgB.id, client_id: lone.id, is_active: true, is_test: false });
    await makeTransaction({ user_id: agentA.id, org_id: orgA.id, client_id: lone.id, is_active: true, is_test: true });
    const out = await portalBrandingService.getForClient(lone.id);
    expect(out.name).toBe("Agency A");
    expect("agentName" in out).toBe(false);
  });
});

describe("pin reset", () => {
  const tokens = () => db.select().from(portalLoginTokens);

  it("writes exactly one login token for the customer and texts once", async () => {
    await portalPinResetService.processReset({ email: "ann@example.com", org: orgA.slug });
    const rows = await tokens();
    expect(rows).toHaveLength(1);
    expect(rows[0].clientId).toBe(clientA.id);
    expect(rows[0].used).toBe(false);
    expect(rows[0].source).toBe("pin_reset");
    expect(sendPinResetWhatsapp).toHaveBeenCalledTimes(1);
    expect(rows[0].code).toHaveLength(12);
  });

  it("an unknown email, or the right email under another agency, writes nothing", async () => {
    await portalPinResetService.processReset({ email: "ghost@example.com" });
    await portalPinResetService.processReset({ email: "ann@example.com", org: orgB.slug });
    expect(await tokens()).toHaveLength(0);
    expect(sendPinResetWhatsapp).not.toHaveBeenCalled();
  });

  it("the same email in two agencies with no agency named is ambiguous: nothing is written", async () => {
    await makeClient({ orgId: orgB.id, email: "ann@example.com", phoneNumber: "07700900124", portalPin: "hash" });
    await portalPinResetService.processReset({ email: "ann@example.com" });
    expect(await tokens()).toHaveLength(0);
    expect(sendPinResetWhatsapp).not.toHaveBeenCalled();
  });

  it("a suspended agency's customer gets nothing", async () => {
    const dormant = await makeOrg({ slug: "dormant", isActive: false });
    await makeClient({ orgId: dormant.id, email: "dora@example.com", phoneNumber: "07700900125", portalPin: "hash" });
    await portalPinResetService.processReset({ email: "dora@example.com" });
    expect(await tokens()).toHaveLength(0);
  });

  it("stops after 3 links per email per day", async () => {
    for (let i = 0; i < 5; i++) await portalPinResetService.processReset({ email: "ann@example.com", org: orgA.slug });
    expect(await tokens()).toHaveLength(3);
    expect(sendPinResetWhatsapp).toHaveBeenCalledTimes(3);
  });
});

describe("pin reset: durable caps count the minted links", () => {
  const mint = (clientId: string, n: number, source: string | null) =>
    Promise.all(
      Array.from({ length: n }, (_, i) =>
        db.execute(
          source
            ? sql`insert into portal_login_tokens (code, client_id, expires_at, source) values (${"c" + clientId.slice(0, 6) + i + Math.random().toString(36).slice(2, 6)}, ${clientId}, now() + interval '1 hour', ${source})`
            : sql`insert into portal_login_tokens (code, client_id, expires_at) values (${"s" + clientId.slice(0, 6) + i + Math.random().toString(36).slice(2, 6)}, ${clientId}, now() + interval '1 hour')`,
        ),
      ),
    );

  it("3 pin_reset links for the email stop a fourth even with an empty in-memory limiter (a restart)", async () => {
    await mint(clientA.id, 3, "pin_reset");
    await portalPinResetService.processReset({ email: "ann@example.com", org: orgA.slug });
    expect(await db.select().from(portalLoginTokens)).toHaveLength(3);
    expect(sendPinResetWhatsapp).not.toHaveBeenCalled();
  });

  it("staff-minted links (no source) do not count", async () => {
    await mint(clientA.id, 5, null);
    await portalPinResetService.processReset({ email: "ann@example.com", org: orgA.slug });
    expect(await db.select().from(portalLoginTokens)).toHaveLength(6);
    expect(sendPinResetWhatsapp).toHaveBeenCalledTimes(1);
  });

  it("20 pin_reset links across the agency stop any further customer of it", async () => {
    const other = await makeClient({ orgId: orgA.id, email: "other@example.com", phoneNumber: "07700900126", portalPin: "hash" });
    await mint(other.id, 20, "pin_reset");
    await portalPinResetService.processReset({ email: "ann@example.com", org: orgA.slug });
    expect(await db.select().from(portalLoginTokens)).toHaveLength(20);
  });

  it("a customer with no portal PIN is served", async () => {
    await makeClient({ orgId: orgA.id, email: "nopin@example.com", phoneNumber: "07700900127", portalPin: null });
    await portalPinResetService.processReset({ email: "nopin@example.com", org: orgA.slug });
    expect(await db.select().from(portalLoginTokens)).toHaveLength(1);
  });
});

describe("pin reset: atomic caps, scoping and who may ask", () => {
  const tokens = () => db.select().from(portalLoginTokens);

  it("25 concurrent requests at one agency (different emails) mint exactly 20 links", async () => {
    const emails = Array.from({ length: 25 }, (_, i) => `race${i}@example.com`);
    for (const [i, email] of emails.entries()) {
      await makeClient({ orgId: orgA.id, email, phoneNumber: `0770090${String(1000 + i)}`, portalPin: "hash" });
    }
    await Promise.all(emails.map((email) => portalPinResetService.processReset({ email, org: orgA.slug })));
    expect(await tokens()).toHaveLength(20);
  });

  it("the same email asking 6 times at once mints exactly 3", async () => {
    await Promise.all(Array.from({ length: 6 }, () => portalPinResetService.processReset({ email: "ann@example.com", org: orgA.slug })));
    expect(await tokens()).toHaveLength(3);
  });

  it("the per-email cap is per agency: a storm at agency A does not block the same email at agency B", async () => {
    const annB = await makeClient({ orgId: orgB.id, email: "shared@example.com", phoneNumber: "07700900300", portalPin: "hash" });
    const annA = await makeClient({ orgId: orgA.id, email: "shared@example.com", phoneNumber: "07700900301", portalPin: "hash" });
    for (let i = 0; i < 3; i++) {
      await db.execute(sql`insert into portal_login_tokens (code, client_id, expires_at, source) values (${"storm" + i}, ${annA.id}, now() + interval '1 hour', 'pin_reset')`);
    }
    await portalPinResetService.processReset({ email: "shared@example.com", org: orgB.slug });
    const rows = await tokens();
    expect(rows.filter((r) => r.clientId === annB.id)).toHaveLength(1);
  });

  it("a customer with no phone number gets nothing", async () => {
    const noPhone = await makeClient({ orgId: orgA.id, email: "nophone@example.com", phoneNumber: " ", portalPin: "hash" });
    await portalPinResetService.processReset({ email: "nophone@example.com", org: orgA.slug });
    expect((await tokens()).filter((r) => r.clientId === noPhone.id)).toHaveLength(0);
    expect(sendPinResetWhatsapp).not.toHaveBeenCalled();
  });
});

