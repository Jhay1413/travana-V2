# Per-Org AI + SendSeven Usage Limits, Metering & Monitoring — Implementation Plan

> Status: PLANNED (2026-07-20). Monitor-only first, enforcement second.
> Business goal: price AI/messaging usage per tenant so the SaaS is profitable.
> Each organization gets a monthly quota for (a) LLM usage (tokens / AI turns) and
> (b) outbound SendSeven messages; usage is recorded to an append-only ledger,
> enforced against per-org limits, and surfaced to org admins and platform admins.

## Assumptions

- No payment processor in scope — mirror the existing SMS credits approach (accrue/record, no collection).
- Metering starts at deploy (no backfill).
- "SendSeven message" = one outbound customer-facing message (NOT internal notes/drafts).
- Limits configured per-org by `platform_admin`, defaulted from plan tier.

## Fit assessment: FITS WITH ADAPTATION — clone the SMS credits subsystem

The codebase already contains a near-identical, proven subsystem — **SMS credits** — to clone rather than invent:

- Per-org config columns on `organization` (`monthlySmsCreditLimit`, `smsOveragePriceCents`, `smsCreditsEnabled`) — `shared/schema.ts:42-44`.
- Append-only + aggregate tables: `smsCreditUsage` (per-org/period aggregate, unique on `(orgId, periodStart)`) and `smsCreditCharge` (overage ledger) — `shared/schema.ts:2611-2645`.
- Atomic, race-safe consume via `SELECT ... FOR UPDATE` in a transaction — `server/v2/modules/platform-admin/platform-admin-credits.repository.ts:148-226` (`consumeOneCredit`).
- Fail-open consumption wrapper — `server/v2/modules/sms/sms.service.ts:18-25` (`consumeSmsCredit`).
- Platform-admin service/repo/routes/validator + audit — `platform-admin-credits.service.ts`, `platform-admin.routes.ts:62-69`.
- Org-facing summary precedent — `sms.controller.ts:368-382`.

Two clean choke points already exist:

1. **SendSeven outbound send** — single repository method `messagesRepository.send()` (`server/v2/modules/messages/messages.repository.ts:30-33`, the only `POST /messages`). Both callers know `orgId`: manual staff send (`messages.service.ts:20`) and AI auto-reply `sendReply(orgId, ...)` (`sendseven-webhook/reply-worker.service.ts:949-982`). `createInternalNote` (drafts/notes) is NOT customer-facing — never counted.
2. **AI token usage** — existing `logAiUsage(site, model, usage)` helper (`ai-conversation/ai-conversation.brain.ts:168-174`) extracts `prompt_tokens`/`completion_tokens`/`cached_tokens` and is already called at every SendSeven-bot LLM call site. Upgrading this one helper to persist usage covers the whole SendSeven bot with near-zero churn.

**Key adaptation:** token counts are only known *after* an LLM call returns (`response.usage`), so AI enforcement is a **soft check** against the running monthly aggregate — the tipping call finishes. SendSeven message count is known pre-send → **hard cap** via atomic consume.

## LLM & SendSeven call-site inventory

**LLM chat call sites** (`openai.chat.completions.create`):

| Site | Feature tag | Usage captured today? |
|---|---|---|
| `ai-conversation/ai-conversation.brain.ts` — generateTurn (`:913`) + transitionReply / beneficiaryAsk / ticketConfirmation / groupedAsk / availabilityParse | `sendseven_bot` | ✅ via `logAiUsage` |
| `ai-conversation/conversation-router.ts:51,64` | `sendseven_bot` | ✅ |
| `sendseven-webhook/admin-agent.service.ts:365,389,444,471` | `sendseven_bot` | partial |
| `internal-chat/internal-chat.service.ts:605,657` (staff chatbot tool loop) | `staff_chat` | ❌ |
| `ai-enquiry/ai-enquiry.service.ts:70` | `enquiry_ai` | ❌ |
| `ai-ask/ai-ask.service.ts:17` | `ai_ask` | ❌ |
| `destination-guru/destination-guru.service.ts:44` | `destination_guru` | ❌ |
| `social-post/social-post.service.ts:197` | `social_post` | ❌ |
| `internal-chat/internal-chat-testflow.service.ts` (test mode) | `staff_chat_test` | ❌ — record but exempt from limits |

