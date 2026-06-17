# Better Auth Migration Plan

> **Status:** DRAFT — for review. No code changes have been made.
> **Goal:** Replace the current custom authentication (email/password sessions via Passport + express-session, Replit OIDC, and a separate portal JWT) with [better-auth](https://better-auth.com), while preserving the multi-tenant CRM's tenant isolation and RBAC.
> **Hard requirement:** the migration MUST be backward compatible — no forced logouts, no forced password resets, no breaking changes to the API contract the client depends on, and instant rollback at every phase. See [§6 Backward compatibility](#6-backward-compatibility-coexistence--rollback).

---

## 1. Executive summary

The migration is **more feasible than it first appears**, for two reasons discovered during code review:

1. **The `user` table is already better-auth-shaped** (`shared/schema.ts:88-117`): `id` (text PK), `name`, `email` (unique), `emailVerified` (bool), `image`, `createdAt`, `updatedAt`, `role`, `banned`/`banReason`/`banExpires` — using better-auth's exact camelCase DB column names. This codebase was clearly scaffolded with better-auth in mind, but the runtime was never wired in.
2. **The source tree is already ESM** (`package.json` has `"type": "module"`). The only CommonJS artifact is the **build output** (`dist/index.cjs`), which is a one-line change in `script/build.ts`.

**Recommended strategy (the key decision):** use better-auth for **authentication + session management only**, and **keep the existing multi-tenant authorization layer entirely as-is**. better-auth owns *"who is this user and is their session valid."* The existing layer continues to own *"what org/branch/roles does this user have and what can they see."*

The integration collapses to **one seam**: rewrite `isAuthenticated` so it validates the session via better-auth and populates `req.user` — after which `getUserId` and `orgBranchScope` keep working unchanged, and all downstream route files stay untouched.

---

## 2. Current auth (verified)

| Concern | Current implementation | File(s) |
|---|---|---|
| Email/password | bcryptjs (10 rounds), password in `user.password` | `server/v2/middlewares/auth/require-auth.ts` |
| Sessions | express-session + connect-pg-simple, `sessions` table (sid/sess/expire), cookie `connect.sid`, 7-day TTL, `SESSION_SECRET` | `server/v2/middlewares/auth/session.ts`, `shared/schema.ts:82-86` |
| Replit OIDC | Passport + openid-client, issuer `replit.com/oidc`, `REPL_ID` | `server/v2/middlewares/auth/session.ts` |
| Portal auth | Separate JWT (clientId/email, magic links, PINs) for client-portal users — NOT staff | `server/v2/modules/portal/portal-auth.ts` |
| Auth middleware | `isAuthenticated` + `orgBranchScope` chained centrally | `server/v2/routes/index.ts:64` |
| User-id extraction | branches on `req.user.authType` (password → `user.userId`, OIDC → `user.claims.sub`) | `server/v2/utils/get-user-id.ts` |
| Authorization | 7 ranked roles, multi-role-per-user, org/branch scoping | `server/v2/utils/scope.ts`, `server/v2/modules/user-org-roles/`, `shared/schema.ts:2212-2226` |
| Impersonation | platform_admin org-context switch via `req.session.impersonateOrgId` | `server/v2/middlewares/org-branch-scope.ts` |
| Client | axios `withCredentials:true`, cookie-based, React Query | `client/src/api/endpoints/auth.api.ts`, `client/src/hooks/use-auth*.ts` |

**Verified facts that shape the plan:**

- `account`, `verification`, `member`, `invitation` tables **do not exist** (grep-confirmed) — must be created.
- `isAuthenticated` is referenced in **21 files / 77 occurrences**, but wired centrally at `server/v2/routes/index.ts:64` (`const auth = [isAuthenticated, orgBranchScope]`). This single chokepoint is the integration seam — most route files don't import auth directly.
- `express.json()` is mounted globally at `server/index.ts:25-32`, **before** all routes. This conflicts with better-auth's requirement that its handler mount before the JSON parser.

---

## 3. Fit assessment

**Verdict: FITS WITH ADAPTATION.** better-auth handles authentication (credentials, sessions, password reset, email verification, banning) cleanly, and the schema is already ~80% shaped for it. Three things need care: the build-output format, the session-table swap, and the password column move.

### 3.1 Why NOT use the better-auth organization plugin (most important decision)

Keep the existing role/scope/multi-tenant authorization layer as-is. Evidence:

- The org plugin's `member.role` is **flat, single-role per org** (default owner/admin/member). The app has a **7-role ranked hierarchy** (`scope.ts:4-11`, ranks 100/80/60/50/40/20) with a primary-vs-union distinction (`scope.ts:13-37`) and a junction table allowing **multiple roles per user per org** (`user_org_roles`, unique on userId+orgId+role). better-auth's model can't represent this without net-negative rework.
- The org→branch→member nesting (`branch_members` with `isActive`, branch metadata) maps to better-auth "teams," but teams are **flat with no parent-child** and don't carry branch metadata.
- The entire data-scoping system reads `req.orgId/orgRole/orgRoles` set by `orgBranchScope`. None of it reads better-auth session state. Swapping authorization would touch ~45 `orgId` references and every scoped repository — enormous blast radius, directly endangering tenant isolation.
- Impersonation via `req.session.impersonateOrgId` is **org-context switching** for platform_admin, not user impersonation. better-auth's `impersonateUser` is a different concept and wouldn't replace it.

### 3.2 Sub-questions

- **(a) CommonJS → ESM:** Not a blocker. Source is already ESM. Change `script/build.ts` to `format: "esm"`, output `dist/index.mjs`, update `package.json` start script, add `better-auth` (+ deps) to esbuild `external`/allowlist.
- **(b) Session model change:** Real schema change, but handled backward-compatibly. Rather than invalidating existing `connect.sid` cookies, the dual-read shim (Phase 4b) keeps express-session mounted during a transition window so in-flight sessions stay valid until their 7-day TTL; new logins use better-auth. **No mass logout.** Old `sessions` table retained for rollback.
- **(c) Password move user → account:** Required. Copy `user.password` (bcrypt) into an `account` row with `providerId="credential"`. Configure better-auth with **custom bcrypt hash/verify** so existing 10-round hashes verify with **zero resets**.
- **(d) Org plugin / teams:** Do not adopt — see 3.1.
- **(e) Replit OIDC:** Recommend **dropping** it (Replit-host-specific). If SSO is wanted later, add better-auth's `genericOAuth`/SSO plugin as a separate phase. Verify no active staff log in via OIDC first.
- **(f) Portal JWT:** **Keep as-is.** Distinct identity domain (clients, not staff), self-contained, magic-link/PIN flows better-auth doesn't model natively. Out of scope.

### 3.3 Tenant onboarding compatibility (keep the existing flow)

**Question:** does better-auth support the tenant onboarding process?
**Answer:** better-auth *can* coexist with it, but its **organization plugin does NOT fit this onboarding** — keep onboarding custom and let better-auth own only credential storage.

**The current onboarding is richer than better-auth's model.** `server/v2/modules/onboarding/` exposes a fully **anonymous, self-serve** `POST /onboarding/signup` that, in a **single atomic Drizzle transaction** (`onboarding.repository.ts:47-145`), creates:
- the `organization` (plan=starter, seatLimit, `trialEndsAt`+14d),
- seeded `tour_operator` rows,
- multiple `branches` (first marked `isDefault`),
- the **owner** user + `branch_members` + `user_org_roles` + `hr_records`,
- **and N agents**, each with user + branch_member + user_org_roles + hr_records (+ optional profile).

Plus a token-based invite flow (`modules/invite/`: pending user with `branch_members.isActive=false` → public `POST /invite/accept` sets password and activates) and 24h email verification. Self-serve signup needs no platform admin; invites require org_admin/branch_manager.

**Why the org plugin does not fit:**

| Onboarding need | better-auth org plugin | Verdict |
|---|---|---|
| Anonymous signup that creates the **first user AND the org together** | `organization.create()` / `createOrganization()` require an **already-authenticated user** (or explicit `userId`); creator auto-becomes `owner` | ✗ Wrong shape — there is no user yet at signup |
| Create **owner + N agents atomically** in one transaction | `signUp` creates **one user at a time** via its API (outside your DB transaction) | ✗ Loses bulk creation + atomicity |
| 7-role ranked, multi-role-per-user model | flat `owner`/`admin`/`member`, single role per member | ✗ Same mismatch as §3.1 |
| Branches with metadata + `isDefault`, HR records, plans/seats/SMS credits | `afterCreateOrganization` hook *could* call custom code, but you'd be re-implementing what already works | ✗ Net-negative rework |
| Public token-link invite accept (no prior session) | `inviteMember`/`acceptInvitation` need a logged-in session whose email matches | ✗ Different flow |

**Recommended approach — onboarding stays custom, better-auth owns credentials only:**
- Keep the onboarding and invite **services, transactions, routes, and client wizard exactly as they are**.
- The only change: inside the existing atomic transactions, **write better-auth's `user` + `account` rows directly** (insert an `account` row with `providerId="credential"`, `accountId=userId`, `userId`, `password=<bcrypt hash>`) instead of writing `user.password`. These are the *same rows better-auth's own signup writes*, so credential login works normally — while atomicity, bulk-agent creation, branches, plans, SMS credits, and HR records are all preserved.
- Do **not** call `organization.create` / `inviteMember` / `acceptInvitation`. The org plugin is not installed.
- Email verification: either keep the existing 24h-token flow, or hand it to better-auth's verification — decide in open question #7. The invite-accept flow already sets `emailVerified=true`, which stays.

This keeps onboarding **100% backward compatible** (same endpoints, same wizard, same atomic guarantees) and is consistent with the §3.1 decision to keep the authorization/tenancy layer custom.

---

## 4. Phased plan

Phases are ordered and mostly independently shippable, gated behind an `AUTH_PROVIDER=legacy|better-auth` env flag. Only Phase 4's flag flip changes behavior.

> **Layering note:** better-auth's handler and `auth.ts` config sit at the framework/middleware level (analogous to the existing `middlewares/auth/`), consistent with how current auth lives. Any new logic wrapping better-auth (e.g. post-registration org provisioning) MUST go through a service per CLAUDE.md.

### Phase 0 — Build/runtime ESM readiness
- `script/build.ts`: `format: "esm"`, `outfile: "dist/index.mjs"`, add `better-auth` (+ `better-call`, `kysely` if pulled) to `external`/allowlist.
- `package.json`: `start = node dist/index.mjs`.
- No auth changes.
- **Verify:** `npm run build` then `node dist/index.mjs` boots the existing (unchanged) app.

### Phase 1 — Schema additions
- In `shared/schema.ts`, add: `account` (with `password`), `verification`, and a new better-auth-shaped `session` table (id/userId/token unique/expiresAt/ipAddress/userAgent/createdAt/updatedAt). Leave the existing `sessions` (express) table untouched.
- Run `npx @better-auth/cli generate` against a temp `auth.ts` to confirm exact columns; hand-write Drizzle defs to match repo conventions.
- Generate migration via `npm run db:generate` (do NOT use better-auth's Kysely-only `migrate`).
- **Migration impact:** additive only. **Verify:** `npm run db:push` against test DB, confirm tables, `tsc` passes.

### Phase 2 — better-auth config + Drizzle adapter
- `npm install better-auth`.
- Add `server/v2/auth/auth.ts`:
  ```ts
  betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: { enabled: true, password: { hash: bcryptHash, verify: bcryptVerify } },
    user: { modelName: "user", additionalFields: { role, firstName, lastName, phoneNumber, orgId, orgRole /* ... */ } },
    plugins: [admin()],
  })
  ```
  - Custom hash/verify wraps `bcryptjs` (10 rounds) — the no-reset migration key.
  - `admin()` maps to existing `banned/banReason/banExpires` and platform_admin (verify field mapping).
  - Wire `sendResetPassword` / `sendVerificationEmail` to the existing nodemailer service (through a service per layering rules).
- Env: add `BETTER_AUTH_SECRET` (>=32 chars), `BETTER_AUTH_URL`.
- Do NOT mount yet.
- **Verify:** `tsc` passes; unit-test `auth.api.getSession` against a seeded user.

### Phase 3 — Data migration script + onboarding/invite write-path update
- Add `scripts/migrate-auth-to-better-auth.ts` (follows existing `scripts/seed-*.ts` pattern):
  - For each `user` with non-null `password`, insert an `account`: `providerId="credential"`, `accountId=user.id`, `userId=user.id`, `password=user.password` (verbatim bcrypt), timestamps.
  - Leave `user.password` in place during transition (rollback safety); drop in Phase 6.
  - Reset/invite/verification tokens: let existing ones expire; better-auth manages new ones via `verification`. (Backfill not recommended.)
- **Update the onboarding + invite write paths (see §3.3)** so newly created tenants/users are born better-auth-ready:
  - `server/v2/modules/onboarding/onboarding.repository.ts`: inside the existing signup transaction, also insert an `account` row (credential + bcrypt password) for the owner and each agent — alongside the existing `user`/`branch_members`/`user_org_roles`/`hr_records` inserts. Keep writing `user.password` too during the transition for rollback.
  - `server/v2/modules/invite/invite.repository.ts`: in `finaliseAcceptedInvite()`, insert/Update the `account` row with the new bcrypt password when the invite is accepted.
  - Org/branch/role/HR/plan provisioning logic is **unchanged**. The org plugin is NOT used.
- **Verify:** dry-run on test DB; every passworded user has exactly one credential account; `auth.api.signInEmail` succeeds for a known user with their existing bcrypt password (no reset); a brand-new self-serve signup can log in via better-auth immediately; an accepted invite can log in via better-auth.

### Phase 4 — Mount handler + dual-read session shim (the cutover seam)

This phase is designed so that **nothing breaks for already-logged-in users or for the client**. Three backward-compat mechanisms:

**4a. Mount better-auth alongside (not instead of) the legacy stack.**
- In `server/index.ts`: mount `app.all("/api/auth/*", toNodeHandler(auth))` **before** `express.json()`, and register the legacy-compat routes (4c) **before** the catch-all so they win on exact paths.
- Keep `express-session` + Passport deserialization mounted during the transition window (do NOT remove yet). This is what preserves existing sessions.

**4b. Dual-read `isAuthenticated` — no forced logout.**
  ```ts
  // 1. Prefer a better-auth session (issued to anyone who logged in after cutover).
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (session) {
    req.user = { ...session.user, userId: session.user.id, authType: "password" };
    return next();
  }
  // 2. Fall back to a still-valid legacy express-session cookie (connect.sid).
  if (req.isAuthenticated?.() && req.user) {
    return next(); // legacy req.user shape already understood by getUserId
  }
  return res.status(401)...;
  ```
  - Existing users keep their `connect.sid` session until it expires (7-day TTL) or they next log in — at which point they transparently get a better-auth session. **No mass logout.**
  - This is the **entire authentication integration point**. `scope.ts`, `org-branch-scope.ts`, `get-user-id.ts`, and all 21 route files stay untouched.
  - Preserve `req.session.impersonateOrgId` (see open question #2) — express-session stays mounted, so this keeps working unchanged.

**4c. Legacy endpoint compatibility shims — no client changes required.**
  better-auth's catch-all owns `/api/auth/*`, but its route *names* differ from the current ones (`sign-in/email` vs `login`, etc.). To keep the existing client working byte-for-byte, register thin compat handlers (Route→Controller→Service) **before** the catch-all that translate old contract → better-auth API and return the **existing response shapes**:

  | Legacy endpoint (keep) | Delegates to |
  |---|---|
  | `POST /api/auth/login` | `auth.api.signInEmail` + `resolveOrgAndBranchForUser` → returns `{...user, orgId, orgRole, orgRoles, orgName, branchName}` (unchanged shape) |
  | `GET /api/auth/user` | `auth.api.getSession` + `resolveOrgAndBranchForUser` (unchanged shape) |
  | `POST /api/auth/logout` | `auth.api.signOut` |
  | `POST /api/auth/change-password` | `auth.api.changePassword` |
  | `POST /api/auth/forgot-password` | `auth.api.requestPasswordReset` |
  | `POST /api/auth/reset-password` | `auth.api.resetPassword` |
  | `PATCH /api/auth/profile`, `POST /api/auth/avatar` | keep existing service logic (no better-auth equivalent needed) |

  Because of this layer, **Phase 5 (client cutover) becomes optional/deferrable** — the client can stay untouched indefinitely and still benefit from better-auth on the server.

- Gate activation behind `AUTH_PROVIDER` so the whole phase flips on/off via env.
- **Verify (tester):** existing client login flow works **unchanged**; a user with a pre-existing `connect.sid` session is NOT logged out; a new login issues a better-auth session; scoped route returns scoped data and blocks cross-tenant; banned user blocked; unverified email blocked; platform_admin impersonation still sets `req.orgId`.

### Phase 5 — Client cutover (OPTIONAL / deferrable)
Thanks to the Phase 4c compat shims, the client keeps working **without any changes**. This phase is only worth doing later if you want the client to use `better-auth/client` (`createAuthClient`) idioms directly and eventually retire the compat endpoints.
- If/when done: `client/src/api/endpoints/auth.api.ts` points login/logout/getCurrentUser/changePassword/resetPassword to better-auth (or `createAuthClient`); `logout` calls better-auth sign-out instead of redirecting to `/api/logout`.
- `axios-client.ts` keeps `withCredentials:true` (still cookie-based).
- The `/api/auth/user` response shape stays `{...user, orgId, orgRole, orgRoles, orgName, branchName}` either way.
- **Verify:** full manual/e2e login/logout/refresh/password-reset/avatar/profile flows.

### Phase 6 — Remove legacy auth + cleanup
- Remove Passport, Replit OIDC, custom auth endpoints, and unused deps (`passport`, `passport-local`, `openid-client`, `express-session`, `connect-pg-simple`, `memoizee` if unused).
- Drop old `sessions` table and `user.password`/token columns (only after rollback window closes).
- Update `architecture.md` / `CLAUDE.md` if conventions change.
- **Verify:** `tsc`, build, regression suite, grep for dangling imports.

---

## 5. Data migration summary

| Item | Action |
|---|---|
| Users | No move — `user` table already better-auth-shaped. |
| Passwords (bcrypt) | Copy `user.password` → `account.password` (`providerId="credential"`); custom bcrypt verify. **No resets.** Keep `user.password` until Phase 6. |
| Sessions | Not migrated, but NOT invalidated either — legacy `connect.sid` sessions remain valid via the dual-read shim (Phase 4b) until their 7-day TTL expires. No mass logout. |
| Reset/invite/verification tokens | Let existing expire; better-auth manages new ones via `verification`. |
| Portal JWT | Untouched. |

---

## 6. Backward compatibility, coexistence & rollback

Backward compatibility is a hard requirement. Here is exactly how each layer is preserved.

### 6.1 Compatibility guarantees

| Surface | Guarantee | Mechanism |
|---|---|---|
| **Existing sessions** | Already-logged-in staff are **not** logged out. | Dual-read `isAuthenticated` (Phase 4b): better-auth session preferred, valid legacy `connect.sid` accepted as fallback until it expires. express-session stays mounted during the transition window. |
| **Credentials** | **No password resets.** Existing bcrypt hashes keep working. | Custom bcrypt `hash`/`verify` in `auth.ts` (Phase 2); hashes copied verbatim into `account.password` (Phase 3). |
| **API contract** | The client's existing endpoints and **response shapes are unchanged**. | Legacy-compat route shims (Phase 4c) at `/api/auth/login`, `/user`, `/logout`, `/change-password`, `/forgot-password`, `/reset-password`, `/profile`, `/avatar`. |
| **Client app** | **Zero client changes required** to ship the migration. | Compat shims + cookie-based auth retained (`withCredentials:true`). Phase 5 is optional. |
| **`req.user` / downstream** | `getUserId`, `orgBranchScope`, `scope.ts`, and all 21 route files are **untouched**. | Shim normalizes better-auth's session user into the same `req.user` shape (`userId`, `authType`). |
| **Authorization / tenancy** | RBAC, org/branch scoping, and impersonation behave **identically**. | Authorization layer is explicitly out of scope (see §3.1); `impersonateOrgId` keeps using express-session. |
| **Database** | **Additive only** until the rollback window closes. | New tables (`account`, `verification`, better-auth `session`) added; old `sessions` table and `user.password`/token columns retained through Phase 5; dropped only in Phase 6. |
| **Tenant onboarding & invites** | Self-serve signup, invite, and email-verification flows behave **identically** (same endpoints, same wizard, same atomic transaction). | Onboarding stays custom (§3.3); only the credential write is extended to also insert the `account` row. Org plugin NOT used. |
| **Portal JWT** | Completely unaffected. | Out of scope; not touched. |

### 6.2 Coexistence model

- **Flag-gated:** `AUTH_PROVIDER` (default `legacy`) lets Phases 0–3 ship with **no behavior change at all**. Flipping to `better-auth` activates Phase 4 (handler + dual-read shim + compat routes).
- **True side-by-side during the transition window:** because the compat shims register before better-auth's catch-all and the dual-read shim accepts both session types, **both auth systems serve traffic simultaneously** — new logins use better-auth, in-flight legacy sessions continue. This is real coexistence, not a hard switch.
- The only thing the flag flip changes for end users is *where new sessions come from*; existing ones ride out their TTL.

### 6.3 Rollback

- **Instant, at every phase.** Phases 0–3 are non-breaking on their own. Phase 4 is reverted by flipping `AUTH_PROVIDER` back to `legacy` and redeploying — legacy `sessions`, `user.password`, Passport, and OIDC are all still present.
- **No data loss on rollback:** the migration is additive; nothing legacy is removed until Phase 6, which is only executed after a sign-off bake-in period.
- **Rollback drill:** before Phase 6, verify a flag-flip-back restores legacy login end-to-end in the test environment.

---

## 7. Risks & gaps

- **Tenant isolation:** Migration must not alter `orgBranchScope` / `scope.ts` / repository predicates. Risk is confined to the `req.user` population seam, and fails closed (401) if `getSession` returns null.
- **No automated tests (biggest execution risk):** Add auth integration tests BEFORE cutover (login, session read, protected route, banned user, password reset, unverified email).
- **`express.json()` ordering:** better-auth handler must mount before the global JSON parser, or every route breaks.
- **Cookie/CORS:** client uses `withCredentials:true`; better-auth cookie name differs from `connect.sid`; logout flow must change.
- **Path collisions:** legacy `/api/auth/*`, `/api/login`, `/api/callback`, `/api/logout` vs better-auth `/api/auth/*` — resolve deliberately during cutover.
- **Rate limiting:** better-auth has built-in rate limiting (bonus) — verify behind the proxy (`trust proxy` is set).

---

## 8. Open questions for sign-off

1. **Replit OIDC** — confirm no active staff authenticate via OIDC (any active `user` rows with `password IS NULL`?). If none, drop it.
2. **Impersonation transport** — keep a minimal `express-session` solely for `impersonateOrgId`, or migrate it onto a better-auth session field / signed cookie? (Affects whether `express-session`/`connect-pg-simple` can be fully removed in Phase 6.)
3. **Session continuity** — the plan now AVOIDS a mass logout via the Phase 4b dual-read shim (existing `connect.sid` sessions ride out their 7-day TTL). Confirm this is preferred over the simpler "log everyone out once" approach. (Recommended: keep the dual-read shim — it's the backward-compatible option.)
4. **Admin plugin scope** — adopt better-auth `admin()` only for the ban fields it already matches, keep platform_admin authorization custom? (Recommended: yes.)
5. **Email verification** — keep `requireEmailVerification: true` to preserve current behavior? (Recommended: yes.)
6. **Portal JWT** — confirm it stays out of scope for this migration.
7. **Onboarding email verification** — keep the existing custom 24h-token verification flow (`modules/onboarding`), or hand verification to better-auth's `verification` table + `sendVerificationEmail`? (Recommended: keep custom for now to minimize onboarding changes; migrate later if desired.)
8. **Org plugin** — confirm we are NOT adopting better-auth's organization plugin and onboarding stays custom (§3.1, §3.3). (Recommended: confirmed — keep custom.)

---

## 9. Relevant files

- `package.json` (type, start script)
- `script/build.ts` (format)
- `server/index.ts` (json middleware order, auth wiring)
- `server/v2/routes/index.ts:64` (auth chain)
- `server/v2/middlewares/auth/require-auth.ts`
- `server/v2/middlewares/auth/session.ts`
- `server/v2/middlewares/org-branch-scope.ts`
- `server/v2/utils/scope.ts`
- `server/v2/utils/get-user-id.ts`
- `server/v2/types/express.d.ts`
- `shared/schema.ts` (sessions 82-86, user 88-117, branchMembers 124-137, userOrgRoles 2212-2226)
- `server/v2/modules/portal/portal-auth.ts`
- `server/v2/modules/onboarding/onboarding.service.ts`, `onboarding.repository.ts` (signup transaction — add `account` insert)
- `server/v2/modules/invite/invite.service.ts`, `invite.repository.ts` (`finaliseAcceptedInvite` — add `account` insert)
- `scripts/seed-org.ts`, `scripts/seed-user-org-roles.ts` (seed paths that create users)
- `client/src/pages/signup-agency.tsx`, `client/src/pages/accept-invite.tsx` (onboarding UI — unchanged, listed for context)
- `client/src/api/endpoints/auth.api.ts`
- `client/src/hooks/use-auth.ts`

---

## 10. References (better-auth docs)

- [Installation](https://better-auth.com/docs/installation)
- [Express integration](https://better-auth.com/docs/integrations/express)
- [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)
- [Database / core schema](https://better-auth.com/docs/concepts/database)
- [Email & password](https://better-auth.com/docs/authentication/email-password)
- [Organization plugin](https://better-auth.com/docs/plugins/organization)
- [Admin plugin](https://better-auth.com/docs/plugins/admin)
