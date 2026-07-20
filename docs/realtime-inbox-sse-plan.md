# Real-Time Inbox Updates via SSE — Implementation Plan

The conversations inbox currently requires a manual refresh to see new messages
(every inbox query is a plain `useQuery` with `staleTime` and **no polling** —
conversations list `use-conversations-queries.ts:20-27`, messages
`use-messages.ts:11-18`). Messages originate from SendSeven webhooks and the AI
reply worker. This plan adds Server-Sent Events so the inbox updates live.

**Verdict: fits the architecture cleanly — greenfield (no realtime mechanism
exists), with one real constraint to design around: the Replit `autoscale`
deployment (multiple ephemeral instances).**

---

## Why SSE (not WebSocket)

- The flow is strictly **one-way** (server → browser). Sending messages already
  works via REST; nothing needs to push upstream over the socket.
- `EventSource` sends **same-origin cookies automatically** — the existing
  session auth (`isAuthenticated` + `orgBranchScope`) protects the SSE GET with
  zero handshake changes. (EventSource cannot send custom headers — cookie auth
  is the correct fit; do NOT introduce a bearer-header requirement.)
- Built-in auto-reconnect in every browser; no new protocol or library.

Favorable codebase facts (verified):

- No compression middleware anywhere (`server/index.ts:24-33`) — the classic
  SSE-breaker is absent. If compression is ever added, exclude
  `text/event-stream`.
- Dev is same-origin: Vite runs as middleware on the same http server
  (`server/index.ts:112-113`), no `server.proxy` in `vite.config.ts` — no dev
  proxy to configure.
- `axiosClient` is `baseURL: ""` + `withCredentials: true` — same-origin in dev
  and prod.

---

## Core design decisions

1. **Thin events → targeted invalidations (NOT fat payloads).** Events carry
   only `{ type, conversationId, ... }`; the client responds by invalidating the
   matching TanStack queries and refetching through the existing org-scoped
   REST endpoints. SendSeven stays the single source of truth; the webhook
   payload shape differs from the REST `SsMessage` shape, so writing webhook
   payloads into the query cache would cause shape drift. Bonus: even a
   mis-delivered thin event cannot leak another tenant's content — the content
   always flows through scoped REST.
2. **In-process event bus keyed by orgId, behind an interface.**
   `publish(orgId, event)` / `subscribe(orgId, handler): unsubscribe` wrapping a
   Node `EventEmitter`. The orgId namespacing is the tenant guard. The interface
   is the swap seam for Postgres `LISTEN/NOTIFY` or Redis pub/sub later.
3. **No Last-Event-ID replay in v1.** On (re)connect the client fires one broad
   invalidation and re-syncs from REST — a replay buffer adds memory and
   correctness burden for no gain when REST is the recovery path.
4. **One shared EventSource per tab** — browsers cap HTTP/1.1 at ~6 connections
   per origin; per-conversation streams would break the app.
5. **Slow-poll fallback stays as the correctness net** (see multi-instance
   caveat below).

### Deployment decision (RESOLVED 2026-07-19)

Deployment was Replit **autoscale** (max 3 machines), where a webhook landing
on one instance couldn't reach an SSE stream pinned to another. **Decision: the
user is switching the deployment to a Reserved VM** — single always-on
instance, so the in-process bus is fully reliable, long-lived SSE connections
are first-class, and no cross-instance transport is needed. The bus interface
seam is retained anyway (cheap insurance if the deployment ever changes back to
multi-instance). The slow-poll fallback is also retained as a resilience net
for transient disconnects/restarts, not as a delivery mechanism.

---

## Event catalog → query invalidations

| Event | Server publish point | Client invalidation |
|---|---|---|
| `message.received` | webhook `process()` inbound branch (`sendseven-webhook.service.ts:228-230`) | `messagesKeys.list(convId)` + `conversationsKeys.all` + badge counts |
| `message.sent` (staff) | `messages.service.ts send()` (~:19-30) | same as above |
| `message.sent` (AI reply/draft) | `sendReply` in `reply-worker.service.ts` (~:945-969) — single choke point for AI outbound, both send and draft paths | `messagesKeys.list(convId)` + `conversationsKeys.all` |
| `conversation.updated` / assignment | webhook `conversation.updated` branch (`sendseven-webhook.service.ts:217-225`) | `conversationsKeys.detail(convId)` + `conversationsKeys.all` + badges |
| `ai-state.changed` | `enableAi`/`disableAi`/`pauseAiForStaffReply` (`sendseven-webhook.service.ts:241-263`) + every `setNeedsHuman` path (human takeover `:211-212`, `:222`; reply-worker handoff/wind-down) | `conversationsKeys.aiState(convId)` — drives the AI badge live |

