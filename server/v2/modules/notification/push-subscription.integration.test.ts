import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../../config/database";
import { pushSubscriptions } from "@shared/schema";
import { truncateAll, makeOrg, makeClient } from "../../test/factories";
import { pushSubscriptionRepository } from "./push-subscription.repository";

// DB-backed (written for `npm run test:integration`, against the disposable test database): the REAL join keeps
// one agency's deal notification away from another agency's customers.

async function subscribe(clientId: string, endpoint: string) {
  await db.insert(pushSubscriptions).values({ clientId, endpoint, p256dh: "p", auth: "a" });
}

beforeEach(async () => {
  await truncateAll();
});

describe("pushSubscriptionRepository.findByOrgId (real database)", () => {
  it("returns only the given agency's customers' subscriptions", async () => {
    const orgA = await makeOrg({ slug: "push-a" });
    const orgB = await makeOrg({ slug: "push-b" });
    const a = await makeClient({ orgId: orgA.id });
    const b = await makeClient({ orgId: orgB.id });
    await subscribe(a.id, "https://push/a");
    await subscribe(b.id, "https://push/b");
    expect((await pushSubscriptionRepository.findByOrgId(orgA.id)).map((s) => s.endpoint)).toEqual(["https://push/a"]);
    expect((await pushSubscriptionRepository.findByOrgId(orgB.id)).map((s) => s.endpoint)).toEqual(["https://push/b"]);
  });

  it("a customer with no agency, or a removed customer, is never returned", async () => {
    const org = await makeOrg({ slug: "push-c" });
    const noAgency = await makeClient({});
    const gone = await makeClient({ orgId: org.id, deletedAt: new Date() });
    await subscribe(noAgency.id, "https://push/none");
    await subscribe(gone.id, "https://push/gone");
    expect(await pushSubscriptionRepository.findByOrgId(org.id)).toEqual([]);
  });
});
