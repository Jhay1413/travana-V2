import { describe, it, expect, vi, beforeEach } from "vitest";

// Fake transaction: each select() resolves to the next queued result set, and
// every delete() is recorded so the test can see what the repository removed.
const selectResults: unknown[][] = [];
const deleteCalls: unknown[] = [];
const txCalls = { count: 0 };

vi.mock("../../config/database", () => {
  const tx = {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(selectResults.shift() ?? []),
      }),
    }),
    delete: () => ({
      where: (cond: unknown) => {
        deleteCalls.push(cond);
        return Promise.resolve();
      },
    }),
  };
  return {
    db: {
      transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
        txCalls.count += 1;
        return fn(tx);
      },
    },
  };
});

import { ticketReplyRepository } from "./ticket-reply.repository";

beforeEach(() => {
  selectResults.length = 0;
  deleteCalls.length = 0;
  txCalls.count = 0;
});

describe("ticketReplyRepository.remove", () => {
  it("deletes a reply with no children in one transaction", async () => {
    selectResults.push([], []); // no children, no attachments
    const out = await ticketReplyRepository.remove("r1");
    expect(out).toEqual({ deletedReplyIds: ["r1"], attachmentFilenames: [] });
    expect(txCalls.count).toBe(1);
    expect(deleteCalls).toHaveLength(1);
  });

  it("collects children from other users and nested grandchildren, and returns every attachment file", async () => {
    selectResults.push(
      [{ id: "c1" }, { id: "c2" }], // children of r1
      [{ id: "g1" }], // children of c1/c2
      [], // none below g1
      [{ filename: "ticket-attachments/a.png" }, { filename: "legacy.txt" }], // attachments of r1,c1,c2,g1
    );
    const out = await ticketReplyRepository.remove("r1");
    expect(out.deletedReplyIds).toEqual(["r1", "c1", "c2", "g1"]);
    expect(out.attachmentFilenames).toEqual(["ticket-attachments/a.png", "legacy.txt"]);
    expect(txCalls.count).toBe(1);
    expect(deleteCalls).toHaveLength(1);
  });

  it("does not loop forever on a parent cycle", async () => {
    selectResults.push([{ id: "c1" }], [{ id: "r1" }, { id: "c1" }], [], []);
    const out = await ticketReplyRepository.remove("r1");
    expect(out.deletedReplyIds).toEqual(["r1", "c1"]);
  });
});
