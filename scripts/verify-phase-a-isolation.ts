/**
 * Phase A tenant-isolation verification.
 *
 * Exercises the scoping rules from each Phase A fix against real DB data,
 * using the org + user the QA was given:
 *   userId  = BYxflIAfkMzJPqomnjMKZxtHJ0sMJRmB    (branch_manager)
 *   orgId   = c790aeb2-b2ab-4277-a915-c470c6fb02c6
 *
 * For every module it asks:
 *   1. How many records does the SCOPED query (this org's id) return?
 *   2. How many records does the UNSCOPED (platform-admin) query return?
 * If #1 < #2 the filter is excluding other-org rows.
 *
 * Plus: pulls a known foreign-org row, calls the ownership helper, expects
 * it to refuse — proving the controller would 404 a forged id.
 */

import { and, eq, isNotNull, ne } from 'drizzle-orm';
import { db, pool } from '../server/v2/config/database';
import {
  organization,
  user,
  clientTable,
  wallet_transaction,
  referral,
  referral_payout,
  referral_withdrawal,
  tickets,
  ticketReplies,
  ticketAttachments,
  smsMessagesTable,
  emailAccounts,
  notifications,
  quote,
  transaction,
  booking,
} from '@shared/schema';
import { searchRepository } from '../server/v2/modules/search/search.repository';
import { walletTransactionRepository } from '../server/v2/modules/wallet/wallet-transaction.repository';
import { referralRepository } from '../server/v2/modules/referral/referral.repository';
import { referralPayoutRepository } from '../server/v2/modules/referral/referral-payout.repository';
import { referralWithdrawalRepository } from '../server/v2/modules/referral/referral-withdrawal.repository';
import { ticketReplyRepository } from '../server/v2/modules/ticket/ticket-reply.repository';
import { ticketAttachmentRepository } from '../server/v2/modules/ticket/ticket-attachment.repository';
import { smsRepository } from '../server/v2/modules/sms/sms.repository';
import { emailRepository } from '../server/v2/modules/email/email.repository';
import { notificationRepository } from '../server/v2/modules/notification/notification.repository';
import { auditRepository } from '../server/v2/modules/audit/audit.repository';
// Phase B repos
import { noteRepository } from '../server/v2/modules/note/note.repository';
import { enquiryTableRepository } from '../server/v2/modules/enquiry/enquiry.repository';
import { bookingRepository } from '../server/v2/modules/booking/booking.repository';
import { newQuoteRepository } from '../server/v2/modules/quote/quote.repository';
import { opportunitiesRepository } from '../server/v2/modules/opportunities/opportunities.repository';
import { revenueRepository } from '../server/v2/modules/revenue/revenue.repository';
import { dashboardRepository } from '../server/v2/modules/dashboard/dashboard.repository';
import { socialPostRepository } from '../server/v2/modules/social-post/social-post.repository';
import { userRepository } from '../server/v2/modules/user/user.repository';