**Embeddings**: `server/v2/utils/embeddings.ts:28,37` (`res.usage.total_tokens` currently discarded). Choke point for `ai-embeddings`, `quote/quote-embedding.ts`, `knowledge-base/knowledge-base.repository.ts`. Feature = `embedding`.

**SendSeven outbound send**: `messages.repository.ts:30` (`send`), via `messages.service.ts:20` (source `manual`) and `reply-worker.service.ts:949` (source `ai`, only when `mode === "send" || isHandoff`).

## Risks

- **Post-call token counts** → AI cap is soft; the crossing call completes. (A pre-call token estimate hard gate is possible later, not Phase 1.)
- **Streaming**: current code is non-streaming so `usage` is on the response. If streaming is added, use `stream_options: { include_usage: true }` (usage arrives in the final chunk).
- **Double-counting**: rule = **exactly one recording call per LLM response**. Upgrade `logAiUsage` in place; add explicit recorders ONLY to sites that don't already call it.
- **Webhook path has no user session** → `user_id` nullable on ledger; `orgId` comes from conversation state (`reply-worker.service.ts:196-202`), never `getScope`.
- **Races**: SendSeven consume clones `consumeOneCredit` (`SELECT FOR UPDATE`); AI aggregate increments use atomic `onConflictDoUpdate ... SET total = total + n`.
- **Recording is fail-open** (try/catch, mirror `consumeSmsCredit`) — never break a tenant's AI on a metering DB blip. Enforcement behavior is per-feature (Phase 2 table).
- **Webhook redelivery**: meter at actual `send()` success so suppressed duplicate replies aren't counted (existing guards: `markOurMessage`, ticket dedupe `reply-worker.service.ts:480`).
- **Cost currency**: integer micros (bigint) — never floats. `model_pricing` is super-admin editable with `effective_from` to handle price drift.

---

## Phase 1 — Data model + metering (monitor-only, NO enforcement)

### 1a. Schema (`shared/schema.ts`), migration `0030_*` (latest is `0029`)

```
org_usage_limits            -- per-org limits + tier; super-admin editable
  id uuid pk
  org_id uuid FK organization(id) on delete cascade  UNIQUE
  plan_tier varchar default 'starter'
  monthly_ai_token_limit      integer   -- null = unlimited
  monthly_ai_message_limit    integer
  monthly_sendseven_msg_limit integer
  ai_limits_enabled        boolean not null default true
  sendseven_limits_enabled boolean not null default true
  enforcement_mode         varchar not null default 'monitor'  -- 'monitor' | 'enforce'
  warn_threshold_pct       integer not null default 80
  created_at / updated_at

ai_usage_event              -- append-only ledger (cost analysis + audit)
  id uuid pk
  org_id uuid FK            -- index (org_id, created_at)
  feature varchar           -- 'staff_chat'|'sendseven_bot'|'enquiry_ai'|'ai_ask'|'destination_guru'|'social_post'|'embedding'|'staff_chat_test'
  site varchar              -- fine-grained call-site tag, e.g. 'generateTurn'
  model varchar
  prompt_tokens / completion_tokens / cached_tokens / total_tokens integer not null default 0
  cost_micros bigint not null default 0
  conversation_id varchar   -- nullable
  user_id text              -- nullable (webhook path)
  created_at timestamp

ai_usage_monthly            -- fast aggregate (mirror sms_credit_usage)
  id uuid pk
  org_id uuid FK
  period_start date
  prompt_tokens / completion_tokens / total_tokens bigint default 0
  message_count integer default 0     -- AI turns
  cost_micros bigint default 0
  UNIQUE(org_id, period_start) + index

sendseven_message_usage     -- fast aggregate
  id uuid pk
  org_id uuid FK
  period_start date
  sent_count integer default 0
  ai_sent_count integer default 0     -- subset sent by the bot
  UNIQUE(org_id, period_start) + index

model_pricing               -- super-admin editable cost table
  id uuid pk
  model varchar
  input_micros_per_mtok bigint
  cached_input_micros_per_mtok bigint
  output_micros_per_mtok bigint
  effective_from timestamp
  UNIQUE(model, effective_from)
```

