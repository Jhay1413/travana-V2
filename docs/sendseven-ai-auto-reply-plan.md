# SendSeven AI Auto-Reply — Implementation Plan

**Goal:** When a customer message arrives in a SendSeven inbox, our own AI drafts (and optionally sends) a reply back through SendSeven — per-org, opt-in, with guardrails.

**Status:**
- **Phase 1 (webhook infra) built** — schema + migration `0025`, register/disable, signature-verified idempotent receiver (`POST /api/v2/sendseven-webhook/:orgId`, log-only).
- **Phase 2 (bot admin + knowledge base) built** — migration `0026`; `org_bot_config` + `org_knowledge_base` tables; server modules `bot-config` (`GET/PUT /api/v2/bot-config`, enable/disable/mode) + `knowledge-base` (CRUD), org-admin gated; client "AI Assistant" nav group → **Bot Settings** (`/settings/bot`) + **Knowledge Base** (`/settings/knowledge-base`) pages.
- **Phase 3 (identity + AI reply) built** — migration `0027` (`sendseven_conversation_state`); webhook receiver now acks-then-processes-async; **identity resolution** (link → phone/email match → auto-create, `identity.service`); **human-takeover detection** (untagged `message.sent` / assigned `conversation.updated` → `needs_human`); **AI reply worker** (`reply-worker.service`) — gpt-4o reply from bot config + active KB + client context, hand-off gate, **draft** (internal note) or **send** (tagged `meta.source=travana-ai`) per org mode. Rolling-context optimization deferred (worker re-fetches recent thread from SendSeven for now).
- **Phase 4 (enquiry auto-creation) built** — the reply worker now runs the slot-filling state machine: gpt-4o classifies holiday type + intent, collects `enquiry_slots` across turns, summarises + asks the customer to **confirm**, and only on confirmation resolves names→lookup IDs **server-side** (`enquiry-auto-create.service`: holiday type / destinations / board basis; resorts/airports/unmatched → notes) and creates the enquiry via `transactionService.createTransactionWithEnquiry` (client = resolved contact, user = an org admin). Confirmation gate enforced in code (`enquiry_status: collecting → confirming → created`).
- Migrations `0024`–`0027` not yet applied. Phases 5–6 pending (vector store / quote backfill, auto-send rollout + audit UI).
**Decisions locked:** Rollout = **per-org opt-in toggle**. Send mode = **draft-first, auto-send later** (recommended; see §7).

---

## 1. How SendSeven webhooks work (from the docs)

Sources: `docs.sendseven.com/guides/webhooks/{setup,events,signature-verification}`.

### Registration
- `POST /api/v1/webhook-endpoints` — body: `{ name, url (HTTPS only), subscribed_events[], authorization_header?, retry_strategy?, max_retries?, timeout_seconds? }`.
- Scopes: `webhooks:create` (+ `webhooks:read` / `update` / `delete`).
- Returns a **64-char hex secret ONCE** (save it) and `tenant_id`. **Webhooks are per-tenant.**

### Receiver requirements
- Public, **HTTPS only**, must **return 2xx within 30 seconds**.
- Retries on failure: exponential backoff (1m → 5m → 30m → 2h → 8h), then permanent-fail after 5 attempts.
- **Circuit breaker** pauses an endpoint after **20 consecutive failures**.

### Event we consume: `message.received`
Identify inbound customer messages by `data.message.direction === "inbound"` (`"outbound"` = our own agent replies).

```json
{
  "id": "evt_msg_001",
  "type": "message.received",
  "event_id": "evt_msg_001",
  "created_at": "2026-03-04T10:30:00Z",
  "tenant_id": "tenant_abc123",
  "data": {
    "message": {
      "id": "msg_abc123",
      "conversation_id": "conv_xyz789",
      "platform": "whatsapp",
      "channel_id": "ch_123",
      "contact_id": "ct_456",
      "contact_method_id": "cm_789",
      "direction": "inbound",
      "message_type": "text",
      "text": "Customer message content",
      "status": "received",
      "from_id": "+1234567890",
      "external_id": "wamid.abc123",
      "created_at": "2026-03-04T10:30:00Z"
    },
    "conversation": { "id": "conv_xyz789", "channel_id": "ch_123", "contact_id": "ct_456", "status": "open" },
    "contact": { "id": "ct_456", "name": "John Doe", "phone": "+1234567890" },
    "contact_method": { "id": "cm_789", "method_type": "whatsapp_id", "value": "1234567890" }
  }
}
```

