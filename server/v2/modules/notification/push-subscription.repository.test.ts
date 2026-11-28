import { describe, it, expect, beforeEach, vi } from "vitest";

const captured = vi.hoisted(() => ({ queries: [] as Array<{ text: string; values: unknown[] }> }));
vi.mock("../../config/database", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const fakePool = {
    query: async (q: string | { text: string; values?: unknown[] }, values?: unknown[]) => {
      captured.queries.push({ text: typeof q === "string" ? q : q.text, values: typeof q === "string" ? (values ?? []) : (q.values ?? values ?? []) });
      return { rows: [], rowCount: 0, fields: [] };
    },
  };
  return { db: drizzle(fakePool as never) };
});

import { pushSubscriptionRepository } from "./push-subscription.repository";

beforeEach(() => { captured.queries.length = 0; });

describe("findByOrgId", () => {
  it("only returns subscriptions whose customer exists, is live and belongs to that agency (no client or no agency: nothing)", async () => {
    await pushSubscriptionRepository.findByOrgId("org-a");
    const { text, values } = captured.queries[0];
    expect(text).toContain("inner join");
    expect(text).toContain(`"client_table"."org_id" = $`);
    expect(text).toContain(`"deleted_at" is null`);
    expect(values).toContain("org-a");
  });
});

describe("removeByEndpointAndKeys", () => {
  it("matches the endpoint AND both keys, never one of them alone", async () => {
    await pushSubscriptionRepository.removeByEndpointAndKeys({ endpoint: "https://push.example/e", p256dh: "P", auth: "A" });
    const { text, values } = captured.queries[0];
    expect(text).toMatch(/^delete from "push_subscriptions"/i);
    expect(text).toContain(`"endpoint" = $1`);
    expect(text).toContain(`"p256dh" = $2`);
    expect(text).toContain(`"auth" = $3`);
    expect(values).toEqual(["https://push.example/e", "P", "A"]);
  });
});