Add `Type`/`InsertType` exports following the SMS block style (`shared/schema.ts:2624`). Seed `model_pricing` + per-plan default limits via `scripts/` seeder. Plan-tier defaults live in `plans.features` jsonb (`shared/schema.ts:81`). Keep limits in `org_usage_limits`, not more columns on `organization`.

### 1b. New module `server/v2/modules/usage/`

- `usage.repository.ts` (Drizzle only): `insertEvent()`, `incrementAiMonthly()` (atomic upsert), `consumeSendsevenMessage()` (clone `consumeOneCredit`, `SELECT FOR UPDATE`), `getAiMonthly()`, `getSendsevenMonthly()`, `getLimits(orgId)`, `computeCostMicros(model, usage)` from `model_pricing`.
- `usage.service.ts`: `recordAiUsage({orgId, feature, site, model, usage, conversationId?, userId?})` — cost + event + aggregate, **fail-open**; `recordSendsevenSend({orgId, source})`; read helpers `getOrgUsageSummary(orgId)`.
- `usage.types.ts`, `usage.validator.ts` (Zod), `usage.controller.ts`, `usage.routes.ts` (org-facing reads land in Phase 3). Register in `server/v2/routes/index.ts` (~line 150).

### 1c. Wiring (minimal churn)

- **SendSeven bot**: upgrade `logAiUsage` (`ai-conversation.brain.ts:168`) to also call `usageService.recordAiUsage`; signature gains `orgId` (already available in `reply-worker` / `admin-agent`). Covers generateTurn + utilities + router + admin-agent in one change. No second recorder on these sites.
- **Staff chatbot**: capture `response.usage` at `internal-chat.service.ts:611/664`, record with `feature:'staff_chat'`, `userId: scope.userId`. Sum tool-loop turns + final turn.
- **enquiry_ai / ai_ask / destination_guru / social_post**: capture usage, record with orgId from caller's scope.
- **Embeddings**: capture `res.usage.total_tokens` in `embeddings.ts`; thread `orgId` (or usage-context param) from callers.
- **SendSeven send**: one `recordSendsevenSend` on successful customer-facing send — `messages.service.ts:20` (manual) and `reply-worker.service.ts:958-966` send branch (ai). Never `createInternalNote`.

Agents: coder → tester (aggregate math + atomic consume, clone `platform-admin-credits.service.test.ts`) → code-reviewer.

## Phase 2 — Enforcement

Flip `enforcement_mode` `monitor` → `enforce` per org once data looks right.

`usageService.checkAiAllowed(orgId, feature)` / `checkSendsevenAllowed(orgId)` → `{ allowed, remaining, warnThresholdCrossed }`. In `monitor` mode always `allowed:true` (still reports warn).

| Feature | Pre-check location | Over-limit behavior | Metering down |
|---|---|---|---|
| Staff chatbot | `internal-chat.service.ts` before OpenAI loop | `AppError(429)` → toast "Monthly AI limit reached" | fail-open |
| SendSeven AI auto-reply | `reply-worker.service.ts` before `generateTurn` | **Hand to human**: skip AI reply, set `needs_human` via existing state machine — never hard-error a customer conversation | fail-open |
| Enquiry AI | `ai-enquiry.service.ts` before call | `AppError(429)` → toast | fail-open |
| ai_ask / destination_guru / social_post | respective service | `AppError(429)` | fail-open |
| SendSeven send (manual + AI) | atomic `consumeSendsevenMessage` | Manual: block `AppError(429)` if hard cap; AI: degrade to draft/`needs_human` | fail-open |

