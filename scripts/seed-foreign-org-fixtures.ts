/**
 * Seed minimal cross-tenant test fixtures into "Jhon's Travel" so the
 * Phase A verification script can prove the cross-tenant block end-to-end.
 *
 * Inserts (all tagged with prefix "phase-a-test-" so they're easy to clean up):
 *   - 1 client          → client_table
 *   - 1 ticket + reply + attachment
 *   - 1 wallet_transaction (credit, processed)
 *   - 1 referral
 *   - 1 sms_messages row
 *
 * Re-runs are idempotent: the script checks for existing fixture rows by
 * the marker prefix and skips them.
 *
 * To remove: see the DELETE block at the bottom of this file (commented out).
 */

import { eq, like } from 'drizzle-orm';
import { db, pool } from '../server/v2/config/database';
import {
  organization,
  user,
  clientTable,
  tickets,
  ticketReplies,
  ticketAttachments,
  wallet_transaction,
  referral,
  smsMessagesTable,
  auditLog,
  transaction,
} from '@shared/schema';

const FOREIGN_ORG_ID = '838be74e-d4ad-4acf-8bd7-2a284ede742d'; // Jhon's Travel
const FOREIGN_USER_ID = '5494e6b5-8c90-4d56-8348-37c908307d0e'; // jhon041413@gmail.com (org_admin)
const MARKER = 'phase-a-test';

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  cyan:  (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim:   (s: string) => `\x1b[2m${s}\x1b[0m`,
};

function note(label: string, msg: string) { console.log(`  ${c.green('+')} ${label}: ${msg}`); }
function head(s: string) { console.log(`\n${c.cyan(s)}`); }

