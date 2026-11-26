// Needs a live Postgres with the customer_message_log table: run with `npm run test:integration`.
// Written, not run by `npm test`.
import { describe, it, expect, beforeEach } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "../../config/database";
import { smsTemplatesTable, userOrgRoles } from "@shared/schema";
import { customerMessagingRepository as repo } from "./customer-messaging.repository";
import { whatsappSettingsRepository } from "../whatsapp-templates/whatsapp-settings.repository";
import { organizationRepository } from "../organization/organization.repository";
import { makeBranch, makeClient, makeOrg, makeUser, truncateAll } from "../../test/factories";

let orgA: { id: string };
let orgB: { id: string };
let clientA: { id: string };
let clientB: { id: string };

const hours = (n: number) => new Date(Date.now() + n * 3_600_000);

beforeEach(async () => {
  await truncateAll();
  await db.execute(sql`truncate table customer_message_log`);
  orgA = await makeOrg();
  orgB = await makeOrg();
  clientA = await makeClient({ orgId: orgA.id });
  clientB = await makeClient({ orgId: orgB.id });
});

const sent = (orgId: string, clientId: string, over: Record<string, unknown> = {}) =>
  repo.insertLog({ orgId, clientId, purpose: "booking_confirmation", channel: "whatsapp", status: "sent", dedupeKey: "booking_confirmation", ...over });
const probe = (orgId: string, clientId: string, since: Date, over: Record<string, string> = {}) =>
  repo.hasRecentSent({ orgId, clientId, purpose: "booking_confirmation", dedupeKey: "booking_confirmation", since, ...over });

describe("customer_message_log: one row per outcome", () => {
  it("stores sent and skipped rows with every column the owner asked for", async () => {
    await sent(orgA.id, clientA.id, { templateName: "booking_ok", triggerSource: "booking.createBooking", providerMessageId: "m1" });
    await repo.insertLog({ orgId: orgA.id, clientId: clientA.id, purpose: "portal_ready", channel: "sms", status: "skipped", reason: "opted_out" });
    const rows = (await db.execute(sql`select * from customer_message_log order by created_at`)).rows as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ org_id: orgA.id, client_id: clientA.id, purpose: "booking_confirmation", channel: "whatsapp", status: "sent", reason: null, template_name: "booking_ok", trigger_source: "booking.createBooking", provider_message_id: "m1", dedupe_key: "booking_confirmation" });
    expect(rows[1]).toMatchObject({ channel: "sms", status: "skipped", reason: "opted_out", triggered_by: null });
    expect(rows[0].id).toBeTruthy();
    expect(rows[0].created_at).toBeInstanceOf(Date);
  });
});

describe("duplicate guard windows", () => {
  it("a send inside the window is a duplicate; one before it is not", async () => {
    await sent(orgA.id, clientA.id);
    expect(await probe(orgA.id, clientA.id, hours(-0.0833))).toBe(true); // 5 minutes ago (event triggers)
    expect(await probe(orgA.id, clientA.id, hours(1))).toBe(false); // window starts in the future
  });

  it("the sweep's one-UK-day window counts today's send and ignores yesterday's", async () => {
    await sent(orgA.id, clientA.id, { dedupeKey: "departure_reminder:bk1", purpose: "departure_reminder" });
    await db.execute(sql`update customer_message_log set created_at = now() - interval '30 hours'`);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    expect(await probe(orgA.id, clientA.id, startOfToday, { purpose: "departure_reminder", dedupeKey: "departure_reminder:bk1" })).toBe(false);
    await sent(orgA.id, clientA.id, { dedupeKey: "departure_reminder:bk1", purpose: "departure_reminder" });
    expect(await probe(orgA.id, clientA.id, startOfToday, { purpose: "departure_reminder", dedupeKey: "departure_reminder:bk1" })).toBe(true);
  });

  it("only sent rows count: a skipped or failed attempt never blocks a retry", async () => {
    await repo.insertLog({ orgId: orgA.id, clientId: clientA.id, purpose: "booking_confirmation", channel: "whatsapp", status: "skipped", reason: "send_failed", dedupeKey: "booking_confirmation" });
    expect(await probe(orgA.id, clientA.id, hours(-1))).toBe(false);
  });

  it("is per message type, per key and per client", async () => {
    await sent(orgA.id, clientA.id, { dedupeKey: "departure_reminder:bk1", purpose: "departure_reminder" });
    expect(await probe(orgA.id, clientA.id, hours(-1), { purpose: "departure_reminder", dedupeKey: "departure_reminder:bk2" })).toBe(false);
    expect(await probe(orgA.id, clientA.id, hours(-1))).toBe(false);
    const other = await makeClient({ orgId: orgA.id });
    expect(await probe(orgA.id, other.id, hours(-1), { purpose: "departure_reminder", dedupeKey: "departure_reminder:bk1" })).toBe(false);
  });
});

