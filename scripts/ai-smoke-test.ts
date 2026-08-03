import fs from "node:fs";
import path from "node:path";
import { classifyConversationRoute } from "../server/v2/modules/ai-conversation/conversation-router";
import {
  describeImageAttachments,
  generateTurn,
  looksLikeActionableAdmin,
  looksLikeAdminAsk,
} from "../server/v2/modules/ai-conversation/ai-conversation.brain";

// Behavioral smoke test for the AI auto-reply brains against the REAL OpenAI
// models — run with: npx tsx --env-file=.env scripts/ai-smoke-test.ts
//
// Deliberately DB-write-free: every call omits orgId, so logAiUsage only
// console-logs and records nothing, and no repository is ever touched. This
// checks model BEHAVIOR (routing, slot extraction, onboarding, vision) — the
// driver's control flow is covered by the vitest suites instead. For a full
// end-to-end run (state machine + enquiry/ticket creation), use the staff
// internal test chat, which writes TEST-badged rows to the configured DB.

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

async function main(): Promise<void> {
  console.log("── 1. Router ─────────────────────────────────────────────");
  const r1 = await classifyConversationRoute({ transcript: "Customer: hi there", latestText: "hi there", enquiryInFlight: false });
  check("router: greeting → general", r1 === "general", `got "${r1}"`);

  const salesMsg = "I want a holiday to Benidorm in September for 2 adults";
  const r2 = await classifyConversationRoute({ transcript: `Customer: ${salesMsg}`, latestText: salesMsg, enquiryInFlight: false });
  check("router: new holiday ask → sales", r2 === "sales", `got "${r2}"`);

  const adminMsg = "any update on my booking?";
  const r3 = await classifyConversationRoute({ transcript: `Customer: ${adminMsg}`, latestText: adminMsg, enquiryInFlight: false });
  check("router: existing-booking status → admin", r3 === "admin", `got "${r3}"`);

  check("deterministic: complaint → actionable admin", looksLikeActionableAdmin("my room was filthy, I want a refund"), "regex fast-path");
  check("deterministic: 'status of my enquiry' → admin ask", looksLikeAdminAsk("what's the status of my enquiry?"), "regex fast-path");

  console.log("\n── 2. Sales turn — slot extraction (known client) ────────");
  const transcript = [
    "Agent: what can I help you with today?",
    "Customer: we're after a week in Tenerife in August, 2 adults and a child, all inclusive, around £2000",
  ].join("\n");
  const turn = await generateTurn(null, [], null, transcript, null, {}, true);
  const s = turn.slots;
  const dest = JSON.stringify([s.destinations, s.countries, s.resorts]).toLowerCase();
  check("sales turn: intent = enquiry", turn.intent === "enquiry", `intent=${turn.intent}`);
  check("sales turn: no hand_off", !turn.hand_off, `hand_off=${turn.hand_off}`);
  check("sales turn: destination Tenerife extracted", dest.includes("tenerife"), dest);
  check("sales turn: 'a week' → nights = 7", Number(s.nights) === 7, `nights=${s.nights}`);
  check("sales turn: adults = 2", Number(s.adults) === 2, `adults=${s.adults}`);
  check("sales turn: children = 1", Number(s.children) === 1, `children=${s.children}`);
  check("sales turn: board basis = All Inclusive", s.boardBasis === "All Inclusive" || (Array.isArray(s.boardBasis) && s.boardBasis.includes("All Inclusive")), `boardBasis=${JSON.stringify(s.boardBasis)}`);
  check("sales turn: budget = 2000 (digits only)", String(s.budget ?? "").replace(/\D/g, "") === "2000", `budget=${JSON.stringify(s.budget)}`);
  console.log(`   reply: "${turn.reply}"`);

  console.log("\n── 3. Onboarding turn (unknown contact) ──────────────────");
  const onboard = await generateTurn(null, [], null, "Customer: hi, im interested in a cruise", null, {}, false);
  const asksForDetails = /name/i.test(onboard.reply) && /(phone|number)/i.test(onboard.reply);
  check("onboarding: asks for name + phone", asksForDetails, `reply="${onboard.reply}"`);
  check("onboarding: no hand_off", !onboard.hand_off, `hand_off=${onboard.hand_off}`);

  console.log("\n── 4. Vision — image attachment reading ──────────────────");
  const imgPath = path.resolve("scripts/ai-smoke-test-passport.png");
  const buffer = fs.readFileSync(imgPath);
  const desc = await describeImageAttachments([
    { buffer, filename: "passport.png", contentType: "image/png", size: buffer.length },
  ]);
  check("vision: returned a description", !!desc, desc ? `"${desc}"` : "null");
  check("vision: identifies a passport-style document", /passport/i.test(desc ?? ""), "");
  check("vision: reads the name off the image", /smith/i.test(desc ?? ""), "");
  check("vision: reads the expiry", /2031/.test(desc ?? ""), "");

  const failed = results.filter((r) => !r.pass);
  console.log(`\n══ ${results.length - failed.length}/${results.length} checks passed ══`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error("smoke test crashed:", err);
  process.exitCode = 1;
});