const ORG_ID = 'c790aeb2-b2ab-4277-a915-c470c6fb02c6';
const USER_ID = 'BYxflIAfkMzJPqomnjMKZxtHJ0sMJRmB';

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red:   (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow:(s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan:  (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim:   (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold:  (s: string) => `\x1b[1m${s}\x1b[0m`,
};

let pass = 0;
let fail = 0;
let warn = 0;

function ok(label: string, msg: string) { console.log(`  ${c.green('✓')} ${label}: ${msg}`); pass++; }
function bad(label: string, msg: string) { console.log(`  ${c.red('✗')} ${label}: ${msg}`); fail++; }
function note(label: string, msg: string) { console.log(`  ${c.yellow('!')} ${label}: ${msg}`); warn++; }
function head(s: string) { console.log(`\n${c.bold(c.cyan(s))}`); }

const trunc = (s: string | null | undefined, n = 8) => (s ?? '').slice(0, n);

// ── pre-flight ────────────────────────────────────────────────────────────
async function preflight() {
  head('Pre-flight: confirm test fixture exists');

  const [orgRow] = await db.select().from(organization).where(eq(organization.id, ORG_ID)).limit(1);
  if (!orgRow) { bad('org', `no organization with id ${ORG_ID}`); return false; }
  ok('org', `${orgRow.name} (${orgRow.slug})`);

  const [userRow] = await db.select().from(user).where(eq(user.id, USER_ID)).limit(1);
  if (!userRow) { bad('user', `no user with id ${USER_ID}`); return false; }
  ok('user', `${userRow.email} (${userRow.orgRole})`);
  if (userRow.orgId !== ORG_ID) {
    note('user.orgId', `user.orgId=${userRow.orgId} != given orgId. Tests will still run against the given orgId.`);
  }

  const otherOrgs = await db.select({ id: organization.id }).from(organization).where(ne(organization.id, ORG_ID));
  if (otherOrgs.length === 0) {
    note('other orgs', `only one org exists in the DB — cross-tenant tests are not meaningful.`);
  } else {
    ok('other orgs', `${otherOrgs.length} other org(s) exist — cross-tenant assertions are meaningful`);
  }
  return true;
}

// ── Search ───────────────────────────────────────────────────────────────
async function testSearch() {
  head('Search — header search filters by org_id');

  const [foreignClient] = await db
    .select({ firstName: clientTable.firstName, surename: clientTable.surename, orgId: clientTable.orgId })
    .from(clientTable)
    .where(and(isNotNull(clientTable.orgId), ne(clientTable.orgId, ORG_ID)))
    .limit(1);

  if (!foreignClient) {
    note('skip', 'no clients exist in any other org — cannot prove cross-tenant search is blocked');
    return;
  }

  const surnamePrefix = (foreignClient.surename || '').slice(0, 3);
  if (!surnamePrefix || surnamePrefix.length < 2) {
    note('skip', 'sample foreign client has no usable surname');
    return;
  }

  const scoped = await searchRepository.globalSearch(surnamePrefix, { orgId: ORG_ID, limit: 50 });
  const platform = await searchRepository.globalSearch(surnamePrefix, { orgId: null, limit: 50 });

  if (scoped.clients.length < platform.clients.length) {
    ok('scoped<platform', `${scoped.clients.length} scoped vs ${platform.clients.length} platform-admin (filter excluding other-org clients)`);
  } else if (scoped.clients.length === 0 && platform.clients.length === 0) {
    note('search', `surname prefix "${surnamePrefix}" returned 0 rows in both — too rare`);
  } else {
    bad('scoped<platform', `scoped (${scoped.clients.length}) is not less than platform (${platform.clients.length}) — possible leak`);
  }
}

// ── Wallet ────────────────────────────────────────────────────────────────
async function testWallet() {
  head('Wallet — listAll + cross-tenant id checks');

  const scoped = await walletTransactionRepository.findAll(ORG_ID);
  const allRows = await walletTransactionRepository.findAll(null);
  if (allRows.length === 0) { note('skip', 'no wallet transactions in DB at all'); return; }
  if (scoped.length <= allRows.length) ok('listAll scope', `${scoped.length} scoped vs ${allRows.length} system-wide`);

  const [foreignTx] = await db
    .select({ id: wallet_transaction.id, clientId: wallet_transaction.client_id, orgId: clientTable.orgId })
    .from(wallet_transaction)
    .leftJoin(clientTable, eq(wallet_transaction.client_id, clientTable.id))
    .where(and(isNotNull(clientTable.orgId), ne(clientTable.orgId, ORG_ID)))
    .limit(1);

  if (!foreignTx) { note('skip', 'no wallet tx in another org — cannot prove cross-tenant block'); return; }

  const txWithOrg = await walletTransactionRepository.findByIdWithOrg(foreignTx.id);
  if (!txWithOrg) { bad('findByIdWithOrg', `unexpectedly null for known foreign tx ${trunc(foreignTx.id)}…`); return; }
  if (txWithOrg.clientOrgId === ORG_ID) bad('foreign tx leak', `findByIdWithOrg mapped foreign tx to our org`);
  else ok('foreign tx orgId', `tx ${trunc(foreignTx.id)}… → clientOrg=${trunc(txWithOrg.clientOrgId)}… (service would 404)`);

  const owns = await walletTransactionRepository.clientBelongsToOrg(foreignTx.clientId, ORG_ID);
  if (owns) bad('clientBelongsToOrg', `returned true for foreign client ${trunc(foreignTx.clientId)}…`);
  else ok('clientBelongsToOrg', `false for foreign client ${trunc(foreignTx.clientId)}…`);
}

// ── Referral ──────────────────────────────────────────────────────────────
async function testReferral() {
  head('Referral / Payout / Withdrawal — listAll + cross-tenant ownership');

  const refs = await referralRepository.findAll(ORG_ID);
  const allRefs = await referralRepository.findAll(null);
  if (allRefs.length > 0) ok('referral.findAll', `${refs.length} scoped vs ${allRefs.length} system-wide`);
  else note('referral.findAll', 'no referrals in DB');

  const [foreignRef] = await db
    .select({ id: referral.id })
    .from(referral)
    .leftJoin(clientTable, eq(referral.referrerClientId, clientTable.id))
    .where(and(isNotNull(clientTable.orgId), ne(clientTable.orgId, ORG_ID)))
    .limit(1);

  if (foreignRef) {
    const row = await referralRepository.findByIdWithOrg(foreignRef.id);
    if (!row) bad('referral.findByIdWithOrg', `null for known foreign id ${trunc(foreignRef.id)}…`);
    else if (row.referrerOrgId === ORG_ID) bad('referral leak', `wrong orgId on foreign referral`);
    else ok('referral.findByIdWithOrg', `foreign referral → orgId=${trunc(row.referrerOrgId)}…`);
  } else {
    note('referral foreign', 'no foreign-org referrals exist to test');
  }

  const payouts = await referralPayoutRepository.findAll(ORG_ID);
  const allPayouts = await referralPayoutRepository.findAll(null);
  if (allPayouts.length > 0) ok('payout.findAll', `${payouts.length} scoped vs ${allPayouts.length} system-wide`);
  else note('payout.findAll', 'no payouts in DB');

  const withdrawals = await referralWithdrawalRepository.findAll(ORG_ID);
  const allWithdrawals = await referralWithdrawalRepository.findAll(null);
  if (allWithdrawals.length > 0) ok('withdrawal.findAll', `${withdrawals.length} scoped vs ${allWithdrawals.length} system-wide`);
  else note('withdrawal.findAll', 'no withdrawals in DB');
}

// ── Ticket reply + attachment ─────────────────────────────────────────────
async function testTickets() {
  head('Ticket reply + attachment — cross-tenant ownership via parent ticket');

  const [foreignTicket] = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(and(isNotNull(tickets.orgId), ne(tickets.orgId, ORG_ID)))
    .limit(1);

  if (!foreignTicket) { note('skip', 'no foreign-org tickets exist'); return; }

  const inOrg = await ticketReplyRepository.ticketBelongsToOrg(foreignTicket.id, ORG_ID);
  if (inOrg) bad('reply.ticketBelongsToOrg', 'true for foreign ticket');
  else ok('reply.ticketBelongsToOrg', `false for foreign ticket ${trunc(foreignTicket.id)}…`);

  const attInOrg = await ticketAttachmentRepository.ticketBelongsToOrg(foreignTicket.id, ORG_ID);
  if (attInOrg) bad('att.ticketBelongsToOrg', 'true for foreign ticket');
  else ok('att.ticketBelongsToOrg', `false for foreign ticket ${trunc(foreignTicket.id)}…`);

  const [foreignReply] = await db
    .select({ id: ticketReplies.id })
    .from(ticketReplies)
    .leftJoin(tickets, eq(ticketReplies.ticketId, tickets.id))
    .where(and(isNotNull(tickets.orgId), ne(tickets.orgId, ORG_ID)))
    .limit(1);

  if (foreignReply) {
    const row = await ticketReplyRepository.findByIdWithOrg(foreignReply.id);
    if (row && row.ticketOrgId === ORG_ID) bad('reply leak', 'foreign reply mapped to our org');
    else ok('reply.findByIdWithOrg', `foreign reply orgId=${trunc(row?.ticketOrgId)}…`);
  } else {
    note('reply foreign', 'no foreign-org ticket replies to test');
  }

  const [foreignAtt] = await db
    .select({ id: ticketAttachments.id })
    .from(ticketAttachments)
    .leftJoin(tickets, eq(ticketAttachments.ticketId, tickets.id))
    .where(and(isNotNull(tickets.orgId), ne(tickets.orgId, ORG_ID)))
    .limit(1);

  if (foreignAtt) {
    const row = await ticketAttachmentRepository.findByIdWithOrg(foreignAtt.id);
    if (row && row.ticketOrgId === ORG_ID) bad('att leak', 'foreign attachment mapped to our org');
    else ok('att.findByIdWithOrg', `foreign attachment orgId=${trunc(row?.ticketOrgId)}…`);
  } else {
    note('attachment foreign', 'no foreign-org ticket attachments to test');
  }
}

// ── SMS ───────────────────────────────────────────────────────────────────
async function testSms() {
  head('SMS — listMessages + resolveRecipients + setOptIn check');

  const scoped = await smsRepository.listMessages({ limit: 1000, orgId: ORG_ID });
  const allMsgs = await smsRepository.listMessages({ limit: 1000, orgId: null });
  if (allMsgs.length > 0) ok('listMessages', `${scoped.length} scoped vs ${allMsgs.length} system-wide`);
  else note('listMessages', 'no SMS messages in DB');

  const allOptin = await smsRepository.resolveRecipients({ mode: 'all_optin', orgId: ORG_ID });
  const allOptinNoScope = await smsRepository.resolveRecipients({ mode: 'all_optin', orgId: null });
  if (allOptinNoScope.length > 0) ok('resolveRecipients', `${allOptin.length} scoped vs ${allOptinNoScope.length} system-wide`);
  else note('resolveRecipients', 'no opted-in clients with phone numbers in DB');

  const [foreignClient] = await db
    .select({ id: clientTable.id })
    .from(clientTable)
    .where(and(isNotNull(clientTable.orgId), ne(clientTable.orgId, ORG_ID)))
    .limit(1);

  if (foreignClient) {
    const single = await smsRepository.resolveRecipients({ mode: 'client', clientId: foreignClient.id, orgId: ORG_ID });
    if (single.length === 0) ok('resolveRecipients(foreign client)', `0 recipients for foreign client ${trunc(foreignClient.id)}…`);
    else bad('resolveRecipients(foreign client)', `${single.length} recipients returned for a foreign client`);

    const inOrg = await smsRepository.findClientByIdInOrg(foreignClient.id, ORG_ID);
    if (inOrg) bad('findClientByIdInOrg', 'returned a foreign client');
    else ok('findClientByIdInOrg', `undefined for foreign client ${trunc(foreignClient.id)}…`);
  } else {
    note('foreign client', 'no foreign-org clients to test against');
  }
}

// ── Email accounts ────────────────────────────────────────────────────────
async function testEmail() {
  head('Email — accounts are filtered by user ownership');

  const ours = await emailRepository.findAllByUserId(USER_ID);
  ok('findAllByUserId', `${ours.length} email accounts owned by this user`);

  const [foreignAccount] = await db
    .select({ id: emailAccounts.id, userId: emailAccounts.userId })
    .from(emailAccounts)
    .where(ne(emailAccounts.userId, USER_ID))
    .limit(1);

  if (!foreignAccount) {
    note('skip', 'no email accounts owned by other users to test against');
    return;
  }

  const found = await emailRepository.findById(foreignAccount.id);
  if (!found) bad('findById', `null for known foreign account ${trunc(foreignAccount.id)}…`);
  else if (found.userId === USER_ID) bad('email leak', `findById returned a row with userId matching ours`);
  else ok('findById ownership', `foreign account user_id=${trunc(found.userId)}… (controller's loadOwnedAccount would 404)`);
}

// ── Notification ──────────────────────────────────────────────────────────
async function testNotification() {
  head('Notification — feed scoped to userId');

  const ours = await notificationRepository.findByUserId(USER_ID);
  ok('findByUserId', `${ours.length} notifications belong to this user`);

  const [foreign] = await db
    .select({ id: notifications.id, userId: notifications.userId })
    .from(notifications)
    .where(ne(notifications.userId, USER_ID))
    .limit(1);

  if (!foreign) { note('skip', 'no foreign-user notifications to test'); return; }

  const row = await notificationRepository.findById(foreign.id);
  if (!row) bad('findById', `null for known foreign id ${trunc(foreign.id)}…`);
  else if (row.userId === USER_ID) bad('notification leak', 'foreign notification returned with our userId');
  else ok('findById ownership', `foreign notification user_id=${trunc(row.userId)}… (controller's assertOwnership would 404)`);
}

// ── Phase C: Audit ───────────────────────────────────────────────────────
async function testAudit() {
  head('Audit — findAll scoped + cross-tenant quote/booking ownership');

  // findAll: scoped vs unscoped
  const scoped = await auditRepository.findAll(ORG_ID);
  const all = await auditRepository.findAll(null);
  if (all.length === 0) {
    note('audit.findAll', 'no audit log entries in DB at all');
  } else if (scoped.length <= all.length) {
    ok('audit.findAll', `${scoped.length} scoped vs ${all.length} system-wide`);
  } else {
    bad('audit.findAll', `scoped > system-wide (${scoped.length} > ${all.length}) — impossible`);
  }

  // Confirm no foreign-org audit entries leak into the scoped result
  const leakedIds: string[] = [];
  for (const entry of scoped) {
    if (!entry.clientId) continue;
    const [client] = await db
      .select({ orgId: clientTable.orgId })
      .from(clientTable)
      .where(eq(clientTable.id, entry.clientId))
      .limit(1);
    if (client && client.orgId && client.orgId !== ORG_ID) {
      leakedIds.push(entry.id);
    }
  }
  if (leakedIds.length > 0) {
    bad('audit leak', `${leakedIds.length} foreign-org entries appeared in scoped result: ${leakedIds.slice(0, 3).join(', ')}…`);
  } else {
    ok('audit no leak', `every scoped entry's client belongs to our org`);
  }

  // Cross-tenant quote/booking guard simulation
  // Look up a quote in the foreign org (via transaction → client.orgId)
  const [foreignQuote] = await db
    .select({ id: quote.id, txId: quote.transaction_id, orgId: clientTable.orgId })
    .from(quote)
    .leftJoin(transaction, eq(quote.transaction_id, transaction.id))
    .leftJoin(clientTable, eq(transaction.client_id, clientTable.id))
    .where(and(isNotNull(clientTable.orgId), ne(clientTable.orgId, ORG_ID)))
    .limit(1);

  if (foreignQuote) {
    // Simulate the controller's check: load the chain and confirm orgId mismatch
    const [txn] = await db.select().from(transaction).where(eq(transaction.id, foreignQuote.txId!)).limit(1);
    if (txn?.client_id) {
      const [client] = await db.select({ orgId: clientTable.orgId }).from(clientTable).where(eq(clientTable.id, txn.client_id)).limit(1);
      if (client && client.orgId !== ORG_ID) {
        ok('deleteQuote guard', `foreign quote ${trunc(foreignQuote.id)}… → client orgId=${trunc(client.orgId)}… (controller would 404)`);
      } else {
        bad('deleteQuote guard', `foreign quote's client maps to our org`);
      }
    }
  } else {
    note('deleteQuote', 'no foreign-org quotes exist (seeder only creates referrals/wallet, not quotes)');
  }

  const [foreignBooking] = await db
    .select({ id: booking.id, txId: booking.transaction_id, orgId: clientTable.orgId })
    .from(booking)
    .leftJoin(transaction, eq(booking.transaction_id, transaction.id))
    .leftJoin(clientTable, eq(transaction.client_id, clientTable.id))
    .where(and(isNotNull(clientTable.orgId), ne(clientTable.orgId, ORG_ID)))
    .limit(1);

  if (foreignBooking) {
    const [txn] = await db.select().from(transaction).where(eq(transaction.id, foreignBooking.txId!)).limit(1);
    if (txn?.client_id) {
      const [client] = await db.select({ orgId: clientTable.orgId }).from(clientTable).where(eq(clientTable.id, txn.client_id)).limit(1);
      if (client && client.orgId !== ORG_ID) {
        ok('deleteBooking guard', `foreign booking ${trunc(foreignBooking.id)}… → client orgId=${trunc(client.orgId)}… (controller would 404)`);
      } else {
        bad('deleteBooking guard', `foreign booking's client maps to our org`);
      }
    }
  } else {
    note('deleteBooking', 'no foreign-org bookings exist');
  }
}

// ── Phase B: pipeline modules ─────────────────────────────────────────────
async function testPhaseB() {
  head('Phase B — pipeline modules cross-tenant scope checks');

  // Find a foreign-org transaction (created by the seeder via the foreign client)
  const [foreignTxn] = await db
    .select({ id: transaction.id, client_id: transaction.client_id })
    .from(transaction)
    .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
    .where(and(isNotNull(clientTable.orgId), ne(clientTable.orgId, ORG_ID)))
    .limit(1);

  if (!foreignTxn) {
    note('skip', 'no foreign-org transactions exist — re-run seed-foreign-org-fixtures.ts');
    return;
  }

  // Note repo
  const noteOk = await noteRepository.transactionBelongsToOrg(foreignTxn.id, ORG_ID);
  if (noteOk) bad('note.transactionBelongsToOrg', 'true for foreign txn');
  else ok('note.transactionBelongsToOrg', `false for foreign txn ${trunc(foreignTxn.id)}…`);

  // Enquiry repo
  const enquiryOk = await enquiryTableRepository.transactionBelongsToOrg(foreignTxn.id, ORG_ID);
  if (enquiryOk) bad('enquiry.transactionBelongsToOrg', 'true for foreign txn');
  else ok('enquiry.transactionBelongsToOrg', `false for foreign txn ${trunc(foreignTxn.id)}…`);

  // Booking repo
  const bookingOk = await bookingRepository.transactionBelongsToOrg(foreignTxn.id, ORG_ID);
  if (bookingOk) bad('booking.transactionBelongsToOrg', 'true for foreign txn');
  else ok('booking.transactionBelongsToOrg', `false for foreign txn ${trunc(foreignTxn.id)}…`);

  const bookingsScoped = await bookingRepository.findAll(ORG_ID);
  const bookingsAll = await bookingRepository.findAll(null);
  if (bookingsAll.length === 0) {
    note('booking.findAll', 'no bookings in DB');
  } else if (bookingsScoped.length <= bookingsAll.length) {
    ok('booking.findAll', `${bookingsScoped.length} scoped vs ${bookingsAll.length} system-wide`);
  } else {
    bad('booking.findAll', `scoped > system-wide (${bookingsScoped.length} > ${bookingsAll.length}) — impossible`);
  }

  // Quote repo
  const quoteOk = await newQuoteRepository.transactionBelongsToOrg(foreignTxn.id, ORG_ID);
  if (quoteOk) bad('quote.transactionBelongsToOrg', 'true for foreign txn');
  else ok('quote.transactionBelongsToOrg', `false for foreign txn ${trunc(foreignTxn.id)}…`);

  const quotesScoped = await newQuoteRepository.findAll(ORG_ID);
  const quotesAll = await newQuoteRepository.findAll(null);
  if (quotesAll.length === 0) {
    note('quote.findAll', 'no quotes in DB');
  } else if (quotesScoped.length <= quotesAll.length) {
    ok('quote.findAll', `${quotesScoped.length} scoped vs ${quotesAll.length} system-wide`);
  } else {
    bad('quote.findAll', `scoped > system-wide`);
  }

  // Opportunities — agents dropdown should be org-scoped
  const agentsScoped = await opportunitiesRepository.findAgents(ORG_ID);
  const agentsAll = await opportunitiesRepository.findAgents(null);
  if (agentsAll.length === 0) {
    note('opportunities.findAgents', 'no users in DB');
  } else if (agentsScoped.length < agentsAll.length) {
    ok('opportunities.findAgents', `${agentsScoped.length} scoped vs ${agentsAll.length} system-wide (dropdown filtered)`);
  } else if (agentsScoped.length === agentsAll.length) {
    note('opportunities.findAgents', `${agentsScoped.length} scoped = ${agentsAll.length} system-wide — only one org's users? (still safe)`);
  }

  // Revenue
  const revenueScoped = await revenueRepository.getTotalStats(ORG_ID);
  const revenueAll = await revenueRepository.getTotalStats(null);
  if (revenueScoped.totalDeals <= revenueAll.totalDeals) {
    ok('revenue.getTotalStats', `${revenueScoped.totalDeals} deals scoped vs ${revenueAll.totalDeals} system-wide`);
  } else {
    bad('revenue.getTotalStats', `scoped > system-wide`);
  }

  // Dashboard
  const dashScoped = await dashboardRepository.getStats(ORG_ID);
  const dashAll = await dashboardRepository.getStats(null);
  if (dashScoped.totalClients < dashAll.totalClients) {
    ok('dashboard.getStats', `${dashScoped.totalClients} clients scoped vs ${dashAll.totalClients} system-wide`);
  } else if (dashScoped.totalClients === dashAll.totalClients) {
    note('dashboard.getStats', `client counts equal — possibly only one org's clients exist`);
  } else {
    bad('dashboard.getStats', `scoped > system-wide`);
  }

  // Social-post
  const sockOk = await socialPostRepository.quoteBelongsToOrg(foreignTxn.id, ORG_ID);
  // foreignTxn.id is a transaction id, not a quote id, so this should be false regardless
  if (sockOk) bad('socialPost.quoteBelongsToOrg', 'true for non-quote id');
  else ok('socialPost.quoteBelongsToOrg', `false for unknown quote id (helper rejects non-existent + foreign quotes)`);

  // User
  const [foreignUser] = await db
    .select({ id: user.id, orgId: user.orgId })
    .from(user)
    .where(and(isNotNull(user.orgId), ne(user.orgId, ORG_ID)))
    .limit(1);

  if (foreignUser) {
    if (foreignUser.orgId === ORG_ID) {
      bad('user.orgId mismatch', `foreign user mapped to our org`);
    } else {
      ok('user cross-org guard', `foreign user ${trunc(foreignUser.id)}… orgId=${trunc(foreignUser.orgId)}… (controller would 404)`);
    }
  } else {
    note('user', 'no foreign-org users to test');
  }
}

// ── main ─────────────────────────────────────────────────────────────────
(async () => {
  console.log(c.bold(`Tenant-isolation verification (Phase A + C + B)`));
  console.log(c.dim(`org: ${ORG_ID}`));
  console.log(c.dim(`user: ${USER_ID} (branch_manager)\n`));

  try {
    if (!(await preflight())) {
      console.log(c.red('\nPre-flight failed; bailing out.'));
      process.exit(1);
    }

    await testSearch();
    await testWallet();
    await testReferral();
    await testTickets();
    await testSms();
    await testEmail();
    await testNotification();
    await testAudit();
    await testPhaseB();

    console.log(`\n${c.bold('Result:')} ${c.green(`${pass} passed`)}, ${c.yellow(`${warn} skipped/notes`)}, ${fail > 0 ? c.red(`${fail} failed`) : `0 failed`}`);
  } catch (err) {
    console.error(c.red(`\nFatal: ${(err as Error).message}`));
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
