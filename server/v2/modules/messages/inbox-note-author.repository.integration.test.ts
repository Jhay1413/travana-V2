// Needs a live Postgres: run with `npm run test:integration`. Written, not run by `npm test`.
import { describe, it, expect, beforeEach } from "vitest";
import { inboxNoteAuthorRepository } from "./inbox-note-author.repository";
import { truncateAll, makeOrg, makeUser } from "../../test/factories";

let orgA: { id: string };
let orgB: { id: string };
let ann: { id: string };

beforeEach(async () => {
  await truncateAll();
  orgA = await makeOrg();
  orgB = await makeOrg();
  ann = await makeUser({ firstName: "Ann", lastName: "Lee", name: "ann", image: "a.png" });
});

describe("inboxNoteAuthorRepository", () => {
  it("returns the author with display fields for the requested messages", async () => {
    await inboxNoteAuthorRepository.create({
      orgId: orgA.id, sendsevenMessageId: "m1", sendsevenNoteId: "note-1", conversationId: "c1", userId: ann.id,
    });
    const rows = await inboxNoteAuthorRepository.findByMessageIds(orgA.id, ["m1", "m2"]);
    expect(rows).toEqual([
      { sendsevenMessageId: "m1", userId: ann.id, firstName: "Ann", lastName: "Lee", name: "ann", image: "a.png" },
    ]);
  });

  it("is scoped to the org", async () => {
    await inboxNoteAuthorRepository.create({ orgId: orgA.id, sendsevenMessageId: "m1", conversationId: "c1", userId: ann.id });
    expect(await inboxNoteAuthorRepository.findByMessageIds(orgB.id, ["m1"])).toEqual([]);
  });

  it("ignores a duplicate message id and returns [] for no ids", async () => {
    const row = { orgId: orgA.id, sendsevenMessageId: "m1", conversationId: "c1", userId: ann.id };
    await inboxNoteAuthorRepository.create(row);
    await expect(inboxNoteAuthorRepository.create(row)).resolves.toBeUndefined();
    expect(await inboxNoteAuthorRepository.findByMessageIds(orgA.id, [])).toEqual([]);
  });
});