(async () => {
  console.log(`Seeding cross-tenant fixtures into ${c.cyan('Jhon\'s Travel')} (${FOREIGN_ORG_ID})\n`);

  // Confirm org + user exist
  const [org] = await db.select().from(organization).where(eq(organization.id, FOREIGN_ORG_ID)).limit(1);
  const [u] = await db.select().from(user).where(eq(user.id, FOREIGN_USER_ID)).limit(1);
  if (!org || !u) { console.error('Foreign org or user missing — aborting'); process.exit(1); }
  note('org', org.name);
  note('user', u.email);

  // 1. Client
  head('1. Client');
  const [existingClient] = await db.select().from(clientTable).where(like(clientTable.firstName, `${MARKER}%`)).limit(1);
  let clientId: string;
  if (existingClient) {
    clientId = existingClient.id;
    note('exists', `client ${clientId}`);
  } else {
    const [created] = await db.insert(clientTable).values({
      firstName: `${MARKER}-First`,
      surename: `${MARKER}-Last`,
      phoneNumber: '+447000000001',
      email: 'phase-a-test@jhonstravel.test',
      orgId: FOREIGN_ORG_ID,
    } as any).returning();
    clientId = created.id;
    note('created', `client ${clientId}`);
  }

  // 2. Ticket
  head('2. Ticket + reply + attachment');
  const [existingTicket] = await db.select().from(tickets).where(like(tickets.subject, `${MARKER}%`)).limit(1);
  let ticketId: string;
  if (existingTicket) {
    ticketId = existingTicket.id;
    note('exists', `ticket ${ticketId}`);
  } else {
    const [created] = await db.insert(tickets).values({
      clientId,
      userId: FOREIGN_USER_ID,
      type: 'general',
      status: 'Open',
      priority: 'Medium',
      subject: `${MARKER} subject`,
      description: 'Cross-tenant fixture',
      orgId: FOREIGN_ORG_ID,
    } as any).returning();
    ticketId = created.id;
    note('created', `ticket ${ticketId}`);
  }

  const [existingReply] = await db.select().from(ticketReplies).where(eq(ticketReplies.ticketId, ticketId)).limit(1);
  if (!existingReply) {
    const [created] = await db.insert(ticketReplies).values({
      ticketId,
      userId: FOREIGN_USER_ID,
      content: `${MARKER} reply body`,
    } as any).returning();
    note('created', `reply ${created.id}`);
  } else {
    note('exists', `reply ${existingReply.id}`);
  }

  const [existingAtt] = await db.select().from(ticketAttachments).where(eq(ticketAttachments.ticketId, ticketId)).limit(1);
  if (!existingAtt) {
    const [created] = await db.insert(ticketAttachments).values({
      ticketId,
      filename: `${MARKER}-fixture.pdf`,
      originalName: `${MARKER}-fixture.pdf`,
      mimeType: 'application/pdf',
      size: 1234,
    } as any).returning();
    note('created', `attachment ${created.id}`);
  } else {
    note('exists', `attachment ${existingAtt.id}`);
  }

  // 3. Wallet transaction
  head('3. Wallet transaction');
  const [existingTx] = await db.select().from(wallet_transaction).where(eq(wallet_transaction.client_id, clientId)).limit(1);
  if (!existingTx) {
    const [created] = await db.insert(wallet_transaction).values({
      client_id: clientId,
      type: 'credit',
      source: 'referral_commission',
      amount: '10.00',
      status: 'processed',
    } as any).returning();
    note('created', `wallet_transaction ${created.id}`);
  } else {
    note('exists', `wallet_transaction ${existingTx.id}`);
  }

  // 4. Referral (referrer = our seeded client)
  head('4. Referral');
  const [existingRef] = await db.select().from(referral).where(eq(referral.referrerClientId, clientId)).limit(1);
  if (!existingRef) {
    const [created] = await db.insert(referral).values({
      referrerClientId: clientId,
      referredName: `${MARKER}-referred`,
      referralStatus: 'PENDING',
      commission: '100.00',
      payoutAmount: '22.50',
    } as any).returning();
    note('created', `referral ${created.id}`);
  } else {
    note('exists', `referral ${existingRef.id}`);
  }

  // 5. SMS message
  head('5. SMS message');
  const [existingSms] = await db.select().from(smsMessagesTable).where(eq(smsMessagesTable.clientId, clientId)).limit(1);
  if (!existingSms) {
    const [created] = await db.insert(smsMessagesTable).values({
      clientId,
      clientName: `${MARKER}-First ${MARKER}-Last`,
      toPhone: '+447000000001',
      body: `${MARKER} hello`,
      status: 'sent',
      triggerSource: 'manual',
    } as any).returning();
    note('created', `sms_message ${created.id}`);
  } else {
    note('exists', `sms_message ${existingSms.id}`);
  }

  // 6. Audit log entry pointing at the foreign client (so the audit findAll
  // scope test has something to attempt to leak).
  head('6. Audit log entry');
  const [existingAudit] = await db.select().from(auditLog).where(like(auditLog.reason, `${MARKER}%`)).limit(1);
  if (!existingAudit) {
    const [created] = await db.insert(auditLog).values({
      action: 'delete',
      entityType: 'quote',
      entityId: '00000000-0000-0000-0000-000000000000',
      entityTitle: `${MARKER}-deleted-quote`,
      reason: `${MARKER} fixture audit entry`,
      performedBy: FOREIGN_USER_ID,
      performedByName: u.name || u.email || 'Test',
      clientId,
      clientName: `${MARKER}-First ${MARKER}-Last`,
    } as any).returning();
    note('created', `audit_log ${created.id}`);
  } else {
    note('exists', `audit_log ${existingAudit.id}`);
  }

  // 7. Transaction (so Phase B tests have a foreign-org transaction to attempt
  //    cross-tenant access against)
  head('7. Transaction');
  const [existingTxn] = await db.select().from(transaction).where(eq(transaction.client_id, clientId)).limit(1);
  if (!existingTxn) {
    const [created] = await db.insert(transaction).values({
      client_id: clientId,
      user_id: FOREIGN_USER_ID,
      status: 'on_enquiry',
      org_id: FOREIGN_ORG_ID,
    } as any).returning();
    note('created', `transaction ${created.id}`);
  } else {
    note('exists', `transaction ${existingTxn.id}`);
  }

  console.log(`\n${c.green('Done.')} Fixtures tagged with prefix "${MARKER}".`);
  console.log(c.dim('To clean up later, see comments at bottom of this script.'));

  await pool.end();
})();

/*
-- To remove all phase-a-test fixtures, run this SQL:
DELETE FROM audit_log WHERE reason LIKE 'phase-a-test%';
DELETE FROM sms_messages
  WHERE client_id IN (SELECT id FROM client_table WHERE "firstName" LIKE 'phase-a-test%');
DELETE FROM referral
  WHERE "referrerClientId" IN (SELECT id FROM client_table WHERE "firstName" LIKE 'phase-a-test%');
DELETE FROM wallet_transaction
  WHERE client_id IN (SELECT id FROM client_table WHERE "firstName" LIKE 'phase-a-test%');
DELETE FROM ticket_attachments
  WHERE ticket_id IN (SELECT id FROM tickets WHERE subject LIKE 'phase-a-test%');
DELETE FROM ticket_replies
  WHERE ticket_id IN (SELECT id FROM tickets WHERE subject LIKE 'phase-a-test%');
DELETE FROM tickets WHERE subject LIKE 'phase-a-test%';
DELETE FROM transaction
  WHERE client_id IN (SELECT id FROM client_table WHERE "firstName" LIKE 'phase-a-test%');
DELETE FROM client_table WHERE "firstName" LIKE 'phase-a-test%';
*/