describe("cross-agency isolation", () => {
  it("one agency's log never makes another agency's send a duplicate", async () => {
    await sent(orgA.id, clientA.id);
    expect(await probe(orgB.id, clientA.id, hours(-1))).toBe(false); // wrong org for that client
    expect(await probe(orgB.id, clientB.id, hours(-1))).toBe(false);
    expect(await probe(orgA.id, clientA.id, hours(-1))).toBe(true);
  });

  it("each agency has its own channel setting", async () => {
    await organizationRepository.mergeSettingsSection(orgA.id, "messaging", { autoChannel: "sms" });
    const a = await organizationRepository.findById(orgA.id);
    const b = await organizationRepository.findById(orgB.id);
    expect((a?.settings as Record<string, unknown>).messaging).toEqual({ autoChannel: "sms" });
    expect((b?.settings as Record<string, unknown> | null)?.messaging).toBeUndefined();
  });

  it("each agency has its own message-type templates, and saving one type keeps the others", async () => {
    const cfg = (name: string) => ({ templateName: name, language: "en", channelId: "ch", variables: { "1": { source: "client_first_name" as const } } });
    await whatsappSettingsRepository.upsertPurposeTemplate(orgA.id, "booking_confirmation", cfg("a_booking"), null);
    await whatsappSettingsRepository.upsertPurposeTemplate(orgA.id, "portal_ready", cfg("a_portal"), null);
    await whatsappSettingsRepository.upsertPurposeTemplate(orgB.id, "booking_confirmation", cfg("b_booking"), null);
    expect(Object.keys(await whatsappSettingsRepository.findPurposeTemplatesByOrg(orgA.id)).sort()).toEqual(["booking_confirmation", "portal_ready"]);
    expect((await whatsappSettingsRepository.findPurposeTemplatesByOrg(orgA.id)).booking_confirmation?.templateName).toBe("a_booking");
    expect((await whatsappSettingsRepository.findPurposeTemplatesByOrg(orgB.id)).booking_confirmation?.templateName).toBe("b_booking");
    expect(await whatsappSettingsRepository.findPurposeTemplatesByOrg(orgB.id)).not.toHaveProperty("portal_ready");
  });

  it("the switch rows (active SMS templates) are the agency's own", async () => {
    await db.insert(smsTemplatesTable).values([
      { orgId: orgA.id, name: "A on", body: "x", autoTrigger: "on_booking_create", active: true },
      { orgId: orgA.id, name: "A off", body: "x", autoTrigger: "on_pin_set", active: false },
      { orgId: orgB.id, name: "B on", body: "x", autoTrigger: "on_pin_set", active: true },
    ]);
    const a = await repo.listActiveSwitchRows(orgA.id);
    expect(a.map((r) => r.autoTrigger)).toEqual(["on_booking_create"]);
    expect((await repo.listActiveSwitchRows(orgB.id)).map((r) => r.autoTrigger)).toEqual(["on_pin_set"]);
  });
});

describe("handled by a homeworker", () => {
  it("is true for a homeworker branch of this agency, and false for a shop branch or another agency's branch", async () => {
    const shop = await makeBranch(orgA.id, { branchType: "shop" });
    const hw = await makeBranch(orgA.id, { branchType: "homeworker" });
    const foreign = await makeBranch(orgB.id, { branchType: "homeworker" });
    expect(await repo.hasHomeworkerOwner({ orgId: orgA.id, branchIds: [hw.id], userIds: [] })).toBe(true);
    expect(await repo.hasHomeworkerOwner({ orgId: orgA.id, branchIds: [shop.id], userIds: [] })).toBe(false);
    expect(await repo.hasHomeworkerOwner({ orgId: orgA.id, branchIds: [foreign.id], userIds: [] })).toBe(false);
  });

  it("is true for a user holding the homeworker role in this agency only", async () => {
    const u = await makeUser();
    await db.insert(userOrgRoles).values({ userId: u.id, orgId: orgA.id, role: "homeworker" });
    expect(await repo.hasHomeworkerOwner({ orgId: orgA.id, branchIds: [], userIds: [u.id] })).toBe(true);
    expect(await repo.hasHomeworkerOwner({ orgId: orgB.id, branchIds: [], userIds: [u.id] })).toBe(false);
  });
});

