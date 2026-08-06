# Facebook Deal Context for AI Replies — Plan

> **Status (2026-08-06):** Phase 1 ✅ (deal embeddings + sync hooks + backfill
> script — run `npm run db:backfill-deal-embeddings` once). Phase 2 ✅ (vector
> pin on `context.dealRef` + live hydration via `deal-context.service.ts`).
> Phase 4 ✅ largely — customer-visible prompt block in `buildSystemPrompt`,
> slot seeding via prompt instruction, child-ages honesty rule, and the
> suggest-reply mirror. Phase 3 (agent-outreach marker + `meta.deal_id` picker)
> not started.

Goal: when a customer messages us on Messenger about a deal we posted on Facebook
(e.g. *"Hi can I get more info on the Tunisia holiday on the 29th October please
flight times child age an hotel xx"*), the AI should identify **which posted deal**
they mean, load its full details, and answer with them — instead of treating it as
a cold enquiry. Same when an agent opens the conversation from a Facebook comment
with a first message naming the deal.

---

## Current state (verified in code)

| Piece | Status |
|---|---|
| Free quotes embedded (`ai_embeddings`, `sourceType: "quote"`) | ✅ exists — synced in `quote.service.ts:176-189`, backfill via `scripts/backfill-quote-embeddings.ts` |
| Posted deal captions (`travel_deal`: title, subtitle, post, price, dates) embedded | ❌ not embedded anywhere |
| Vector retrieval in the reply pipeline | ✅ exists — `reply-worker.service.ts:568-593`, but only fires mid-enquiry (`enquiryish`) |
| Retrieved quotes usable in customer-facing replies | ❌ explicitly forbidden — internal-only block, price stripped (`ai-conversation.brain.ts:925-937`, `quote-embedding.ts:6-9`) |
| Facebook post/referral metadata on inbound webhooks | ❌ none — no post id, no `referral` message type handled |
| Link between a conversation and a posted deal | ❌ none — only `travel_deal.onlySocialsId` exists, never correlated |
| Agent outreach template naming a deal | ❌ none — free-typed today |

**Answer to "do we need to backfill?":** the *quotes* are already backfilled (or
covered by `db:backfill-quote-embeddings`). What needs a NEW backfill is the
**posted deals** (`travel_deal` rows) — that's Phase 1 below. Customers echo the
caption's wording ("All Inclusive Tunisia", "29th October"), so matching against
the caption text is far more reliable than matching against the internal quote.

---

## Phase 1 — Embed posted deals (new `sourceType: "deal"`)

Keep the existing `"quote"` embeddings untouched (they serve the internal
"similar past trips" feature). Add a **separate, customer-facing** embedding per
posted deal. Separation matters because deal captions were posted publicly —
price and hotel are fair game in replies — while quote embeddings must stay
internal.

1. **`server/v2/modules/social-post/deal-embedding.ts`** (new, mirrors
   `quote-embedding.ts`): pure builders.
   - `content`: deal title, subtitle, plain-text of `post` (strip HTML/emoji),
     travel date (also spelled out, e.g. "29 October 2026"), nights, board basis,
     departure airport, resort summary, price.
   - `metadata`: `{ travelDealId, quoteId, onlySocialsId, postSchedule, price,
     travelDate, title }`.
2. **Extend `EmbeddingSourceType`** in `ai-embeddings.service.ts:11` with
   `"deal"`. (`ai_embeddings.source_type` is plain `text` — **no migration
   needed**.)
3. **Sync hooks** in `social-post.service.ts`:
   - after `schedulePost` / `reschedulePost` succeed → upsert embedding
     (a deal counts as "posted" once `onlySocialsId` is set — same definition the
     boards use);
   - `deleteScheduledPost` → `removeSourceById`.
   Best-effort like the quote hooks (embedding failure must not fail the
   schedule call).
4. **`scripts/backfill-deal-embeddings.ts`** (clone of the quote backfill):
   every `travel_deal` with `onlySocialsId IS NOT NULL`, org resolved via
   `quote → transaction.org_id`. Add npm script `db:backfill-deal-embeddings`.
   → **This is the backfill you asked about. Run once after deploy.**

## Phase 2 — Path A: customer message matches a posted deal

In `reply-worker.service.ts`, alongside the existing retrieval block (~line 568):

1. **When to search**: conversation has no pinned deal yet AND the message is
   inbound on a social channel (`conversation.channel_type` in
   `messenger | instagram | facebook`) AND route is `sales` (or the conversation
   is new). NOT gated on `enquiryish` — the whole point is the *first* message.
2. **Search**: `aiEmbeddingsService.retrieve({ orgId, sourceType: "deal",
   query: latestText, limit: 3 })` with a stricter distance cutoff than the
   default 0.45 (start ~0.35; a wrong deal pinned confidently is worse than no
   match). Prefer the most recently posted deal on near-ties.
3. **Pin it**: extend `ConversationContext` (`reply-worker.service.ts:63-163`)
   with `dealRef?: { travelDealId, quoteId, title, source: "vector" | "marker" |
   "meta", matchedAt }`. Persisted in `sendseven_conversation_state.context`
   (jsonb — no migration).
4. **Hydrate, don't trust the embedding text**: with `quoteId`, load live detail
   for the prompt — quote row (title, travel date, nights, price, party),
   `quote_flights` (flight numbers + times), `quote_accomodation` → hotel name +
   board basis. Reuse `findFreeQuotesPaginated`-style joins in a small
   repository method (`quote.repository.findDealContextByQuoteId`).

## Phase 3 — Path B: agent's first message names the deal

Two mechanisms, most-reliable first:

1. **Structured (preferred): `meta.deal_id` on the outbound message.** Add a
   small "attach deal" picker to the inbox composer (searches free quotes /
   scheduled posts, inserts the standard sentence, and stamps
   `meta: { deal_id, deal_title }` on the send). SendSeven echoes `meta` back on
   the `message.sent` webhook, so the handler reads it with zero parsing —
   same trick as `AI_META` / `meta.source` today.
2. **Marker phrase (fallback, covers agents typing in SendSeven's own UI).**
   Fixed grammar: `commented on our <TITLE> deal` — title is whatever sits
   between the fixed prefix **"commented on our "** and the fixed suffix
   **" deal"**. Case-insensitive regex, e.g.
   `/commented on our (.+?) deal/i`.
   Resolution order for `<TITLE>`: exact `ILIKE` on `travel_deal.title` →
   vector search on `"deal"` embeddings with the title as query → give up
   silently (no pin).

Hook point: `sendseven-webhook.service.ts:265-280` — the `message.sent` +
outbound + not-ours branch that today only flips `needsHuman`. Extend it to also
check `meta.deal_id` / run the marker regex, and pin `context.dealRef` (source
`"meta"` or `"marker"`). Then when the customer replies, Phase 4 injects the
deal even though the *customer* never named it.

Agree the exact marker sentence with the agents and document it in the bot
config/help text — it only works if the wording is used verbatim.

## Phase 4 — Brain: customer-visible deal block + slot seeding

1. **Types**: add `deal?: RetrievedDealContext` to `RetrievedContext`
   (`ai-conversation.types.ts:76-89`) carrying the hydrated fields from
   Phase 2.4.
2. **Prompt** (`buildSystemPrompt`, `ai-conversation.brain.ts`): new block,
   *separate from* the internal-only quotes block:
   > "The customer is asking about this deal we posted on Facebook. These
   > details are public — share them freely (hotel, price, dates, flight
   > times): …"
   Include an honesty rule: if a asked-for detail isn't in the data (see child
   ages below), say so and offer to check, never invent.
3. **Seed enquiry slots** from the pinned deal (destination, travelDate,
   nights, boardBasis, departureAirports, holidayType) so the enquiry flow
   doesn't re-ask what the post already states.
4. **Known data gap — child ages**: `quote_table` has adult/child/infant
   *counts* only (no ages), and the sample message asks "child age". The prompt
   must instruct the AI to ask the customer for their children's ages (it needs
   them for the enquiry anyway) rather than claim the deal specifies any.