All publish points already have `orgId` in scope. Publishes are **best-effort**
(try/catch, warn log) — a bus failure must never break the webhook ack or a
staff send.

---

## Phases

### Phase 1 — Server: event bus + SSE endpoint (coder → code-reviewer)

New `server/v2/realtime/` module:

- `event-bus.ts` — singleton EventEmitter wrapper; `publish`/`subscribe` keyed
  by orgId. Infra-level (like a logger) — importable by services.
- `realtime.types.ts` — thin `RealtimeEvent` union.
- `realtime.service.ts` — pass-through to the bus. **No `res`, no HTTP.**
- `realtime.controller.ts` — owns the long-lived `res` (this is the HTTP layer,
  so the Route→Controller→Service layering is respected): headers
  (`Content-Type: text/event-stream`, `Cache-Control: no-cache`,
  `Connection: keep-alive`, `X-Accel-Buffering: no`), `res.flushHeaders()`,
  subscribe with `getScope(req).orgId`, write events as SSE frames, `: keep-alive`
  comment every ~25s, on `req.on("close")` clear the timer and unsubscribe.
  Send an initial `: connected` comment so the client's `onopen` can resync.
- `realtime.routes.ts` — `GET /stream`; mount in `server/v2/routes/index.ts` as
  `router.use('/realtime', ...auth, realtimeRoutes)` (same `auth` tuple as
  `/conversations`).

Test: `curl -N --cookie <session> localhost:5000/api/v2/realtime/stream` →
headers, connected comment, heartbeats. Unit-test the bus: org isolation (org B
subscriber never sees org A events) + unsubscribe.

### Phase 2 — Wire the publishers (coder → code-reviewer)

Insert `eventBus.publish(orgId, {...})` at the four catalog points (webhook
service, reply-worker `sendReply`, messages service `send`, ai-state paths).
Best-effort wrapping mirrors the existing `pauseAiForStaffReply` try/catch.

Test: replay a signed webhook to `/api/v2/sendseven-webhook/:orgId` and watch
frames arrive on the `curl -N` stream. No real SendSeven traffic needed.

### Phase 3 — Client: hook + invalidations + fallback (coder → code-reviewer)

- `client/src/features/conversations/api/use-conversations-realtime.ts` — opens
  ONE `EventSource("/api/v2/realtime/stream")`; maps events → invalidations per
  the catalog (reusing `conversationsKeys`/`messagesKeys`); `onopen` fires a
  broad resync invalidation; exposes `connected`.
- Mounted once at the top of `conversations-inbox.tsx`; exported via the
  feature `index.ts`.
- **Fallback:** while disconnected, enable a slow `refetchInterval` (30–60s) on
  the conversations + messages queries; disable it when SSE is live.
  EventSource auto-reconnects — no manual backoff needed.
- **Visibility:** close/pause on `document.hidden`, reopen on focus.

Test: live inbox with replayed webhooks; kill the server → poll keeps it fresh;
restart → SSE auto-recovers.

### Phase 4 — Extended events (coder → code-reviewer)

Verify ai-state changes flip the AI badge live (all `setNeedsHuman` paths
covered), AI drafts appear live in draft mode, assignment changes refresh
detail + badges. Mostly exercises the Phase 2 seam.

### Phase 5 — Hardening (enhancer → code-reviewer)

- Client-side debounce: coalesce bursts of `message.*` events per conversation
  (~250ms) to avoid refetch storms during fast AI exchanges.
- Server-side per-user connection cap (replace oldest beyond N tabs).
- Connection lifecycle logging (open/close counts).
- Document the bus swap seam (Postgres LISTEN/NOTIFY — would add a repository
  for the DB channel, keeping layering — vs Redis pub/sub).

### Phase 6 — Tests (tester → code-reviewer)

- Unit: bus org isolation + unsubscribe.
- Integration: SSE controller headers, event delivery, heartbeat, close
  cleanup.
- Client: event → invalidation mapping; fallback poll enabled when
  disconnected.

---

## Decisions

1. **Deployment**: ✅ RESOLVED — Reserved VM (user switching from autoscale).
   In-process SSE is fully reliable; no cross-instance transport needed.
2. ~~Cross-instance transport~~ — moot under Reserved VM; the bus interface
   seam is kept as insurance.
3. **Event scope**: org-wide to all staff (v1 default — consistent with
   org-scoped REST; thin events leak nothing).
4. **Draft-mode UX**: AI drafts push live to all viewers (v1 default — drafts
   are already visible to any staff member who opens the conversation).
5. **Per-user connection cap**: default 5 concurrent streams per user
   (Phase 5), oldest replaced.