describe("reserving a send (the duplicate race)", () => {
  const reserve = (orgId: string, clientId: string, over: Record<string, unknown> = {}, since = hours(-1)) =>
    repo.reserveSend({
      since,
      row: { orgId, clientId, purpose: "booking_confirmation", channel: "whatsapp", status: "pending", dedupeKey: "booking_confirmation:bk1", ...over },
    });

  it("two requests at the same moment: exactly one gets the reservation", async () => {
    const results = await Promise.all([reserve(orgA.id, clientA.id), reserve(orgA.id, clientA.id), reserve(orgA.id, clientA.id)]);
    expect(results.filter((r) => r !== null)).toHaveLength(1);
    const rows = (await db.execute(sql`select status from customer_message_log`)).rows as { status: string }[];
    expect(rows).toEqual([{ status: "pending" }]);
  });

  it("a pending row blocks a repeat inside the window, on either channel, and stops blocking once the window has passed", async () => {
    expect(await reserve(orgA.id, clientA.id)).not.toBeNull();
    expect(await reserve(orgA.id, clientA.id, { channel: "sms" })).toBeNull(); // the agency switched channel
    expect(await probe(orgA.id, clientA.id, hours(-1), { dedupeKey: "booking_confirmation:bk1" })).toBe(true); // pending counts for the early check too
    await db.execute(sql`update customer_message_log set created_at = now() - interval '10 minutes'`);
    expect(await reserve(orgA.id, clientA.id, {}, new Date(Date.now() - 5 * 60_000))).not.toBeNull(); // a crash left it pending; only the window is blocked
  });

  it("a settled-as-skipped row does not block; a settled-as-sent one does", async () => {
    const first = await reserve(orgA.id, clientA.id);
    await repo.finalizeLog(first!.id, { status: "skipped", reason: "send_failed", templateName: null, providerMessageId: null });
    const second = await reserve(orgA.id, clientA.id);
    expect(second).not.toBeNull();
    await repo.finalizeLog(second!.id, { status: "sent", reason: null, templateName: "t", providerMessageId: "m" });
    expect(await reserve(orgA.id, clientA.id)).toBeNull();
  });

  it("two bookings of one client each get their own reservation; another agency's client is separate", async () => {
    expect(await reserve(orgA.id, clientA.id, { dedupeKey: "booking_confirmation:bk1" })).not.toBeNull();
    expect(await reserve(orgA.id, clientA.id, { dedupeKey: "booking_confirmation:bk2" })).not.toBeNull();
    expect(await reserve(orgB.id, clientB.id, { dedupeKey: "booking_confirmation:bk1" })).not.toBeNull();
  });
});

describe("listLogForClient: the client page's message history", () => {
  it("returns this agency's rows for this client, newest first, with the name of who pressed send", async () => {
    const staff = await makeUser({ orgId: orgA.id });
    await sent(orgA.id, clientA.id, { purpose: "booking_confirmation" });
    await db.execute(sql`update customer_message_log set created_at = now() - interval '1 hour'`);
    await sent(orgA.id, clientA.id, { purpose: "quote_link", channel: "sms", triggerSource: "staff", triggeredBy: staff.id });
    const rows = await repo.listLogForClient({ orgId: orgA.id, clientId: clientA.id, limit: 10, offset: 0 });
    expect(rows.map((r) => r.purpose)).toEqual(["quote_link", "booking_confirmation"]);
    expect(rows[0].triggeredByName).toBeTruthy();
    expect(rows[1].triggeredByName).toBeNull();
    expect(Object.keys(rows[0]).sort()).toEqual(["channel", "createdAt", "id", "purpose", "reason", "status", "templateName", "triggerSource", "triggeredByName"]);
  });

  it("never returns another agency's rows, even when asked with the other agency's client id", async () => {
    await sent(orgB.id, clientB.id);
    expect(await repo.listLogForClient({ orgId: orgA.id, clientId: clientB.id, limit: 10, offset: 0 })).toEqual([]);
    expect(await repo.listLogForClient({ orgId: orgA.id, clientId: clientA.id, limit: 10, offset: 0 })).toEqual([]);
  });

  it("pages with limit and offset without repeating or skipping a row", async () => {
    for (let i = 0; i < 5; i++) await sent(orgA.id, clientA.id, { dedupeKey: `k${i}` });
    const first = await repo.listLogForClient({ orgId: orgA.id, clientId: clientA.id, limit: 3, offset: 0 });
    const second = await repo.listLogForClient({ orgId: orgA.id, clientId: clientA.id, limit: 3, offset: 3 });
    expect(first).toHaveLength(3);
    expect(second).toHaveLength(2);
    expect(new Set([...first, ...second].map((r) => r.id)).size).toBe(5);
  });
});
