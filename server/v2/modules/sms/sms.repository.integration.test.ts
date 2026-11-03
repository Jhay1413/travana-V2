import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../../config/database";
import { transaction } from "@shared/schema";
import { smsRepository } from "./sms.repository";
import { truncateAll, makeOrg, makeUser, makeClient, makeBooking } from "../../test/factories";

// Verifies the real booking lookups behind the SMS merge context.

let userId: string;
let clientId: string;
let otherClientId: string;

async function txn(clientIdFor: string, createdAt: string) {
  const [row] = await db
    .insert(transaction)
    .values({ user_id: userId, client_id: clientIdFor, created_at: new Date(createdAt) })
    .returning();
  return row;
}

beforeEach(async () => {
  await truncateAll();
  const org = await makeOrg();
  userId = (await makeUser({ orgId: org.id })).id;
  clientId = (await makeClient({ orgId: org.id, createdBy: userId })).id;
  otherClientId = (await makeClient({ orgId: org.id, createdBy: userId })).id;
});

describe("findActiveBookingForClient", () => {
  it("returns the named booking even when the client has a newer one", async () => {
    const july = await makeBooking({ transaction_id: (await txn(clientId, "2026-01-01")).id, travel_date: "2026-07-10", hays_ref: "JULY" });
    await makeBooking({ transaction_id: (await txn(clientId, "2026-02-01")).id, travel_date: "2026-12-10", hays_ref: "DEC" });

    const found = await smsRepository.findActiveBookingForClient(clientId, july.id);
    expect(found?.hays_ref).toBe("JULY");
  });

  it("refuses a booking that belongs to another client or is inactive", async () => {
    const theirs = await makeBooking({ transaction_id: (await txn(otherClientId, "2026-01-01")).id });
    const dead = await makeBooking({ transaction_id: (await txn(clientId, "2026-01-02")).id, is_active: false });

    expect(await smsRepository.findActiveBookingForClient(clientId, theirs.id)).toBeUndefined();
    expect(await smsRepository.findActiveBookingForClient(clientId, dead.id)).toBeUndefined();
  });
});

describe("findLatestActiveBookingForClient", () => {
  it("returns the booking of the newest transaction that has one", async () => {
    await makeBooking({ transaction_id: (await txn(clientId, "2026-01-01")).id, hays_ref: "OLD" });
    await makeBooking({ transaction_id: (await txn(clientId, "2026-02-01")).id, hays_ref: "NEW" });
    expect((await smsRepository.findLatestActiveBookingForClient(clientId))?.hays_ref).toBe("NEW");
  });

  it("is not blanked by a newer transaction that has no booking", async () => {
    await makeBooking({ transaction_id: (await txn(clientId, "2026-01-01")).id, hays_ref: "KEEP" });
    await txn(clientId, "2026-03-01"); // newest transaction, e.g. a quote only
    expect((await smsRepository.findLatestActiveBookingForClient(clientId))?.hays_ref).toBe("KEEP");
  });

  it("is undefined when the client has no active booking", async () => {
    await txn(clientId, "2026-03-01");
    expect(await smsRepository.findLatestActiveBookingForClient(clientId)).toBeUndefined();
  });
});
