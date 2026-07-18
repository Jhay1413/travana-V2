# AI Conversation / SendSeven Bot — Review Fixes Plan

Source: code review (2026-07-18) of the AI conversation brain, conversation router,
internal-chat test flow, and the SendSeven webhook AI services (admin agent,
identity, reply worker). The fail-closed admin identity gate is intact and there
are no architecture violations — this plan covers the correctness bugs,
optimizations, and behavioral trade-offs the review surfaced.

Files in scope:

- `server/v2/modules/sendseven-webhook/reply-worker.service.ts`
- `server/v2/modules/sendseven-webhook/admin-agent.service.ts`
- `server/v2/modules/sendseven-webhook/identity.service.ts` (+ `.test.ts`)
- `server/v2/modules/ai-conversation/ai-conversation.brain.ts`
- `server/v2/modules/ai-conversation/conversation-router.ts`
- `server/v2/modules/internal-chat/internal-chat-testflow.service.ts` (mirror of reply worker)

> Any behavior change to the reply worker MUST be mirrored in
> `internal-chat-testflow.service.ts` — the two are kept branch-for-branch
> identical by design.

---

## Phase 1 — Critical correctness (fix before merge)

### 1.1 Duplicate-ticket race in the admin path

**Where:** `reply-worker.service.ts:425-467`, `admin-agent.service.ts:421`

**Problem:** The enquiry-create path guards side effects with an atomic
`claimStatusTransition(...)` *before* acting. The admin ticket path has no
equivalent — dedup relies on `prevContext.ticketOpened`, which is persisted only
*after* `adminAgent.answer()` returns. SendSeven redelivers webhooks, so two
concurrent deliveries can both enter `adminAgent.answer` before either persists
the flag → two duplicate tickets. The new `forceTicketNow` backstop widens this
window.

**Fix:**
- Add an atomic claim on the conversation-state row before any turn that may
  open a ticket (reuse the `claimStatusTransition` pattern), or dedupe on the
  inbound SendSeven message id.
- On claim failure, skip the turn silently (same as the enquiry path).
- Mirror in the test flow (the claim can no-op there, but keep the branch shape).

### 1.2 Phone false positives create real CRM clients

**Where:** `identity.service.ts:51-59` (`extractPhoneNumber`), consumed at
`reply-worker.service.ts:528, 558, 561`

**Problem:** The 10–15-digit heuristic grabs any digit run from free text — a
booking reference like "the ref is 12345678901" becomes a phone number and
`resolveOrCreateByDetails` silently creates a CRM client with it.

**Fix:**
- Tighten `extractPhoneNumber` to require a plausible phone shape: leading `+`
  or `0`, or common separators (`+44 7911 123456`, `07911-123456`).
- In the beneficiary flow, only trust the extraction when the current step is
  actually phone collection (state-gated), not on arbitrary turns.
- Add test cases: reference-number false positive, >15-digit rejection,
  `+`/`0`-prefixed acceptance.

### 1.3 `forceTicketNow` doesn't suppress re-asking when the model opens the ticket itself

**Where:** `admin-agent.service.ts:440-448`

