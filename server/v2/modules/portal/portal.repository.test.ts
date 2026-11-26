import { describe, it, expect, vi, beforeEach } from "vitest";

// A real drizzle instance over a fake pool: nothing connects, every statement the
// repository builds is captured as text + params so the SQL itself can be asserted.
const captured = vi.hoisted(() => ({ queries: [] as Array<{ text: string; values: unknown[] }> }));

vi.mock("../../config/database", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const fakePool = {
    query: async (q: string | { text: string; values?: unknown[] }, values?: unknown[]) => {
      const text = typeof q === "string" ? q : q.text;
      const vals = typeof q === "string" ? (values ?? []) : (q.values ?? values ?? []);
      captured.queries.push({ text, values: vals });
      return { rows: [], rowCount: 0, fields: [] };
    },
  };
  return { db: drizzle(fakePool as never) };
});

import { dealIdFromInterestText, portalRepository } from "./portal.repository";

const last = () => captured.queries[captured.queries.length - 1];

beforeEach(() => {
  captured.queries.length = 0;
});

describe("findClientBookings", () => {
  it("excludes LOST bookings (NULL status stays visible), the same test the rest of the app uses", async () => {
    await portalRepository.findClientBookings("c1");
    const { text } = last();
    expect(text).toContain(`"booking_status" <> 'LOST'`);
    expect(text).toContain(`"booking_status" is null`);
    expect(text).toContain(`"is_active" = $`);
  });
});

describe("dealIdFromInterestText", () => {
  it("reads the deal id from both wordings and from nothing else", () => {
    expect(dealIdFromInterestText("❤️ Interested in deal: abc-123")).toBe("abc-123");
    expect(dealIdFromInterestText("Interested in deal: abc-123")).toBe("abc-123");
    expect(dealIdFromInterestText("Hello, interested in deal: abc")).toBeNull();
    expect(dealIdFromInterestText("📋 Quote Request:\n• Destination: X")).toBeNull();
  });
});

describe("deal interest messages", () => {
  it("looks for this customer's own sent message with the exact text (current and older wording)", async () => {
    await portalRepository.hasClientInterestMessage("c1", "deal-9");
    const { text, values } = last();
    expect(text).toContain('"portal_messages"');
    expect(values).toEqual(expect.arrayContaining(["c1", "client", "❤️ Interested in deal: deal-9", "Interested in deal: deal-9"]));
  });

  it("lists told deals from this customer's own sent messages only", async () => {
    await portalRepository.findToldDealIds("c1");
    const { text, values } = last();
    expect(text).toContain('"client_id" = $');
    expect(values).toEqual(expect.arrayContaining(["c1", "client", "%Interested in deal: %"]));
  });
});

describe("deal reads are scoped to an agency via the quote's transaction org_id", () => {
  const orgScope = (text: string) => {
    expect(text).toContain(`"transaction"."id" = "quote_table"."transaction_id"`);
    expect(text).toContain(`"transaction"."org_id" = $`);
  };

  it("findDeals", async () => {
    await portalRepository.findDeals({ orgId: "org-a", limit: 5 });
    orgScope(last().text);
    expect(last().values).toContain("org-a");
  });

  it("findForYouDeals", async () => {
    await portalRepository.findForYouDeals({ orgId: "org-a", clientTagIds: ["t1"], limit: 5 });
    orgScope(last().text);
    expect(last().values).toContain("org-a");
  });

  it("findForYouDeals applies the same show_on_portal condition as findDeals", async () => {
    await portalRepository.findDeals({ orgId: "org-a", limit: 5 });
    const dealsText = last().text;
    await portalRepository.findForYouDeals({ orgId: "org-a", clientTagIds: ["t1"], limit: 5 });
    const forYouText = last().text;
    expect(dealsText).toContain(`"show_on_portal" = $`);
    expect(forYouText).toContain(`"show_on_portal" = $`);
  });

  it("findDealFilters (countries and popular tags)", async () => {
    await portalRepository.findDealFilters("org-a");
    expect(captured.queries).toHaveLength(2);
    for (const q of captured.queries) {
      orgScope(q.text);
      expect(q.values).toContain("org-a");
    }
  });

  it("findForYouDeals with no tags runs no query at all", async () => {
    await portalRepository.findForYouDeals({ orgId: "org-a", clientTagIds: [], limit: 5 });
    expect(captured.queries).toHaveLength(0);
  });
});

describe("findLoginCandidates", () => {
  it("matches the email case-insensitively, skips soft-deleted clients, with a deterministic PIN-first order", async () => {
    await portalRepository.findLoginCandidates("  Sam@Example.COM ");
    const { text, values } = last();
    expect(text).toContain(`lower("client_table"."email") = $`);
    expect(values).toContain("sam@example.com");
    expect(text).toContain(`"deleted_at" is null`);
    expect(text).toContain(`("client_table"."portal_pin" IS NOT NULL) DESC`);
    expect(text).toMatch(/order by .*"createdAt" asc, "client_table"\."id" asc/);
    expect(text).not.toContain(`"org_id" = $`);
  });

  it("limits candidates to one agency when an org id is given", async () => {
    await portalRepository.findLoginCandidates("sam@example.com", "org-a");
    const { text, values } = last();
    expect(text).toContain(`"client_table"."org_id" = $`);
    expect(values).toContain("org-a");
  });
});

describe("webauthn reads", () => {
  it("only verified credentials count as Face ID being set up (legacy rows do not)", async () => {
    await portalRepository.findWebauthnCredentialIdsForClient("c1");
    expect(last().text).toContain(`"verified_at" is not null`);
    await portalRepository.findWebauthnDevicesForClient("c1");
    expect(last().text).toContain(`"verified_at" is not null`);
    await portalRepository.findVerifiedWebauthnForClient("c1");
    expect(last().text).toContain(`"verified_at" is not null`);
  });

  it("looks a credential up by its id", async () => {
    await portalRepository.findWebauthnByCredentialId("cred-1");
    expect(last().text).toContain(`"webauthn_credentials"."credential_id" = $`);
    expect(last().values).toContain("cred-1");
  });
});

describe("org lookups", () => {
  it("resolves a slug only for an active organization", async () => {
    await portalRepository.findActiveOrgIdBySlug("agency-a");
    expect(last().text).toContain(`"organization"."slug" = $`);
    expect(last().text).toContain(`"organization"."is_active" = $`);
  });

  it("reads a client's org only for a live client", async () => {
    await portalRepository.findClientOrg("c1");
    expect(last().text).toContain(`"deleted_at" is null`);
  });
});

describe("findClientBookings: test deals", () => {
  it("leaves out bookings on a TEST deal (the live-booking rule includes transaction.is_test = false)", async () => {
    await portalRepository.findClientBookings("c1");
    const { text, values } = last();
    expect(text).toContain(`"transaction"."is_test" = $`);
    expect(values).toContain(false);
  });
});
