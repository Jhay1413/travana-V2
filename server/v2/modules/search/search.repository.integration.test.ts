import { describe, it, expect, beforeEach } from "vitest";
import { searchRepository } from "./search.repository";
import { truncateAll, makeOrg, makeClient } from "../../test/factories";

let orgA: { id: string };
let orgB: { id: string };

beforeEach(async () => {
  await truncateAll();
  orgA = await makeOrg();
  orgB = await makeOrg();

  await makeClient({ orgId: orgA.id, firstName: "Ada", surename: "Lovelace", email: "ada@x.com", phoneNumber: "12345", city: "London" });
  await makeClient({ orgId: orgA.id, firstName: "Ada", surename: "Smith" });
  await makeClient({ orgId: orgA.id, firstName: "Ada", surename: "Brown" });
  await makeClient({ orgId: orgA.id, firstName: "Grace", surename: "Hopper" });
  await makeClient({ orgId: orgA.id, firstName: "Gracela", surename: "Manning" });
  await makeClient({ orgId: orgB.id, firstName: "Bob", surename: "Jones" });
});

describe("searchRepository.globalSearch — matching", () => {
  it("matches a single word against first or surname", async () => {
    const { clients } = await searchRepository.globalSearch("Lovelace", { orgId: orgA.id });
    expect(clients).toHaveLength(1);
    expect(clients[0].name).toContain("Lovelace");
  });

  it("requires every word of a multi-word query to match the full name", async () => {
    // "ada love" → both words must hit the concatenated name; only Ada Lovelace
    // qualifies (Ada Smith/Brown lack 'love').
    const { clients } = await searchRepository.globalSearch("ada love", { orgId: orgA.id });
    expect(clients).toHaveLength(1);
    expect(clients[0].name).toContain("Lovelace");
  });

  it("matches on email", async () => {
    const { clients } = await searchRepository.globalSearch("ada@x.com", { orgId: orgA.id });
    expect(clients).toHaveLength(1);
    expect(clients[0].name).toContain("Lovelace");
  });

  it("matches on city", async () => {
    const { clients } = await searchRepository.globalSearch("London", { orgId: orgA.id });
    expect(clients).toHaveLength(1);
    expect(clients[0].name).toContain("Lovelace");
  });
});

describe("searchRepository.globalSearch — org scoping", () => {
  it("does not return clients from another org", async () => {
    expect((await searchRepository.globalSearch("Bob", { orgId: orgA.id })).clients).toHaveLength(0);
    expect((await searchRepository.globalSearch("Bob", { orgId: orgB.id })).clients).toHaveLength(1);
  });
});

describe("searchRepository.globalSearch — relevance ordering", () => {
  it("ranks an exact first-name match above a prefix match", async () => {
    const { clients } = await searchRepository.globalSearch("grace", { orgId: orgA.id });
    expect(clients.map((c) => c.name)).toEqual(["Grace Hopper", "Gracela Manning"]);
  });
});

describe("searchRepository.globalSearch — pagination", () => {
  it("pages results using limit+1 and reports nextOffset", async () => {
    // Three 'Ada' clients; page size 2.
    const page1 = await searchRepository.globalSearch("Ada", { orgId: orgA.id, limit: 2 });
    expect(page1.clients).toHaveLength(2);
    expect(page1.nextOffset).toBe(2);

    const page2 = await searchRepository.globalSearch("Ada", { orgId: orgA.id, limit: 2, offset: 2 });
    expect(page2.clients).toHaveLength(1);
    expect(page2.nextOffset).toBeNull();
  });
});
