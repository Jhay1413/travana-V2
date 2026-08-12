# SendSeven Comments & Private Replies

Integration notes for the Comments Beta feature (enabled on our account 2026-08-12).

Docs:
- https://docs.sendseven.com/guides/comments/listen-for-comments
- https://docs.sendseven.com/guides/comments/send-private-replies
- https://docs.sendseven.com/guides/comments/auto-reply-rules

## What the feature is

A comment on a connected Instagram or Facebook Page post can be answered once
with a **private reply** — a DM to the commenter. Three platform rules drive
every design decision below:

1. **One private reply per comment, ever.** Meta-enforced, not a SendSeven
   limit. A second attempt returns `409 private_reply_already_sent`.
2. **7-day window** from comment creation. After that, `410
   private_reply_window_expired`.
3. **SendSeven's own auto-reply rules can spend it first.** A matched rule sets
   `data.auto_replied: true` on the webhook and the comment's one reply is gone.

Because the action is unrepeatable, every layer fails closed rather than
optimistically.

## Architecture

SendSeven stays the system of record, exactly as it is for conversations and
messages. **No local tables, no migration.** The prose guides only document the
webhook, but the OpenAPI spec (`https://api.sendseven.com/api/v1/openapi.json`)
exposes full read + triage endpoints, which is what makes a backfilled queue
possible:

| Endpoint | Use |
| --- | --- |
| `GET /comments` | the queue (filter by `state`, paginated) |
| `GET /comments/{id}` | resolve Meta's `external_id`, re-check eligibility |
| `PATCH /comments/{id}` | triage → `handled` / `ignored` / `pending` |
| `GET /comments/posts` | posts, with `has_unanswered` |
| `GET /comments/posts/{id}/comments` | comments on one post |
| `GET /channels/comment-capabilities` | is this workspace/channel comment-capable |
| `POST /comments/{id}/private-reply` | send the one reply |

`state` values: `pending` (alias `unanswered`), `auto_replied`, `replied`,
`handled`, `ignored`.

### Two ids, and they are not interchangeable

- `SsComment.id` — SendSeven's id, `sc_…`. What our own endpoints take.
- `SsComment.external_id` — **Meta's** id. What the private-reply endpoint takes.

The client only ever sends `sc_…`; the controller re-reads the comment
server-side to resolve `external_id` and to re-check eligibility against fresh
state, since the list the agent clicked may be minutes stale.

## Files

Server (`server/v2/modules/comments/`): standard
routes → controller → service → repository, Zod validators, no DB layer (the
"repository" proxies SendSeven, matching `channels`/`inboxes`).

- Mounted at `/api/v2/comments` with `...auth, sendSevenContext` —
  **`sendSevenContext` is required**, or the call runs with no tenant token.
- `comments.types.ts` holds `canSendPrivateReply` / `isPrivateReplyOpen`, the
  shared eligibility gate (mirrored in `client/.../comments.api.ts`).
- Webhook: `comment.received` added to `SUBSCRIBED_EVENTS` and handled in
  `sendseven-webhook.service.ts` `process()` — publish-only, no persistence.
- Realtime: `comment.received` / `comment.updated` in `realtime.types.ts`;
  client listens in `use-conversations-realtime.ts` and invalidates
  `commentsKeys.all`.

Client (`client/src/features/conversations/`): `api/comments.api.ts`,
`api/use-comments.ts`, `components/comments-panel.tsx`, and
`components/inbox-workspace.tsx` — the Messages/Comments switch that wraps the
existing inbox. The inbox stays mounted (hidden) when Comments is active so
unsent drafts survive the tab switch.

The Comments tab is hidden unless `GET /channels/comment-capabilities` reports a
comment-capable channel: an org without Instagram/Facebook, or without the Beta
flag, sees no tab rather than an unexplained empty queue.

## Deployment step — not automatic

`connectWebhook` prunes and recreates the webhook endpoint, so adding
`comment.received` to `SUBSCRIBED_EVENTS` **only affects orgs whose webhook is
(re)connected afterwards**. Already-connected orgs must be re-registered before
they receive comment events. Until then the queue still backfills over REST —
it just won't update live.

## Deliberately not done yet

**AI auto-replies to comments.** Agreed as a later phase, after the current
testing round. When it lands:

- It must sit behind its **own** org flag, *not* `autoReplyEnabled`. That flag
  governs DMs; reusing it would silently start spending every comment's single
  private reply the moment an org switched the DM bot on.
- Skip anything with `data.auto_replied: true` — a SendSeven rule already
  spent the reply, and posting anyway returns 409.
- **The message-attribution problem.** A private reply creates an outbound DM,
  which comes back as a `message.sent` webhook. The handler in
  `sendseven-webhook.service.ts` reads any outbound message that isn't ours as
  a human reply and hands the conversation to a human. Today that is correct,
  because only agents can send private replies. For AI-sent ones it would be
  wrong — and neither existing detection route works here: the private-reply
  endpoint accepts **no `meta` field** (so the `source: "travana-ai"` tag can't
  be attached), and its `message_id` **may be null on a successful send** (so
  the `aisent:` ledger can't be relied on either). Reconciling on the returned
  `conversation_id` is the likeliest fix. Solve this before enabling AI
  comment replies, or the bot will pause itself on conversations it started.

## Not supported by our proxy (upstream supports them)

`buttons`, `quick_replies`, and `image_url` on private replies. Omitted until
the UI can compose them; note buttons/quick-replies are still "in testing" on
Instagram upstream, and `image_url` is Facebook Messenger only and cannot be
combined with buttons.