5. Mirror the same injection in `suggest-reply.service.ts:64-84` so the inbox
   "AI reply" button benefits too.

## Phase 5 — Tests & rollout

- Unit: deal-embedding builders; marker-phrase parser (greedy/edge titles,
  case, emoji); pin/priority logic (meta > marker > vector; never overwrite an
  existing pin from a stronger source with a weaker one).
- Extend `reply-worker.service.test.ts`: first-message deal match path,
  agent-outreach-then-customer-reply path, no-match path unchanged.
- Log every pin (`[deal-context] conv=… deal=… source=… distance=…`) for
  threshold tuning; start with vector pinning behind a bot-config flag if you
  want a soft launch (paths B/meta are deterministic and safe to ship directly).
- Deploy order: Phase 1 + backfill first (harmless, additive), then 2–4.

## Explicit non-goals / later

- True Facebook `referral`/post-id capture (Meta sends `referral` webhooks with
  the post id when a user messages from a post CTA): SendSeven doesn't surface
  it today (`sendseven-webhook.types.ts` has no referral shape). If SendSeven
  ever passes it through in `meta`, add it as the strongest pin source — it
  would make Path A's vector guess unnecessary for post-CTA conversations.
- One message per attachment / multi-deal disambiguation ("which Tunisia one?")
  — if two similar deals match closely, the AI should ask which date/price the
  customer saw; covered by prompt wording, not extra code, in v1.
