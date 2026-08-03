import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db } from "../server/v2/config/database";
import { internalChatRepository } from "../server/v2/modules/internal-chat/internal-chat.repository";
import { internalChatTestflowService } from "../server/v2/modules/internal-chat/internal-chat-testflow.service";
import type { PendingAttachment } from "../server/v2/modules/sendseven-webhook/admin-data.service";
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

async function turn(sessionId: string, text: string, attachments?: PendingAttachment[]): Promise<InternalChatSession> {
  const session = await internalChatRepository.findByIdForOrg(sessionId, ORG_ID);
  if (!session) throw new Error(`session ${sessionId} vanished`);
  const { replyMessage } = await internalChatTestflowService.runTestFlowTurn(session, text, scope, attachments);
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

  if (process.env.SKIP_ADMIN) {
    console.log("\n══ Journey B — skipped (SKIP_ADMIN set) ══");
  } else {
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
  }

  if (process.env.SKIP_DOC) {
    console.log("\n══ Journey C — skipped (SKIP_DOC set) ══");
  } else {
  console.log("\n══ Journey C — ATTACHMENT: image → vision read → ticket with details ══");
  const sessionC = await internalChatRepository.createSession({ orgId: ORG_ID, userId: USER_ID, mode: "test_flow" });
  console.log(`(test session ${sessionC.id})`);

  const imgPath = path.resolve("scripts/ai-smoke-test-passport.png");
  const buffer = fs.readFileSync(imgPath);
  const passport: PendingAttachment = { buffer, filename: "passport.png", contentType: "image/png", size: buffer.length };

  // Identify + attach in one message: the attachment deterministically forces
  // the admin route, onboarding resolves the existing TEST client from the
  // name+phone, and the same turn falls through to the admin agent with the
  // vision-read note.
  const c = await turn(sessionC.id, "hi its Chris Aitest, 07700 900123 — here's my passport for the booking", [passport]);
  const cCtx = (c.context ?? {}) as { domain?: string; ticketOpened?: boolean };
  check("C: attachment forced the admin route", cCtx.domain === "admin", `domain=${cCtx.domain}`);
  check("C: a ticket was opened for the document", !!cCtx.ticketOpened, `ticketOpened=${!!cCtx.ticketOpened}`);
  if (c.clientId) {
    const tickets = await db.execute(
      sql`select id, subject, description from tickets where client_id = ${c.clientId} order by created_at desc limit 1`,
    );
    const tk = (tickets.rows?.[0] ?? null) as { id?: string; subject?: string; description?: string } | null;
    const desc = `${tk?.subject ?? ""} ${tk?.description ?? ""}`;
    check("C: ticket mentions a passport submission", /passport/i.test(desc), `subject="${tk?.subject}"`);
    check(
      "C: ticket description carries VISION-READ details from the image (name/number/expiry)",
      /smith|123456789|2031/i.test(desc),
      `description="${(tk?.description ?? "").slice(0, 220)}"`,
    );
    if (tk?.id) {
      const atts = await db.execute(sql`select count(*)::int as n from ticket_attachments where ticket_id = ${tk.id}`);
      const n = ((atts.rows?.[0] ?? {}) as { n?: number }).n ?? 0;
      // Informational (not a hard check): file storage may be unconfigured in dev —
      // attachment upload is best-effort by design.
      console.log(`   ℹ️ ticket_attachments rows for this ticket: ${n}${n === 0 ? " (file storage likely unconfigured in dev — upload is best-effort)" : ""}`);
    }
  }
  }

  if (process.env.SKIP_DEAL) {
    console.log("\n══ Journey D — skipped (SKIP_DEAL set) ══");
  } else {
  console.log("\n══ Journey D — DEAL IMAGE: advert screenshot → SALES enquiry from image details ══");
  const sessionD = await internalChatRepository.createSession({ orgId: ORG_ID, userId: USER_ID, mode: "test_flow" });
  console.log(`(test session ${sessionD.id})`);

  const dealBuffer = fs.readFileSync(path.resolve("scripts/ai-smoke-test-deal.png"));
  const dealAd: PendingAttachment = { buffer: dealBuffer, filename: "deal-ad.png", contentType: "image/png", size: dealBuffer.length };

  // The advert mirrors a real EasyJet-style deal card: Tunisia · Sousse,
  // hotel, "Departing: Newcastle Int.", 7 nights, All Inclusive, a date and
  // £579pp — but NO party size, so the AI must extract from the image and
  // then ASK for what's still missing rather than opening a ticket.
  let d = await turn(sessionD.id, "hi its Chris Aitest, 07700 900123 — can you do this deal for us?", [dealAd]);
  const dCtx1 = (d.context ?? {}) as { domain?: string; ticketOpened?: boolean };
  check("D: deal image routed to SALES (no ticket opened)", dCtx1.domain !== "admin" && !dCtx1.ticketOpened, `domain=${dCtx1.domain ?? "-"} ticketOpened=${!!dCtx1.ticketOpened}`);
  const slots1 = (d.enquirySlots ?? {}) as { destinations?: string[]; nights?: number; budget?: string; boardBasis?: string; departureAirports?: string[] };
  const slotsJson = JSON.stringify(slots1).toLowerCase();
  check("D: destination extracted FROM THE IMAGE (Tunisia/Sousse)", slotsJson.includes("tunisia") || slotsJson.includes("sousse"), `slots=${JSON.stringify(slots1)}`);
  check("D: nights extracted from the image (7)", Number(slots1.nights) === 7, `nights=${slots1.nights}`);
  check("D: price extracted from the image (£579)", String(slots1.budget ?? "").includes("579"), `budget=${slots1.budget}`);
  check("D: departure airport extracted from the image (Newcastle)", JSON.stringify(slots1.departureAirports ?? []).toLowerCase().includes("newcastle"), `departureAirports=${JSON.stringify(slots1.departureAirports)}`);
  check("D: board basis extracted from the image (All Inclusive)", JSON.stringify(slots1.boardBasis ?? "").toLowerCase().includes("all inclusive"), `boardBasis=${JSON.stringify(slots1.boardBasis)}`);
  check("D: still collecting — AI asks for what's missing instead of ticketing", d.enquiryStatus === "collecting", `status=${d.enquiryStatus}`);

  if (d.enquiryStatus === "collecting") {
    d = await turn(sessionD.id, "2 adults please, and the date on the deal works for us");
    if (d.enquiryStatus !== "awaiting_availability") {
      d = await turn(sessionD.id, "nothing else, that's everything thanks");
    }
    check("D: enquiry created after supplying the missing details", d.enquiryStatus === "awaiting_availability", `status=${d.enquiryStatus}`);
    if (d.enquiryId) {
      const enq = await db.execute(sql`select id from enquiry_table where id = ${d.enquiryId}`);
      check("D: enquiry row exists in enquiry_table", (enq.rows ?? []).length === 1, `enquiryId=${d.enquiryId}`);
      // The user-reported gap: the airport/board must land on the GENERATED
      // ENQUIRY (join rows), not just in the slots or the note.
      const air = await db.execute(sql`select count(*)::int as n from enquiry_departure_airport where enquiry_id = ${d.enquiryId}`);
      const airN = ((air.rows?.[0] ?? {}) as { n?: number }).n ?? 0;
      check("D: departure airport MAPPED onto the enquiry", airN > 0, `enquiry_departure_airport rows=${airN}`);
      const bb = await db.execute(sql`select count(*)::int as n from enquiry_board_basis where enquiry_id = ${d.enquiryId}`);
      const bbN = ((bb.rows?.[0] ?? {}) as { n?: number }).n ?? 0;
      check("D: board basis MAPPED onto the enquiry", bbN > 0, `enquiry_board_basis rows=${bbN}`);
    }
  }
  }

  if (process.env.SKIP_DEAL_ROUTE) {
    console.log("\n══ Journey E — skipped (SKIP_DEAL_ROUTE set) ══");
  } else {
  // Replays the user-reported misroute: "can you do other dates for this deal?"
  // + deal image, onboard, then a bare date — the classifier used to read the
  // follow-up as an amendment (admin) and force a spurious ticket. The
  // persisted deal-image signal must now keep every turn deterministically on
  // sales.
  console.log("\n══ Journey E — 'other dates for this deal' + image must stay SALES (no ticket) ══");
  const sessionE = await internalChatRepository.createSession({ orgId: ORG_ID, userId: USER_ID, mode: "test_flow" });
  console.log(`(test session ${sessionE.id})`);
  const dealBufferE = fs.readFileSync(path.resolve("scripts/ai-smoke-test-deal.png"));
  const dealAdE: PendingAttachment = { buffer: dealBufferE, filename: "1.png", contentType: "image/png", size: dealBufferE.length };

  let e = await turn(sessionE.id, "can you do other dates for this deal?", [dealAdE]);
  e = await turn(sessionE.id, "jhon fable, 07700 900456");
  e = await turn(sessionE.id, "october 2nd");
  const eCtx = (e.context ?? {}) as { domain?: string; ticketOpened?: boolean };
  check("E: never routed to admin", eCtx.domain !== "admin", `domain=${eCtx.domain ?? "-"}`);
  check("E: NO ticket opened for the date follow-up", !eCtx.ticketOpened, `ticketOpened=${!!eCtx.ticketOpened}`);
  check(
    "E: stayed in the enquiry flow (collecting or created)",
    e.enquiryStatus === "collecting" || e.enquiryStatus === "awaiting_availability",
    `status=${e.enquiryStatus}`,
  );
  if (e.clientId) {
    const tix = await db.execute(sql`select count(*)::int as n from tickets where client_id = ${e.clientId}`);
    const tixN = ((tix.rows?.[0] ?? {}) as { n?: number }).n ?? 0;
    check("E: zero tickets exist for this client", tixN === 0, `tickets=${tixN}`);
  }
  }

  // Replays the user-reported gap: a passport sent BEFORE the tester is
  // identified must survive the onboarding detour — the eventual ticket needs
  // the FILE attached and the vision-read details (name/number/expiry) in its
  // description.
  console.log("\n══ Journey F — passport BEFORE identification → deferred into the ticket ══");
  const sessionF = await internalChatRepository.createSession({ orgId: ORG_ID, userId: USER_ID, mode: "test_flow" });
  console.log(`(test session ${sessionF.id})`);
  const passportBufferF = fs.readFileSync(path.resolve("scripts/ai-smoke-test-passport.png"));
  const passportF: PendingAttachment = { buffer: passportBufferF, filename: "passport.png", contentType: "image/png", size: passportBufferF.length };

  let f = await turn(sessionF.id, "heres my passport you asked for", [passportF]);
  const fCtx1 = (f.context ?? {}) as { domain?: string; pendingAttachmentInfo?: { filenames?: string[] } };
  check("F: pre-identification document routed admin (asks for details, no general chat)", fCtx1.domain === "admin", `domain=${fCtx1.domain ?? "-"}`);
  check("F: deferred-document marker persisted", (fCtx1.pendingAttachmentInfo?.filenames ?? []).includes("passport.png"), JSON.stringify(fCtx1.pendingAttachmentInfo ?? null));

  f = await turn(sessionF.id, "Chris Aitest, 07700 900123");
  const fCtx2 = (f.context ?? {}) as { ticketOpened?: boolean; pendingAttachmentInfo?: unknown };
  check("F: ticket opened on the identify turn", !!fCtx2.ticketOpened, `ticketOpened=${!!fCtx2.ticketOpened}`);
  check("F: deferred marker consumed", !fCtx2.pendingAttachmentInfo, JSON.stringify(fCtx2.pendingAttachmentInfo ?? null));
  if (f.clientId) {
    const tk = await db.execute(
      sql`select id, subject, description from tickets where client_id = ${f.clientId} order by created_at desc limit 1`,
    );
    const t = (tk.rows?.[0] ?? null) as { id?: string; subject?: string; description?: string } | null;
    const desc = `${t?.subject ?? ""} ${t?.description ?? ""}`;
    check("F: ticket description carries the passport details read from the image", /smith|123456789|2031/i.test(desc), `"${(t?.description ?? "").slice(0, 200)}"`);
    if (t?.id) {
      const atts = await db.execute(sql`select count(*)::int as n from ticket_attachments where ticket_id = ${t.id}`);
      const n = ((atts.rows?.[0] ?? {}) as { n?: number }).n ?? 0;
      check("F: the deferred FILE is attached to the ticket", n > 0, `ticket_attachments=${n}`);
    }
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
