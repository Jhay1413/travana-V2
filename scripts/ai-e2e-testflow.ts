import { sql } from "drizzle-orm";
import { db } from "../server/v2/config/database";
import { internalChatRepository } from "../server/v2/modules/internal-chat/internal-chat.repository";
import { internalChatTestflowService } from "../server/v2/modules/internal-chat/internal-chat-testflow.service";
import type { Scope } from "../server/v2/utils/scope";
import type { InternalChatSession } from "@shared/schema";

// End-to-end AI test via the INTERNAL TEST CHAT (staff test flow) — drives the
// exact reply-worker state machine against the internal_chat tables with a
// synthetic TEST-badged client, using the real LLMs and the real DB configured
// by DATABASE_URL. Run against a DEV database only:
//   npx tsx --env-file=devtest.env scripts/ai-e2e-testflow.ts
// (devtest.env = a copy of .env with DATABASE_URL pointing at the dev DB;
//  gitignored via *.env — do not commit real credentials.)
//
// Journey A (sales): greeting → onboarding → slot-filling → enquiry created →
//   callback time → task created + hand-off.
// Journey B (admin): complaint → onboarding → admin agent opens a ticket.

const ORG_ID = "129f4700-ba0f-4741-a131-063de4d3b39c"; // Tinas Travel Deals (dev)
const USER_ID = "43042832"; // org_admin member (dev)
const scope: Scope = { orgId: ORG_ID, branchId: null, orgRole: "org_admin", orgRoles: ["org_admin"], userId: USER_ID };

interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
}
const results: CheckResult[] = [];
function check(name: string, pass: boolean, detail: string): void {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✅ PASS" : "❌ FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

async function turn(sessionId: string, text: string): Promise<InternalChatSession> {
  const session = await internalChatRepository.findByIdForOrg(sessionId, ORG_ID);
  if (!session) throw new Error(`session ${sessionId} vanished`);
  const { replyMessage } = await internalChatTestflowService.runTestFlowTurn(session, text, scope);
  const after = await internalChatRepository.findByIdForOrg(sessionId, ORG_ID);
  if (!after) throw new Error(`session ${sessionId} vanished after turn`);
  const ctx = (after.context ?? {}) as { domain?: string; ticketOpened?: boolean };
  console.log(`\n🧑 ${text}`);
  console.log(`🤖 ${replyMessage.content}`);
  console.log(
    `   ↳ status=${after.enquiryStatus ?? "-"} needsHuman=${after.needsHuman} clientId=${after.clientId ? "set" : "-"} ` +
      `enquiryId=${after.enquiryId ?? "-"} domain=${ctx.domain ?? "-"} ticketOpened=${!!ctx.ticketOpened}`,
  );
  return after;
}

// Row-level verification for Journey A — usable standalone via
// A_CLIENT_ID/A_ENQUIRY_ID env vars when the conversational part already ran.
async function verifyJourneyARows(clientId: string | null, enquiryId: string | null): Promise<void> {
  if (clientId) {
    const client = await db.execute(sql`select "firstName", surename, badge from client_table where id = ${clientId}::uuid`);
    const c = (client.rows?.[0] ?? {}) as { firstName?: string; surename?: string; badge?: string };
    check("A: client is TEST-badged", c.badge === "TEST", `client="${c.firstName} ${c.surename}" badge=${c.badge}`);
  }
  if (enquiryId) {
    const enq = await db.execute(sql`select id from enquiry_table where id = ${enquiryId}`);
    check("A: enquiry row exists in enquiry_table", (enq.rows ?? []).length === 1, JSON.stringify(enq.rows?.[0] ?? null));
    const task = await db.execute(
      sql`select title, due_date from tasks where entity_id = ${enquiryId} order by created_at desc limit 1`,
    );
    const t = (task.rows?.[0] ?? null) as { title?: string; due_date?: string } | null;
    check("A: callback task created with a due date", !!t?.title && !!t?.due_date, t ? `"${t.title}" due=${t.due_date}` : "no task row");
  }
}

async function main(): Promise<void> {
  if (process.env.SKIP_SALES) {
    console.log("══ Journey A — skipped (SKIP_SALES set); verifying rows from prior run ══");
    await verifyJourneyARows(process.env.A_CLIENT_ID ?? null, process.env.A_ENQUIRY_ID ?? null);
  } else {
  console.log("══ Journey A — SALES: onboarding → enquiry → callback task ══");
  const sessionA = await internalChatRepository.createSession({ orgId: ORG_ID, userId: USER_ID, mode: "test_flow" });
  console.log(`(test session ${sessionA.id})`);

  const salesScript = [
    "hi, im looking to book a holiday to benidorm",
    "im Chris Aitest, my number is 07700 900123",
    "sometime in september, 7 nights, 2 adults, around £1500 total",
    "any dates in september are fine, we're flexible",
    "no other preferences, that's everything thanks",
  ];
  let a: InternalChatSession = sessionA;
  for (const line of salesScript) {
    a = await turn(sessionA.id, line);
    if (a.enquiryStatus === "awaiting_availability") break;
  }
  check("A: onboarding created + linked a client", !!a.clientId, `clientId=${a.clientId ?? "null"}`);
  check("A: enquiry created (awaiting_availability)", a.enquiryStatus === "awaiting_availability", `status=${a.enquiryStatus}`);
  check("A: session carries the enquiry id", !!a.enquiryId, `enquiryId=${a.enquiryId ?? "null"}`);

  a = await turn(sessionA.id, "tomorrow after 2pm works for us");
  check("A: callback time → scheduled", a.enquiryStatus === "scheduled", `status=${a.enquiryStatus}`);
  check("A: handed off after scheduling", !!a.needsHuman, `needsHuman=${a.needsHuman}`);
  await verifyJourneyARows(a.clientId, a.enquiryId);
  }

  console.log("\n══ Journey B — ADMIN: complaint → onboarding → ticket ══");
  const sessionB = await internalChatRepository.createSession({ orgId: ORG_ID, userId: USER_ID, mode: "test_flow" });
  console.log(`(test session ${sessionB.id})`);

  const adminScript = [
    "my room was filthy on my recent booking, i want a refund",
    "Chris Aitest, 07700 900123",
    "it was last week's stay in benidorm, i dont have the booking reference to hand",
  ];
  let b: InternalChatSession = sessionB;
  for (const line of adminScript) {
    b = await turn(sessionB.id, line);
    if (((b.context ?? {}) as { ticketOpened?: boolean }).ticketOpened) break;
  }
  const bCtx = (b.context ?? {}) as { domain?: string; ticketOpened?: boolean };
  check("B: routed to the admin domain", bCtx.domain === "admin", `domain=${bCtx.domain}`);
  check("B: a support ticket was opened", !!bCtx.ticketOpened, `ticketOpened=${!!bCtx.ticketOpened}`);
  if (b.clientId) {
    const tickets = await db.execute(
      sql`select subject, type, status, priority from tickets where client_id = ${b.clientId} order by created_at desc limit 1`,
    );
    const tk = (tickets.rows?.[0] ?? null) as { subject?: string; type?: string; status?: string; priority?: string } | null;
    check("B: ticket row exists for the TEST client", !!tk, tk ? `"${tk.subject}" [${tk.type}/${tk.status}/${tk.priority}]` : "no ticket row");
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n══ ${results.length - failed.length}/${results.length} E2E checks passed ══`);
  if (failed.length) process.exitCode = 1;
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error("E2E test crashed:", err);
    process.exit(1);
  });
