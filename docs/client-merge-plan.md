# Client Merge Plan (Reassign duplicate client → surviving client)

## Goal

Resolve duplicate clients by reassigning **all** of a *source* (duplicate) client's
records — deals (enquiries/quotes/bookings), files, notes, tasks, tickets, SMS,
portal data, referrals, wallet — to a *target* (surviving) client, then
soft-archiving the source so it disappears from normal views while keeping a
full audit trail.

## Confirmed decisions

1. **Source fate:** soft-archive + audit (source kept, marked `merged`, points at target). Reversible/traceable.
2. **Permission:** any role may merge, but **both** clients must pass the actor's tenant scope (agents: `createdBy = self`).
3. **Profile conflicts:** target wins; blank target fields back-filled from source; wallet balance merges automatically (ledger-based).

---

## Key architectural insight

Nearly all "deals" hang off the **`transaction`** table via `transaction.client_id`:

```
client_table.id ─< transaction.client_id ─< enquiry_table / quote / booking ─< (all child rows)
```

So reassigning **`transaction.client_id`** moves every enquiry, quote, booking and
*all* their children (flights, accommodation, passengers, images, quote/booking tags,
quote views, travel deals) in a single `UPDATE` — no per-child work. Only tables that
link to the client **directly** need their own reassignment.

`quoteTags`/`bookingTags` have `unique(quoteId, tagId)` / `unique(bookingId, tagId)` — but
since the quote/booking IDs don't change (only their parent transaction's `client_id`
does), **those never collide**. The only collision risk is `clientTags` (`unique(clientId, tagId)`).

---

## Phase 1 — Schema changes (`shared/schema.ts`)

### 1a. Add soft-archive/audit columns to `client_table`

```ts
// new enum
export const client_status_enum = pgEnum("client_status", ["active", "merged"]);

// add to clientTable:
status:        client_status_enum("status").notNull().default("active"),
mergedIntoId:  uuid("merged_into_id").references(() => clientTable.id, { onDelete: "set null" }),
mergedAt:      timestamp("merged_at"),
mergedBy:      text("merged_by").references(() => user.id, { onDelete: "set null" }),
```

### 1b. New audit table `client_merge_log`

```ts
export const clientMergeLog = pgTable("client_merge_log", {
  id:             uuid().default(sql`gen_random_uuid()`).primaryKey(),
  sourceClientId: uuid("source_client_id").notNull(),       // archived, no FK so it survives
  targetClientId: uuid("target_client_id").notNull().references(() => clientTable.id, { onDelete: "cascade" }),
  mergedBy:       text("merged_by").references(() => user.id, { onDelete: "set null" }),
  orgId:          uuid("org_id"),
  branchId:       uuid("branch_id"),
  counts:         jsonb("counts"),   // { transactions, notes, tasks, tickets, files, sms, tags, ... }
  createdAt:      timestamp().notNull().defaultNow(),
});
```

### 1c. Add `insert*Schema` exports for the new table; run `npm run db:generate` then `db:push`.

---

## Phase 2 — Backend (`server/v2/modules/client/`)

Follows the strict **Route → Controller → Service → Repository** flow.

### 2a. Route — `client.routes.ts`
```ts
router.post("/:id/merge", validate(mergeClientValidator), clientController.mergeClient);
```
`:id` = **source** (duplicate) client; body `{ targetId }` = survivor.

### 2b. Validator — `client.validator.ts`
```ts
export const mergeClientValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
  body:   z.object({ targetId: z.string().uuid() }),
});
```

### 2c. Controller — `client.controller.ts`
```ts
mergeClient: asyncHandler(async (req, res) => {
  const result = await clientService.mergeClients(req.params.id, req.body.targetId, getScope(req));
  return successResponse(res, result, "Clients merged successfully");
}),
```

### 2d. Service — `client.service.ts` (validation + orchestration)
- Reject `sourceId === targetId` → `AppError(400)`.
- Fetch both via `clientRepository.findById(id, scope)` (scope-enforced). Missing either → `AppError("Client not found", 404)` — this is also how cross-tenant / not-owned clients are blocked.
- Reject if source already `merged`, or target is `merged` (resolve to final survivor or reject circular) → `AppError(400)`.
- Reject if `source.orgId !== target.orgId` → `AppError(400)`.
- Delegate to `clientRepository.mergeAtomic(sourceId, targetId, actorId)`.

### 2e. Repository — `client.repository.ts` → `mergeAtomic()` in **one `db.transaction`**

Reassignment order (all `WHERE <col> = sourceId` → set to `targetId`):

| Step | Table | Column | Note |
|------|-------|--------|------|
| 1 | `transaction` | `client_id` | moves ALL enquiries/quotes/bookings + children |
| 2 | `notes` | `client_id` | |
| 3 | `task` | `client_id` | |
| 4 | `tickets` | `clientId` | attachments/replies follow via `ticketId` |
| 5 | `clientFiles` | `client_id` | **plain varchar, no FK** — still just an UPDATE |
| 6 | `smsMessagesTable` | `clientId` | |
| 7 | `portalMessages` | `clientId` | |
| 8 | `wallet_transaction` | `client_id` | ledger entries → wallet balance merges automatically |
| 9 | `referral_payout` | `client_id` | |
| 10 | `referral_withdrawal` | `client_id` | |
| 11 | `referral` | `referrerClientId` **and** `referredClientId` | two UPDATEs |
| 12 | `pushSubscriptions` | `clientId` | reassign (keeps device subscriptions) |
| 13 | `webauthnCredentials` | `clientId` | reassign (keeps registered security keys) |
| 14 | `clientTable` | `referredByClientId` | other clients who were referred BY source |