### Signature verification
- Headers: `X-Sendseven-Signature: sha256=<hex>` and `X-Sendseven-Timestamp` (unix seconds).
- Signed string is the **raw bytes** `` `${timestamp}.${rawBody}` `` — HMAC-SHA256 with the webhook secret, lowercase hex, prefixed `sha256=`.
- Reject deliveries older than **300s**. Use a **timing-safe** comparison. **Never JSON-parse-then-re-serialize** before verifying — use the exact received bytes.

```js
function verify(rawBody, signature, timestamp, secret) {
  if (!signature?.startsWith("sha256=")) return false;
  const msg = Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), rawBody]);
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(msg).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

---

## 2. Fit with our existing stack

We already have every piece the reply side needs:
- `tenant_id → orgId` via `sendseven_integrations.tenantId`.
- Per-org SendSeven config (parent token + `X-Tenant-ID`) via `conversationIntegrationService.resolveConfig(orgId)`.
- Message send via the `messages` module (`POST /messages`, wrapped in `runWithSendSevenConfig`).
- AI via the `ai-ask` / `ai-enquiry` OpenAI `gpt-4o` pattern.
- CRM context via `contact-link` (SendSeven contact → `client_table`).
- Public URL via `getPublicBaseUrl()`; secret encryption via `utils/encryption`.

---

## 3. Data model changes

Extend `sendseven_integrations` (or a companion table `sendseven_webhooks`):
- `webhook_endpoint_id text` — SendSeven endpoint id (to update/delete).
- `webhook_secret text` — **encrypted** signing secret.
- `auto_reply_enabled boolean default false`.
- `auto_reply_mode text default 'draft'` — `'draft' | 'send'` (see §7).

New table `org_bot_config` — the per-org bot identity + behaviour edited on the Bot admin page (§15):
- `org_id uuid primary key`, `name text` (bot display name), `avatar_url text?`.
- `persona text` — tone/personality ("friendly, concise UK travel expert").
- `preferred_response text` — how it should reply (style, do's/don'ts, what to always ask).
- `greeting text?`, `sign_off text?`, `language text default 'en-GB'`.
- `handoff_instructions text?` — when to escalate to a human.
- `business_hours jsonb?` — optional reply windows.
- `is_enabled boolean default false`, `mode text default 'draft'`, `updated_by`, `updated_at`.
- (This supersedes the earlier `auto_reply_prompt` idea; keep `auto_reply_enabled`/`mode` in sync or read them from here.)

New table `org_knowledge_base` — company info the AI is grounded on (§15):
- `id uuid pk`, `org_id`, `title text`, `content text`, `category text?` (e.g. policies, ATOL/ABTA, specialisms, FAQ), `is_active boolean default true`, `created_by`, `created_at`, `updated_at`.

New table `sendseven_webhook_events` for idempotency + audit:
- `event_id text unique`, `org_id`, `message_id`, `type`, `status` (`received|skipped|replied|failed`), `error text`, `created_at`.

New table `sendseven_conversation_state` — our per-thread memory, keyed by the SendSeven `conversation_id` (see §12–14):
- `conversation_id text primary key`, `org_id`, `contact_id`, `client_id` (resolved).
- `intent` (`enquiry | question | booking_follow_up | other | null`).
- `enquiry_slots jsonb` — the partial `EnquiryIntent` collected so far across turns (§14).
- `enquiry_status` (`collecting | confirming | created | null`), `enquiry_id` (once created). We only write the enquiry after the customer **confirms** (§14).
- `needs_human boolean default false`, `handled_by_human_at` — set when the customer asks for a human (§8); once true the AI stops replying.
- `context jsonb` (rolling recent messages + optional running summary, §13), `last_ai_reply_at`, `mode`, `created_at`, `updated_at`.

---

## 4. Registration lifecycle (per-org opt-in)

Platform-admin toggles auto-reply **on** for an org →
1. Register: `POST /webhook-endpoints` via parent token + `X-Tenant-ID`, `url = <publicBaseUrl>/api/v2/sendseven-webhook/<orgId>`, `subscribed_events: ["message.received", "message.sent", "conversation.updated"]` — `message.received` drives replies; `message.sent` + `conversation.updated` detect a human taking over (§8).
2. Store `webhook_endpoint_id` + encrypted `webhook_secret`, set `auto_reply_enabled = true`.

Toggle **off** → `DELETE /webhook-endpoints/<id>`, clear fields, `auto_reply_enabled = false`.

> Putting `orgId` in the **URL path** lets the receiver pick the right secret to verify **before** trusting any body content. (Alternative: single URL + look up secret by body `tenant_id`, but path is cleaner.)

Idempotent: if an endpoint id already exists, reuse/replace rather than duplicate.

---

## 5. Receiver endpoint

New module `server/v2/modules/sendseven-webhook/` mounted **outside** the `...auth` chain (SendSeven is unauthenticated to us) with **raw-body capture** on that route only (needed for HMAC):

`POST /api/v2/sendseven-webhook/:orgId`
1. Load org + decrypted webhook secret (404/401 if unknown / not enabled).
2. Verify `X-Sendseven-Timestamp` freshness (≤300s) + HMAC over raw body. Reject (401) on mismatch.
3. **Respond `200` immediately.** Do not run AI/send before responding (30s cap).
4. Idempotency: `INSERT event_id` (unique) — if it already exists, skip. Then hand off to the async worker.

Express note: register `express.raw({ type: 'application/json' })` (or capture `req.rawBody` via a verify hook) for this path so the exact bytes are available.

---

## 6. Auto-reply worker (async)

Runs after the 200 ack.
1. **Route by event type** (§8):
   - `message.sent` (outbound) **not** tagged as ours, or `conversation.updated` assigned to a human → set `needs_human` on the state row and return (a human took over).
   - `message.received` && `direction === "inbound"` && text present → continue the reply flow below.
   - anything else → ignore.
2. **Load/update conversation state** by `conversation_id` (§12) and **resolve the client** by `contact_id` (link / match / auto-create, §12).
3. **Stop if handed to a human**: if `needs_human` is set, do nothing. Otherwise run the **handoff check** — if the customer asks for a human / is frustrated / it's out of scope, set `needs_human`, post an internal note to alert agents, send one hand-off line ("I'll get a colleague to help"), and stop. **This is the one hard gate** (§8).
4. **Rate/loop caps** (§8) — bail if exceeded.
5. Build context from the conversation-state row (rolling recent messages + summary, §13) — no full transcript re-fetch.
6. **Classify + act** with `gpt-4o`. System prompt = base guardrails **+ the org's bot config** (`name`, `persona`, `preferred_response`, greeting/sign-off, language) **+ relevant `org_knowledge_base` entries** (company info, §15) **+ resolved client/CRM context**:
   - **Enquiry intent** → run the slot-filling turn (§14): extract any new fields, merge into `enquiry_slots`; if required fields are still missing, reply asking for the next one(s); if complete, **summarise the enquiry back and ask the customer to confirm** — only save once they say yes.
   - **Other intent** → generate a normal helpful reply.
7. **Send** the reply: `POST /messages` (`conversation_id`, `channel_id`, `text`, **`meta: { source: "travana-ai" }`**) in `send` mode, or post an internal-note draft in `draft` mode. The `meta` tag is what lets the later `message.sent` webhook tell our own reply from a human agent's (§8). Append the reply to the state's rolling context.
8. Record outcome (intent, `enquiry_status`, `enquiry_id`, `last_ai_reply_at`) on the state row + `sendseven_webhook_events`.

---

## 7. Send modes

**Goal: the AI replies autonomously (`send`) and keeps the conversation going until the customer asks for a human.** `draft` remains a config option so an org can pilot quality before flipping to full auto.

| Mode | Behaviour | Use when |
|------|-----------|----------|
| **send** (the goal) | AI reply is delivered to the customer automatically, turn after turn, until a human is requested (§8) or the enquiry is created (§14). | Normal operation. |
| **draft** | AI posts a suggested reply as an internal note / prefilled composer; an agent sends it. | Piloting an org before trusting full auto. |

Per-org `auto_reply_mode` lets each org start in `draft` then graduate to `send`.

---

## 8. Guardrails

**The one hard stop is a human taking over** — the AI replies freely until then. The gate is the `needs_human` flag on the conversation-state row, which the worker checks **first** (§6 step 3). It gets set from four sources:

1. **Customer asks for a human** — the AI's per-turn handoff check ("speak to a human" / agent / complaint / clear frustration / out-of-scope) → set `needs_human`, alert the team via internal note, send one hand-off line, stop.
2. **A human agent replies in the thread** — detected via the `message.sent` webhook (subscribe to it too, not just `message.received`). The crux is telling **our AI's own outbound apart from a human's**: we **tag every AI-sent message** with `meta` on `POST /messages` (e.g. `meta: { source: "travana-ai" }`). So on an outbound `message.sent`, if the message is **not** tagged as ours (or its `sender_id` isn't the bot) → a human sent it → set `needs_human`, stop.
3. **Conversation assigned to a human** — via the `conversation.updated` webhook (or `assigned_user` on the payload): if it's assigned to a real agent, set `needs_human`.
4. **Explicit agent control** — a "Take over from AI" button in our inbox (and "Hand back to AI" to clear `needs_human`), giving agents a hard override regardless of the automatic signals.

Once `needs_human` is set the AI is silent on that conversation until it's explicitly handed back.
- **Loop / rate caps**: our sends are `outbound` so they don't re-trigger `message.received`; still cap max AI replies per conversation + a cooldown, and hard-stop after repeated AI/send failures.
- **No sensitive commitments**: prompt forbids quoting firm prices, availability, or confirming bookings the AI can't verify — collect the enquiry and let a human quote.
- **Per-org opt-in** (off by default); optionally per-channel / business-hours.
- **Audit** every AI action in `sendseven_webhook_events`.

---

## 9. Phasing

1. **Infra (no replies):** schema + register/disable webhook + receiver with signature verification + idempotency, logging events only. Prove deliveries verify and dedupe.
2. **Bot admin + knowledge base (§15):** org-admin "AI Assistant" page — bot config (name, persona, preferred response, enable/mode) + knowledge-base CRUD. This is the org-facing control surface and the source of the prompt/grounding.
3. **Identity + reply:** conversation-state + client resolve/auto-create (§12); worker → gpt-4o general reply (using bot config + KB) with the human-handoff gate (§8), behind per-org opt-in. Start in `draft`.
4. **Enquiry auto-creation:** conversational slot-filling → server-side create (§14).
5. **Vector store (§16):** `pgvector` table + KB embeddings + **quote backfill** (`isFreeQuote`) + sync hooks + retrieval, wired into the reply prompt.
6. **Auto-send + audit:** flip an org to `send`; audit view of AI actions.

---

## 10. Prerequisites & config

- Parent token scopes: `webhooks:create/read/update/delete` **+** `messages:create` (+ same-billing-account cross-tenant reach).
- Public **HTTPS** base URL (`getPublicBaseUrl()` / `PUBLIC_BASE_URL`), `OPENAI_API_KEY`, `EMAIL_ENCRYPTION_KEY` (reused to encrypt the webhook secret).
- Express raw-body capture on the webhook route.
- **Server-side lookup resolution** for enquiry auto-creation (§14): unlike the wizard's client-side name→ID resolver, the worker must resolve destination/country/board/airport/holiday-type names to IDs on the server (via the `lookup` repositories).
- **A bot/system user id** to stamp as the enquiry's `user_id` (auto-created enquiries have no human agent), or assign to the org owner / an "Unassigned" bucket.
- **Durability:** MVP uses in-process async; because we've already returned `200`, SendSeven won't retry, so a process restart mid-work drops that reply. For production, move the worker to a queue (Redis/BullMQ) with at-least-once processing keyed on `event_id`.

---

## 11. Open questions

- Which channels to auto-reply on first (WhatsApp only? all)?
- Business-hours-only, or 24/7?
- The exact **soft threshold** for auto-creation (§14) — one signal beyond holiday type, or a firmer minimum?
- How aggressive should the **human-handoff** trigger be (only explicit "speak to a human", or also on frustration/complex questions)?
- After an enquiry is created, should the AI keep chatting or go quiet until a human picks it up?
- May the AI share **indicative pricing** from retrieved past quotes (§16), or only use them internally to ask better questions and let a human quote?
- Quote backfill scope (§16): only `isFreeQuote` quotes, or all active quotes? How far back?

**Decided:** per-org opt-in; goal is full **auto-send** with human-request as the only hard stop; client is **auto-created if not found** (no pre-link required); enquiry is **saved only after the customer confirms**.

---

## 12. Identity & conversation-context resolution

**Principle: the AI never determines identity or thread continuity — stable IDs do.** The AI only does language (classify intent, draft the reply). "Same person / same thread / already in our DB" are deterministic lookups off the IDs SendSeven puts in every `message.received` payload:

- `data.conversation.id` → **the thread**. Every message in a conversation carries the same `conversation_id`; SendSeven does the threading. We never reconstruct threads from message text.
- `data.contact.id` → **the person** (stable per contact per tenant), plus `contact.phone` / `.name` / `contact_method.value`.

### Client resolution (per inbound message — no AI)
Keyed off `data.contact`:
1. `contact_id` → `sendseven_contact_links` → **already linked?** use that client.
2. Not linked → match `phone`/`email` against `client_table` (`neonClientRepository.findMatches`) → **found?** auto-link.
3. Still nothing → **auto-create** a client from `contact.name/phone/email` → link.

Store the resolved `client_id` on the `sendseven_conversation_state` row so later messages skip the work.

### Conversation continuity
One lookup by `conversation_id` on `sendseven_conversation_state` tells us everything we've established (client, intent, `enquiry_id`, whether a human took over). First time we see a `conversation_id`, we create the row. When the thread continues, the AI **updates the existing `enquiry_id`** rather than creating a new enquiry.

### Edge cases to decide
- **One person, multiple channels** = multiple `contact_id`s that should map to **one** client. Our `sendseven_contact_links` is currently 1:1 (unique per contact *and* per client) — relax the per-client uniqueness to allow many contacts → one client.
- **New WhatsApp contact** often has a phone but **no name/email** — auto-create with what's available (phone), enrich later; don't block on missing fields.

---

## 13. Context storage & caching (MVP)

**A dedicated cache is not needed for correctness, and not needed for MVP.** Source of truth is Postgres (the state row) + SendSeven (`GET /messages`). Caching would only trade latency/cost.

**Better than caching — build context incrementally.** Because the flow is webhook-driven, we already receive every inbound message and produce every outbound reply, so we append to a **rolling context on the `sendseven_conversation_state.context` field** instead of re-fetching the whole transcript each time:
- Keep the **last N messages** verbatim (JSON) on the row, appended per webhook/reply.
- For long threads, keep **recent messages verbatim + a running AI summary** of older ones (also caps OpenAI token cost — the bigger win than latency).

This needs **zero extra API calls and no cache invalidation** — the webhook itself signals exactly when to update.

**When Redis earns its place:** only once we add the durable **queue** (BullMQ/Redis) from §10. Redis is then present anyway and naturally covers: **dedup** (SET of processed `event_id`s), **rate-limit counters** for the guardrails (max AI replies per conversation, cooldown), and optionally **hot context** for very high-volume orgs. So caching becomes ~free at that stage — not a separate MVP build.

**Freebie:** on OpenAI, repeated prompt prefixes get automatic provider-side prompt caching — no work required.

### MVP recommendation
- **No cache.** `sendseven_conversation_state` row = context store; append per event; summarize long threads. One PK lookup per webhook.
- **Later:** add Redis with the queue → reuse for dedup + rate limits (+ hot context if volume demands).

---

## 14. Enquiry auto-creation (conversational slot-filling + confirmation)

When the AI classifies the intent as an **enquiry**, it collects the required fields *conversationally* over multiple turns, confirms with the customer, and only then writes the enquiry.

### Required fields (what's actually needed to save)
The DB allows a **destination-less / resort-less enquiry** — in `enquiries`, `country`/`destination`/`resort` are nullable, there's no create-time validator, and the wizard itself only hard-requires **title + holiday type**. So we do **not** block on destination.

- **Hard-required to save:** holiday type (default "Package Holiday") + an auto-generated title. That's it structurally.
- **Collect if offered, never block:** destination / country, travel date / month, nights, party (adults + children/infants), budget, board basis, star rating, departure airport, flexibility.
- **"Somewhere hot, no fixed place"** is a normal enquiry — save it destination-less and put the vibe/preferences ("open to suggestions, wants heat + beach") into **notes**. Resorts and any unmatched values also go to notes (same policy as the wizard).
- **Soft threshold (anti-empty guard):** before moving to *confirming*, require at least **one** meaningful signal beyond holiday type (a destination **or** dates **or** party+budget) so we never log a blank enquiry from an idle "hi".

### Holiday-type detection (drives which fields to collect)
The AI first classifies the enquiry into one of the org's **package types** (from the `packageTypes` lookup) — defaulting to **Package Holiday**. Three flows, mirroring the wizard's branching:

| Type | Detected from | Type-specific slots to collect |
|------|---------------|--------------------------------|
| **Package Holiday** (default) | beach / resort / all-inclusive / general | country, destination, resort, board basis, star rating, departure airport |
| **Cruise Package** | "cruise", ship, cruise line, cabin, ports | cruise destination, cruise line, cabin type (Inside/Outside/Balcony/Suite), pre/post-cruise stay nights, departure airport |
| **Hot Tub Break** | "hot tub", lodge, UK short break, pets | accommodation type, destination (UK), guests, pets, weekend lodge, date flexibility |

Shared across all: travel date/flexibility, nights, party (adults/children/infants + child ages), budget + budget type.

**Implication:** extend `EnquiryIntent` with the cruise/hot-tub fields (`cabinType`, `cruiseLine`, `preCruiseStay`, `postCruiseStay`, `guests`, `pets`, `weekendLodge`, `accommodationType`) and have the AI collect the set matching the detected type. The **create path already maps these** (`buildEnquiryTransaction` → `cabin_type`, `pre_cruise_stay`, `post_cruise_stay`, `no_of_guests`, `no_of_pets`, `weekend_lodge`, `accomodation_type_id`), so no new create logic is needed. Server resolves the detected type name → `holiday_type_id` via the lookup (unmatched → fall back to Package Holiday).

### State machine (on `enquiry_status`)
1. **collecting** — each inbound turn: AI extracts any new fields from the message → merge into `enquiry_slots`. While below the **soft threshold**, naturally ask for the most useful missing detail (destination, dates, party, budget — one or two at a time). Don't force any single field; if the customer has no destination, move on. Repeat until the soft threshold is met (or the customer signals they're done).
2. **confirming** — once there's enough to be useful, the AI **summarises the enquiry back to the customer** ("Just to confirm: 7 nights somewhere hot for 2 adults + 1 child, mid-August, budget ~£2k — shall I log this for one of our advisors to quote?") and asks for a yes/no. Set `enquiry_status = confirming`.
3. **created** — **only when the customer confirms** does the worker create the enquiry (see below), reply with a confirmation ("Done — an advisor will be in touch with options"), and set `enquiry_status = created` + `enquiry_id`.
   - If the customer **corrects** something at the confirm step → merge the change, re-summarise, stay in `confirming`.
   - If they **decline / go quiet** → do not save; stay collecting or drop per rate caps.

> The confirmation gate is mandatory: **nothing is written to the DB until the customer says yes.**

### Creation (server-side)
The worker runs on the server, so — unlike the wizard's client-side resolver — it must:
1. **Resolve names → IDs on the server** (destination/country/board/airport/holiday-type) via the `lookup` repositories; unmatched values go into the enquiry notes (resorts always → notes, same policy as the wizard).
2. **Resolve the client** (already done in §12 — linked / matched / auto-created).
3. Create via the existing enquiry/transaction path with `client_id` = resolved client and `user_id` = the bot/system user (§10). Store `enquiry_id` on the state row so later messages update the same enquiry rather than creating a new one.

### Reuse
This mirrors the manual **[AI enquiry from conversation](../)** feature (server extracts intent, resolves to lookups, creates via `useCreateTransaction`) — the difference is the collection is **multi-turn + customer-confirmed** and the **resolution + create happen server-side** in the webhook worker.

---

## 15. Bot admin page & knowledge base (org_admin)

Org admins configure their bot and feed it company knowledge from a dedicated page — this is what the worker reads to build the system prompt (§6.6).

### Navigation
Add an **"AI Assistant"** group to `ORG_ADMIN_NAV` in `client/src/config/nav.ts` (org_admin-gated, like the existing `/settings/*` items), with two routes registered in `App.tsx` behind `RoleRoute allow={["org_admin"]}`:
- **Bot Settings** → `/settings/bot`
- **Knowledge Base** → `/settings/knowledge-base`

### Bot Settings page (`org_bot_config`)
Form fields:
- **Name** (bot display name) + optional **avatar**.
- **Persona / tone** (e.g. "friendly, concise UK travel expert").
- **Preferred response** — how it should reply: style, always-ask items, do's & don'ts.
- **Greeting** + **sign-off**, **language** (default en-GB).
- **Handoff instructions** — when to escalate to a human.
- **Enable auto-reply** toggle + **mode** (`draft` / `send`) — enabling here triggers webhook registration (§4); disabling deletes it.
- (Optional) business-hours windows.

### Knowledge Base page (`org_knowledge_base`)
- List + **add/edit/delete** entries: **title**, **content** (free text — policies, ATOL/ABTA numbers, opening hours, specialisms, payment terms, FAQ), **category**, **active** toggle.
- Purpose: ground the AI on the company so replies reflect *this* agency, not generic travel advice.

### How the AI consumes the knowledge base
- **Small KB:** inject the org's **active** entries into the system prompt under a "Company information" block (token-capped). Simplest.
- **Larger KB + quote retrieval:** use the shared **`pgvector`** store (§16) — the KB is one of its sources, quotes are the other.

### Server modules
- `bot-config` (routes/controller/service/repository) — `GET/PUT /api/v2/bot-config` (org-scoped, org_admin).
- `knowledge-base` (routes/controller/service/repository) — `GET/POST/PUT/DELETE /api/v2/knowledge-base` (org-scoped, org_admin).
- The webhook worker reads both (bot config + active KB) when composing the prompt.

---

## 16. Vector store — `pgvector` in our Postgres (knowledge base + quotes)

**Required component** (the quote-retrieval use below can't be done by prompt injection). Lives in the existing Postgres — Neon supports the `vector` extension and `drizzle-orm ^0.39` has a native `vector` type, so it stays in one datastore with our existing `org_id` scoping. A dedicated vector DB (Pinecone/Qdrant/Weaviate) is **overkill** at this scale.

### One shared table, multiple sources
```
ai_embeddings {
  id uuid pk,
  org_id uuid,                 -- tenant scoping (filter every query)
  source_type text,            -- 'knowledge' | 'quote'
  source_id text,              -- kb_entry_id or quote.id
  content text,                -- the text that was embedded
  metadata jsonb,              -- source-specific: destination, price, nights, isFreeQuote, quote_ref, status, dates…
  embedding vector(1536),      -- OpenAI text-embedding-3-small
  created_at, updated_at
}
-- CREATE INDEX ON ai_embeddings USING hnsw (embedding vector_cosine_ops);
```
One table + one HNSW index gives unified retrieval; filter by `org_id` + `source_type` (+ `metadata` predicates) per query. (Per-source tables are also fine — the shared table is just less plumbing.)

### Source A — knowledge base
On KB create/edit → chunk `content` → embed → upsert rows (`source_type='knowledge'`); delete cascades. Retrieval feeds the "Company information" block.

### Source B — quotes (the `isFreeQuote` backfill)
So the AI can check **quotes related to what the client is asking** ("we've done similar trips").
- **Backfill job:** one-off script over `quote` (`quote_table`) — e.g. free quotes (`isFreeQuote = true`) and/or all active quotes — building a text blob per quote (title, country/destination/resort, package type, pax, nights, board, price, travel date) → embed → insert with `source_type='quote'` and rich `metadata` (price, dates, `quote_ref`, status, `isFreeQuote`).
- **Keep in sync:** hook on quote create/update/delete to upsert/remove its embedding.
- **Retrieve at reply / enquiry time:** embed the customer's request (or the collected `enquiry_slots`) → `WHERE org_id = $org AND source_type='quote' ORDER BY embedding <=> $q LIMIT k` → hand the top matches to the AI as reference.

### Guardrail interaction
Retrieved quotes are **reference, not a promise.** The no-firm-price rule (§8) still holds — the AI can say "similar trips have been around £X" or use them to ask better questions / suggest options, but firm pricing/availability is confirmed by a human. (Whether the AI may share indicative ranges is a product decision — flag in §11.)

### Config
- `OPENAI_API_KEY` (embeddings reuse it), `EMBEDDING_MODEL=text-embedding-3-small` (1536 dims — keep dimension consistent across all rows/index).
- `CREATE EXTENSION IF NOT EXISTS vector;` in a migration; define the column via drizzle's `vector("embedding", { dimensions: 1536 })`.