- AI tokens = **soft cap** (in-flight call finishes; new calls blocked at limit). SendSeven = **hard cap** (atomic consume). Warn at `warn_threshold_pct` (80%) — notify/banner, don't block.
- Mid-conversation bot: always degrade to `needs_human`, never silence the customer.
- Review focus: every check keys on server-derived `orgId`, never client-supplied.

## Phase 3 — Monitoring & reporting

**Org-facing** (`usage` module, auth-guarded, org-scoped via `getScope`):
- `GET /api/v1/usage/summary` — current-period AI tokens/turns vs limit, SendSeven sent vs limit, warn state, per-feature breakdown.
- `GET /api/v1/usage/history?months=6`.
- Client: `client/src/pages/settings/usage.tsx` + nav entry in `settings/index.tsx`; TanStack Query hook + `endpoints` constant + shared axios client; gate to `org_admin` via `client/src/lib/permissions.ts`.

**Platform-owner** (extend `server/v2/modules/platform-admin/`, `requirePlatformAdmin`, mirror SMS credit endpoints at `platform-admin.routes.ts:62-69`):
- `GET /organizations/:id/ai-usage`, `.../ai-usage/history`, `PATCH .../usage-limits`, `GET /usage/overview` (cross-org tokens → cost → margin), `model_pricing` CRUD.
- Reuse `AdminActor` + audit (`platform-admin-credits.service.ts:27-46`) so every limit change is audited.
- Client: Usage tab on `client/src/pages/platform-admin/org.tsx` (SMS credits UI lives here) + cross-org usage/cost view.

## Phase 4 — Plan tie-in & rollout

- On org creation / plan change (`onboarding.service.ts`, platform-admin `changePlan`): populate/refresh `org_usage_limits` from `plans.features` defaults, respecting per-org overrides. Overage surfaced informationally like SMS charges (no collection).
- Rollout: deploy Phase 1 with all orgs `monitor`; observe 1–2 periods; set plan defaults; flip select orgs to `enforce`; default new orgs to `enforce`. Monthly `node-cron` job to close periods + emit warn notifications.

## Open questions (decide before building)

1. **AI limit unit**: total tokens, AI turns, or both? *Recommend: tokens as the profit gate, turns as secondary display metric.*
2. **Quota scope**: *Recommend: record everything; exempt `embedding` backfill + `staff_chat_test` from enforcement.*
3. **SendSeven manual-send cap**: hard block or warn-only? *Recommend: soft/warn for manual staff sends, degrade-to-draft for AI.*
4. **Overage model**: pure cap vs SMS-style accrued overage charges (affects cloning `smsCreditCharge`).
5. **Period boundary**: calendar month UTC (matches `startOfMonthUtc`) vs per-org billing anchor.
6. **Pricing seed**: models in use are `gpt-4.1`, `gpt-4.1-mini` (`server/v2/utils/ai-model.ts:13,25`), `text-embedding-3-small` (`embeddings.ts:9`) — confirm current prices when seeding `model_pricing`.

## Files touched

- `shared/schema.ts` (new tables after ~2645), `migrations/0030_*.sql`, `scripts/` seeders
- New `server/v2/modules/usage/*`; register in `server/v2/routes/index.ts`
- `ai-conversation/ai-conversation.brain.ts` (upgrade `logAiUsage`), `conversation-router.ts`, `sendseven-webhook/admin-agent.service.ts`, `sendseven-webhook/reply-worker.service.ts`
- `internal-chat/internal-chat.service.ts`, `ai-enquiry/ai-enquiry.service.ts`, `ai-ask/ai-ask.service.ts`, `destination-guru/destination-guru.service.ts`, `social-post/social-post.service.ts`
- `server/v2/utils/embeddings.ts` + callers (`ai-embeddings`, `quote/quote-embedding.ts`, `knowledge-base/knowledge-base.repository.ts`)
- `messages/messages.service.ts`, `messages.repository.ts`
- `platform-admin/*` (mirror SMS credit files)
- `client/src/pages/settings/usage.tsx`, `settings/index.tsx`, `client/src/pages/platform-admin/org.tsx`, `client/src/lib/permissions.ts`