**Special handling (before/within the same tx):**

- **Step 0 — `clientTags` dedup** (must run *before* its reassign): delete source rows whose
  `tagId` already exists on the target, then reassign the survivors. Avoids the
  `unique(clientId, tagId)` violation.
  ```sql
  DELETE FROM client_tags s
   WHERE s.client_id = :source
     AND EXISTS (SELECT 1 FROM client_tags t WHERE t.client_id = :target AND t.tag_id = s.tag_id);
  UPDATE client_tags SET client_id = :target WHERE client_id = :source;
  ```
- **`portalLoginTokens`** are ephemeral single-use SMS codes → **delete** the source's rather than move.
- **Self-referral cleanup** (after step 11): delete any `referral` where
  `referrerClientId === referredClientId` (a client can't refer itself).
- **Profile back-fill** (target survivor): for each nullable field
  (`title, DOB, email, phoneNumber, address parts, avatarUrl, badge, vipTier, vipEnrolledAt, ...`)
  set `target.field = target.field ?? source.field`. Recompute `target.totalReferrals`.
  Wallet balance is derived from `wallet_transaction`, so it merges for free (no balance column).
- **Archive source:** `status = 'merged'`, `mergedIntoId = target`, `mergedAt = now()`, `mergedBy = actorId`.
- **Audit:** insert one `client_merge_log` row with per-table moved counts.

Because the source is **archived, not deleted**, the `onDelete: cascade` tables
(`wallet_transaction`, `tickets`, `clientTags`, `portalMessages`, `pushSubscriptions`,
`webauthnCredentials`, `portalLoginTokens`) are safe — nothing cascades — and we
reassign them explicitly so the target owns them.

### 2f. Hide merged clients from normal views
In `client.repository.findAll`, add `eq(clientTable.status, "active")` to the default
where clause (the whole point: the duplicate vanishes from lists). Allow an explicit
`includeMerged` flag for admin/audit views.

---

## Phase 3 — Frontend (match the existing client area)

> Clients still live in the legacy client area (`src/api/endpoints`, `src/hooks/mutations`,
> flat `pages/`), not `features/` — match what's there.

1. **API**: add `mergeClient(sourceId, targetId)` → `POST /api/v2/clients/:id/merge`, plus an endpoint constant.
2. **Mutation hook**: `useMergeClients()` — on success invalidate `clients`, `transactions`,
   `quotes`, `bookings`, `tickets`, `notes`, `tasks` query keys.
3. **UI flow** (action on the client detail page / clients list):
   - "Merge / resolve duplicate" → search-pick the **target** survivor (client autocomplete, scoped).
   - Confirmation step showing what moves (reuse existing `countByClientId`-style counts for deals/files) and a clear warning.
   - On confirm, fire the mutation; redirect to the surviving client.
4. Optional: a "Possible duplicates" helper that surfaces clients sharing phone/email
   (no DB unique constraint exists, so this is heuristic).

---

## Phase 4 — Edge cases / guards

- `sourceId === targetId` → 400.
- Source or target already `merged` → 400 (or auto-resolve target to its final survivor).
- Either client outside actor scope → 404 (scope-enforced fetch).
- Different orgs → 400.
- Self-referral rows removed post-merge.
- `clientTags` dedup prevents the only realistic unique-constraint collision.
- Legacy `clients` table (distinct from `clientTable`) — confirm it's unused before ignoring it.

---

## Phase 5 — Testing (vitest + docker test DB)

Integration test:
1. Seed two clients (same org); attach to **each**: a transaction+quote, a transaction+booking,
   a note, a task, a ticket (+attachment), a clientFile, an SMS, overlapping + unique clientTags,
   a referral (each direction), wallet transactions.
2. Merge source → target.
3. Assert: all rows now point at target; quote/booking children intact; `clientTags` deduped
   (no unique violation, no dup); self-referral removed; source `status='merged'` with
   `mergedIntoId`; `client_merge_log` row written with correct counts; target back-filled fields;
   wallet balance = sum of both.
4. Negative tests: same-id, out-of-scope target, already-merged source.

---

## Phase 6 — Rollout

1. `npm run db:generate` → review migration → `npm run db:push`.
2. Ship backend endpoint (feature-flag or role-gate if desired).
3. Ship frontend merge UI.
4. Backfill: existing `client_table` rows default to `status='active'` automatically.

## Open items to confirm during build
- Whether `branch_manager` merging should be limited to their own branch (scope already enforces this).
- Whether to expose an "unmerge"/reverse operation (audit log + `mergedIntoId` make it feasible later; out of scope for v1).
