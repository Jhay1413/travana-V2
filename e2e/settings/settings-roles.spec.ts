import type { APIRequestContext } from "@playwright/test";
import { expect, expectLoginOk, test } from "../helpers/fixtures";
import { seedAgency, seedMember, seedQuote, unique } from "../helpers/seed";

const AIRPORTS = "/api/v2/settings/airports";
const AIRPORT_FORM_ROUTE = "/api/v2/airports";
const DESTINATIONS ="/api/v2/settings/destinations";

function airportBody() {
  return { airport_name: `E2E Airport ${unique("a")}`, airport_code: "ZZZ" };
}

test.describe("shared settings write access", () => {
  test("an agent cannot write reference data but can read it", async ({ request }) => {
    const agency = await seedAgency();
    const agent = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "agent" });
    await expectLoginOk(request, agent.email);

    // Reads stay open to signed-in staff.
    const read = await request.get(AIRPORTS);
    expect(read.status(), await read.text()).toBe(200);
    expect((await request.get(DESTINATIONS)).status()).toBe(200);

    // Admin-only writes are refused on every write verb.
    const create = await request.post(AIRPORTS, { data: airportBody() });
    expect(create.status()).toBe(403);
    expect((await create.json()).message).toBe("You do not have permission to perform this action");
    expect((await request.patch(`${AIRPORTS}/00000000-0000-0000-0000-000000000000`, { data: { airport_name: "x" } })).status()).toBe(403);
    expect((await request.delete(`${AIRPORTS}/00000000-0000-0000-0000-000000000000`)).status()).toBe(403);
    expect((await request.delete(`${DESTINATIONS}/00000000-0000-0000-0000-000000000000`)).status()).toBe(403);
  });

  test("an org admin can create, edit and delete reference data", async ({ request }) => {
    const agency = await seedAgency();
    await expectLoginOk(request, agency.adminEmail);

    const body = airportBody();
    const created = await request.post(AIRPORTS, { data: body });
    expect(created.status(), await created.text()).toBe(201);
    const id = (await created.json()).data.id as string;

    const edited = await request.patch(`${AIRPORTS}/${id}`, { data: { airport_name: `${body.airport_name} edited` } });
    expect(edited.status(), await edited.text()).toBe(200);

    const removed = await request.delete(`${AIRPORTS}/${id}`);
    expect(removed.status(), await removed.text()).toBe(204);
  });

  test("everyday quick-adds from the quote, booking and enquiry forms keep working for agents", async ({ request }) => {
    const agency = await seedAgency();
    const agent = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "agent" });
    await expectLoginOk(request, agent.email);

    const created = await request.post(DESTINATIONS, { data: { name: `E2E Destination ${unique("d")}` } });
    expect(created.status(), await created.text()).toBe(201);
    const id = (await created.json()).data.id as string;

    // Editing or deleting it afterwards is an admin job.
    expect((await request.patch(`${DESTINATIONS}/${id}`, { data: { name: "renamed" } })).status()).toBe(403);
    expect((await request.delete(`${DESTINATIONS}/${id}`)).status()).toBe(403);
  });

  test("the non-settings /api/v2/airports route follows the same rules: agents can quick-add but not delete", async ({ request }) => {
    const agency = await seedAgency();
    const agent = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "agent" });
    const admin = agency.adminEmail;
    const ZERO = "00000000-0000-4000-8000-000000000000";

    // The quote and enquiry forms POST here, so an agent keeps that.
    await expectLoginOk(request, agent.email);
    const quickAdd = await request.post(AIRPORT_FORM_ROUTE, { data: airportBody() });
    expect(quickAdd.status(), await quickAdd.text()).toBe(201);
    const id = (await quickAdd.json()).data.id as string;

    // Removing an airport is an admin job on this route too.
    const agentDelete = await request.delete(`${AIRPORT_FORM_ROUTE}/${id}`);
    expect(agentDelete.status()).toBe(403);
    expect((await request.delete(`${AIRPORT_FORM_ROUTE}/${ZERO}`)).status()).toBe(403);

    // Malformed input is a 400, not a database error.
    expect((await request.post(AIRPORT_FORM_ROUTE, { data: { airport_name: "" } })).status()).toBe(400);

    await expectLoginOk(request, admin);
    const adminDelete = await request.delete(`${AIRPORT_FORM_ROUTE}/${id}`);
    expect(adminDelete.status(), await adminDelete.text()).toBe(204);
  });

  test.describe("tags are global: rename and delete are admin-only, agents detach from their own quote", () => {
    const TAGS = "/api/v2/settings/tags";
    const ZERO = "00000000-0000-4000-8000-000000000000";

    async function attach(request: APIRequestContext, quoteId: string, names: string[]) {
      const res = await request.put(`/api/v2/quotes/${quoteId}/tags`, { data: { tags: names } });
      expect(res.status(), await res.text()).toBe(200);
    }
    async function tagIdsOf(request: APIRequestContext, quoteId: string): Promise<Record<string, string>> {
      const res = await request.get(`/api/v2/quotes/${quoteId}/tags`);
      expect(res.status(), await res.text()).toBe(200);
      const rows = (await res.json()).data as Array<{ id: string; name: string }>;
      return Object.fromEntries(rows.map((r) => [r.name, r.id]));
    }

    test("an agent gets 403 renaming or deleting a tag; an org admin can do both", async ({ request }) => {
      const agency = await seedAgency();
      const agent = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "agent" });
      const quoteId = await seedQuote({ userId: agent.id, orgId: agency.orgId, branchId: agency.branchId });
      const name = unique("tag");

      await expectLoginOk(request, agent.email);
      await attach(request, quoteId, [name]);
      const tagId = (await tagIdsOf(request, quoteId))[name]!;

      expect((await request.patch(`${TAGS}/${tagId}`, { data: { name: `${name}-x` } })).status()).toBe(403);
      expect((await request.delete(`${TAGS}/${tagId}`)).status()).toBe(403);

      await expectLoginOk(request, agency.adminEmail);
      const renamed = await request.patch(`${TAGS}/${tagId}`, { data: { name: `${name}-renamed` } });
      expect(renamed.status(), await renamed.text()).toBe(200);
      const removed = await request.delete(`${TAGS}/${tagId}`);
      expect([200, 204], await removed.text()).toContain(removed.status());
    });

    test("an agent detaches a tag from their quote, and it stays on another quote", async ({ request }) => {
      const agency = await seedAgency();
      const agent = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "agent" });
      const quoteA = await seedQuote({ userId: agent.id, orgId: agency.orgId, branchId: agency.branchId });
      const quoteB = await seedQuote({ userId: agent.id, orgId: agency.orgId, branchId: agency.branchId });
      const name = unique("shared");

      await expectLoginOk(request, agent.email);
      await attach(request, quoteA, [name]);
      await attach(request, quoteB, [name]);
      const tagId = (await tagIdsOf(request, quoteA))[name]!;

      const detached = await request.delete(`/api/v2/quotes/${quoteA}/tags/${tagId}`);
      expect(detached.status(), await detached.text()).toBe(204);

      expect(await tagIdsOf(request, quoteA)).toEqual({});
      expect((await tagIdsOf(request, quoteB))[name]).toBe(tagId);
      // The tag entity itself survives.
      expect((await request.get("/api/v2/tags")).status()).toBe(200);
    });

    test("detaching on a quote outside the caller's scope is a 404 and changes nothing", async ({ request }) => {
      const mine = await seedAgency();
      const other = await seedAgency();
      const agent = await seedMember({ orgId: mine.orgId, branchId: mine.branchId, orgRole: "agent" });
      const otherAdmin = other.adminId;
      const foreignQuote = await seedQuote({ userId: otherAdmin, orgId: other.orgId, branchId: other.branchId });
      const name = unique("foreign");

      await expectLoginOk(request, other.adminEmail);
      await attach(request, foreignQuote, [name]);
      const tagId = (await tagIdsOf(request, foreignQuote))[name]!;

      await expectLoginOk(request, agent.email);
      expect((await request.delete(`/api/v2/quotes/${foreignQuote}/tags/${tagId}`)).status()).toBe(404);
      expect((await request.delete(`/api/v2/quotes/${ZERO}/tags/${tagId}`)).status()).toBe(404);

      await expectLoginOk(request, other.adminEmail);
      expect((await tagIdsOf(request, foreignQuote))[name]).toBe(tagId);
    });
  });

  test("tour operators stay platform-admin only, even for an org admin", async ({ request }) => {
    const agency = await seedAgency();
    await expectLoginOk(request, agency.adminEmail);
    const res = await request.post("/api/v2/settings/tour-operators", { data: { name: `E2E Operator ${unique("o")}` } });
    expect(res.status()).toBe(403);
  });
});
