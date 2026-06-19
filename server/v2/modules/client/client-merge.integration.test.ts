import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { clientRepository } from "./client.repository";
import { neonClientService } from "../neon-client/neon-client.service";
import { db } from "../../config/database";
import {
  clientTable, clientMergeLog, transaction, notes, task, tickets, clientFiles,
  smsMessagesTable, wallet_transaction, referral, tags, clientTags,
} from "@shared/schema";
import { truncateAll, makeOrg, makeBranch, makeUser, makeClient, makeTransaction, makeQuote } from "../../test/factories";

// Exercises the real merge transaction (clientRepository.mergeAtomic) against
// Postgres: reassignment of every client-linked table, tag dedup, self-referral
// cleanup, profile back-fill, soft-archive and the audit log — plus the
// service-level guards.

function scope(over: Record<string, unknown>) {
  return { branchId: null, userId: null, orgRoles: [], ...over } as never;
}

let org: { id: string };
let branch: { id: string };
let agent: { id: string };
let source: { id: string };
let target: { id: string };

beforeEach(async () => {
  await truncateAll();
  org = await makeOrg();
  branch = await makeBranch(org.id);
  agent = await makeUser();
  // target wins on city; email is blank on target so it back-fills from source.
  source = await makeClient({ orgId: org.id, branchId: branch.id, email: "src@example.com", city: "SourceCity" });
  target = await makeClient({ orgId: org.id, branchId: branch.id, email: null, city: "TargetCity" });
});

async function countWhere(table: any, col: any, value: string): Promise<number> {
  const rows = await db.select({ id: table.id }).from(table).where(eq(col, value));
  return rows.length;
}

describe("clientRepository.mergeAtomic — reassignment", () => {
  it("moves deals, activity, comms and wallet from source to target", async () => {
    // Source-owned records
    const srcTxn = await makeTransaction({ user_id: agent.id, org_id: org.id, branch_id: branch.id, client_id: source.id });
    await makeQuote({ transaction_id: srcTxn.id }); // proves deals follow the transaction
    await db.insert(notes).values({ client_id: source.id, content: "n" });
    await db.insert(task).values({ client_id: source.id, title: "t" });
    await db.insert(tickets).values({ clientId: source.id, userId: agent.id, type: "general", subject: "s" });
    await db.insert(clientFiles).values({ clientId: source.id, filename: "f", originalName: "f", mimeType: "text/plain", size: 1 });
    await db.insert(smsMessagesTable).values({ clientId: source.id, toPhone: "123", body: "hi" });
    await db.insert(wallet_transaction).values({ client_id: source.id, type: "credit", amount: "10", source: "referral_commission" });

    // Target already owns one transaction — both should end up on target.
    await makeTransaction({ user_id: agent.id, org_id: org.id, branch_id: branch.id, client_id: target.id });

    await clientRepository.mergeAtomic(source as never, target as never, agent.id);

    expect(await countWhere(transaction, transaction.client_id, source.id)).toBe(0);
    expect(await countWhere(transaction, transaction.client_id, target.id)).toBe(2);
    expect(await countWhere(notes, notes.client_id, target.id)).toBe(1);
    expect(await countWhere(task, task.client_id, target.id)).toBe(1);
    expect(await countWhere(tickets, tickets.clientId, target.id)).toBe(1);
    expect(await countWhere(clientFiles, clientFiles.clientId, target.id)).toBe(1);
    expect(await countWhere(smsMessagesTable, smsMessagesTable.clientId, target.id)).toBe(1);
    expect(await countWhere(wallet_transaction, wallet_transaction.client_id, target.id)).toBe(1);
  });

  it("dedups tags against the target (no unique-constraint violation)", async () => {
    const shared = await db.insert(tags).values({ name: "shared" }).returning();
    const onlySource = await db.insert(tags).values({ name: "onlySource" }).returning();
    // shared tag exists on BOTH clients; onlySource only on the source.
    await db.insert(clientTags).values({ clientId: source.id, tagId: shared[0].id });
    await db.insert(clientTags).values({ clientId: source.id, tagId: onlySource[0].id });
    await db.insert(clientTags).values({ clientId: target.id, tagId: shared[0].id });

    await clientRepository.mergeAtomic(source as never, target as never, agent.id);

    expect(await countWhere(clientTags, clientTags.clientId, source.id)).toBe(0);
    // target keeps the shared tag exactly once + gains onlySource = 2 distinct rows
    expect(await countWhere(clientTags, clientTags.clientId, target.id)).toBe(2);
  });

  it("moves referrals both ways and removes the self-referral the merge creates", async () => {
    // A normal referral (source is the referrer) and a referral that becomes a
    // self-referral once both ids collapse to the target.
    await db.insert(referral).values({ referrerClientId: source.id, referredName: "Real" });
    await db.insert(referral).values({ referrerClientId: source.id, referredClientId: target.id, referredName: "Self" });
    // Another client referred BY the source should re-point at the target.
    const other = await makeClient({ orgId: org.id, branchId: branch.id, referredByClientId: source.id });

    await clientRepository.mergeAtomic(source as never, target as never, agent.id);

    const referrerRows = await db.select().from(referral).where(eq(referral.referrerClientId, target.id));
    expect(referrerRows).toHaveLength(1); // the real one; the self-referral was deleted
    expect(referrerRows[0].referredClientId).not.toBe(target.id);

    const [otherAfter] = await db.select().from(clientTable).where(eq(clientTable.id, other.id));
    expect(otherAfter.referredByClientId).toBe(target.id);
  });

  it("back-fills blank target fields, archives the source and writes an audit row", async () => {
    await clientRepository.mergeAtomic(source as never, target as never, agent.id);

    const [targetAfter] = await db.select().from(clientTable).where(eq(clientTable.id, target.id));
    expect(targetAfter.email).toBe("src@example.com"); // back-filled (was blank)
    expect(targetAfter.city).toBe("TargetCity");        // target wins (was set)
    expect(targetAfter.status).toBe("active");

    const [sourceAfter] = await db.select().from(clientTable).where(eq(clientTable.id, source.id));
    expect(sourceAfter.status).toBe("merged");
    expect(sourceAfter.mergedIntoId).toBe(target.id);
    expect(sourceAfter.mergedAt).not.toBeNull();
    expect(sourceAfter.mergedBy).toBe(agent.id);

    const logs = await db.select().from(clientMergeLog).where(eq(clientMergeLog.sourceClientId, source.id));
    expect(logs).toHaveLength(1);
    expect(logs[0].targetClientId).toBe(target.id);
    expect(logs[0].counts).toBeTruthy();
  });
});

describe("neonClientService.mergeClients — guards", () => {
  const s = () => scope({ orgId: org.id, orgRole: "platform_admin" });

  it("rejects merging a client into itself", async () => {
    await expect(neonClientService.mergeClients(source.id, source.id, s())).rejects.toThrow(/itself/i);
  });

  it("rejects re-merging an already-merged source", async () => {
    await neonClientService.mergeClients(source.id, target.id, s());
    await expect(neonClientService.mergeClients(source.id, target.id, s())).rejects.toThrow(/already been merged/i);
  });

  it("rejects when the clients belong to different organizations", async () => {
    const otherOrg = await makeOrg();
    const foreign = await makeClient({ orgId: otherOrg.id });
    await expect(neonClientService.mergeClients(source.id, foreign.id, s())).rejects.toThrow(/same organization/i);
  });
});