**Problem:** The canned-confirmation override of `raw` lives only in the
backstop branch. If the model obeys and calls `open_ticket` during the main
loop, its final text can still ask the customer for more details ("could you
give me your booking reference?") — the exact behavior `forceTicketNow` exists
to prevent.

**Fix:** Apply the canned-confirmation override whenever
`forceTicketNow && a ticket was opened this turn`, regardless of whether the
backstop or the model opened it.

### 1.4 Unguarded beneficiary identity DB calls

**Where:** `internal-chat-testflow.service.ts:391-393` and the mirrored
`reply-worker.service.ts:558-561`

**Problem:** The enquiry-create path wraps its DB work in try/catch so a
transient failure can't produce a silent no-reply turn; the beneficiary
`insertClient` / `resolveOrCreateByDetails` calls have no such guard.

**Fix:** Wrap the traveller resolve/insert in try/catch and fall back to
`doHandoff` on throw, consistent with the enquiry-create handling. Mirror in
both drivers.

---

## Phase 2 — LLM cost / latency optimizations

### 2.1 KB sent to the model twice per sales turn

**Where:** `ai-conversation.brain.ts:398-408` (`buildSystemPrompt`), retrieval
issued at `internal-chat-testflow.service.ts:334-335` (and reply-worker mirror)

**Problem:** The full static KB (capped at `KB_CHAR_BUDGET` = 6000 chars) is
embedded in the system prompt AND the same rows come back as vector-retrieved
matches (`retrievedKb`). For any org whose KB fits the budget, the retrieved
block is pure token duplication plus a wasted embedding round-trip per turn.

**Fix:**
- Have the KB builder report whether truncation occurred (e.g. return
  `{ text, truncated }`).
- Only issue the `sourceType: "knowledge"` retrieval — and only merge
  `retrievedKb` into the prompt — when the static KB was actually truncated.
- Mirror in both drivers.

### 2.2 `forceTicketNow` burns up to ~6 LLM round-trips for a predetermined outcome

**Where:** `admin-agent.service.ts:342, 351-414, 421-455`

**Problem:** When `forceTicketNow` is set, the outcome is fixed (open ticket,
reply with canned confirmation), yet the code still runs the up-to-4-iteration
exploratory tool loop plus a possible `tool_choice: "none"` finalizer, then
discards the generated text.

**Fix:** When `forceTicketNow && !ticketAlreadyOpen`, skip the exploratory loop
entirely: make a single LLM call with `tool_choice` forcing `open_ticket` (the
model still fills in a sensible summary from history), then emit the canned
confirmation. Combines naturally with fix 1.3.

### 2.3 Parallelize `getRecentMessages`

**Where:** `internal-chat-testflow.service.ts:146-153` (check reply worker for
the same shape)

**Fix:** Fold `getRecentMessages` into the adjacent
`Promise.all([botConfig, kb, existingClient])` — no data dependency between
them; saves one serialized DB round-trip per turn.

### 2.4 (Deferred) Double `generateTurn` on onboarding-completion turns

**Where:** `reply-worker.service.ts:291` + `:490`, mirrored at
`internal-chat-testflow.service.ts:227` + `:342`

**Problem:** When an unknown contact supplies name + phone + holiday detail in
one message, the onboarding `generateTurn` reply is discarded and a second full
`generateTurn` runs — two large LLM calls in one inbound.

**Status:** Pre-existing, needs onboarding restructuring to fix cleanly.
**Defer** unless doing a larger onboarding refactor; document as a known cost.

---

## Phase 3 — Behavioral trade-offs (decide, then implement)

Each of these changes bot behavior — confirm the desired outcome before coding.

### 3.1 Sticky `adminActionable` forces spurious tickets

**Where:** `reply-worker.service.ts:429-430, 458, 461`

**Problem:** `adminActionable` is persisted as `prevContext.adminActionable || …`
and never cleared. Turn 1: complaint → clarifying question
(`adminActionable=true, adminAsked=true`). Turn 2: customer says "thanks" →
`forceTicketNow` fires → ticket opened in reply to "thanks".

**Proposed fix:** Require the *current* turn to be actionable
(`looksLikeActionableAdmin(latestText)`) for `forceTicketNow`, rather than the
sticky flag; or clear `adminActionable` on non-actionable turns.

### 3.2 Complaints mid-enquiry can't reach the admin bot

**Where:** `reply-worker.service.ts:242-247, 255`

**Problem:** `enquiryInFlight` (now including `hasSubstantiveSignal(priorSlots)`
and `!!prevContext.beneficiary`) hard-forces `route="sales"`. A customer who
gave "Benidorm, September" then says "my existing booking is filthy, I want a
refund" is funneled into holiday slot-filling.

**Proposed fix:** Let a deterministic `ADMIN_COMPLAINT_RE` /
`looksLikeActionableAdmin` match break out of `enquiryInFlight` and route to
admin. Keep everything else sales-sticky.

### 3.3 Hard-coded English beneficiary prompts bypass org voice/language

**Where:** `reply-worker.service.ts:536-541`; canned confirmation at
`admin-agent.service.ts:447`

**Problem:** Traveller name/phone asks (and the ticket confirmation) are
hard-coded English with emoji, while every other customer-facing line goes
through `generateGroupedAsk` / `generateTransitionReply` honoring
`botConfig.persona`, `signOff`, and `language`. Non-English tenants get
mixed-language threads.

**Proposed fix:** Route these lines through the brain with the same bot config
(or at minimum a per-language template keyed off `botConfig.language`). Note:
tension with 2.2, which introduces a canned string — if 2.2 lands first, make
its confirmation language-aware too.

---

## Phase 4 — Tests & cleanup

### 4.1 Test the riskiest new logic

- Export `cleanTravellerName` and unit-test it: "my friend", "your friend",
  "the guy" (generic → rejected) vs real names (accepted).
- Add `extractPhoneNumber` cases per 1.2.
- Cover the beneficiary state machine in the reply worker (or via the test-flow
  service): name capture → phone capture → phone-conflict-confirm-same-number →
  `enquiryClientId` selection.
- Cover `forceTicketNow` gating: fires only after `adminAsked` without a ticket;
  doesn't fire once `ticketOpened`; (after 3.1) doesn't fire on a
  non-actionable turn.

### 4.2 Minor cleanups

- Hoist repeated computations in `reply-worker.service.ts`:
  `looksLikeAdminAsk(latestText)` (lines 217/257), the
  `list.items.find(...)?.attachments` lookup (lines 248/394); and
  `hasSubstantiveSignal(priorSlots)` in the test flow (lines 186/206/333).
- `let sawAdminIntent` → `const` (both drivers).
- Redact phone numbers and trim `mergedSlots`/`rawTurnSlots` dumps from
  `console.log` (reply-worker lines 550/617/688) before GA; longer term, move
  to a leveled logger.

---

## Suggested execution order

| Step | Items | Why |
|------|-------|-----|
| 1 | 1.1, 1.2, 1.3, 1.4 | Correctness; small, independent diffs |
| 2 | 2.2 (+ makes 1.3 trivial), 2.1, 2.3 | Biggest token/latency wins |
| 3 | 3.1, 3.2, 3.3 | Behavior changes — confirm desired outcomes first |
| 4 | 4.1, 4.2 | Lock behavior in with tests, then tidy |

Every step: change reply worker + mirror test flow together, run
`identity.service.test.ts` plus new tests, and sanity-check a sales turn, an
admin ticket turn, and a beneficiary turn through the internal-chat test mode.
