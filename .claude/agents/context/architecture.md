# System Architecture Reference (Context for the Planner Agent)

> Faithful snapshot of the CURRENT system, used by the `planner` agent to judge
> whether the existing architecture and processes fit the business goal:
> **a multi-tenant CRM SaaS**. Verify against live code before relying on any
> detail — code changes faster than this doc.
>
> Source of truth for the data model: [shared/schema.ts](../../../shared/schema.ts).
> Architecture rules: [CLAUDE.md](../../../CLAUDE.md).
> Prior multi-tenancy design notes: [SAAS_MULTITENANCY_PLAN.md](../../../SAAS_MULTITENANCY_PLAN.md).

---

## 0. Live facts (auto-generated)

<!-- AUTO:START -->
<!-- Run `npm run docs:arch` to regenerate this block from the live codebase. -->
**Last refreshed:** 2026-06-16 (auto-generated — do not edit by hand)

| Fact | Value |
|------|-------|
| Backend modules (`server/v2/modules/`) | **51** |
| Tables defined (`pgTable`) in schema.ts | 128 |
| Enums (`pgEnum`) in schema.ts | 21 |
| `orgId`/`org_id` references in schema.ts | 45 |
| Migrations (`migrations/*.sql`) | 11 (latest: `0010_petite_unus.sql`) |
| Client pages (`client/src/pages`) | ~16 |
| Automated test runner | ⚠️ NONE (only `npm run check` / tsc) |
| Legacy v1 backend (`server/`) present | ⚠️ yes (alongside v2) |

**Key versions:** React 19.2.0 · TypeScript 5.6.3 · Vite 7.1.9 · Express 5.0.1 · Drizzle ORM 0.39.3 · Zod 3.25.76 · React Query 5.60.5

**Backend modules:** admin-import, ai-ask, airport, announcement, audit, booking, branch, branch-member, branch-overview, chat, client, dashboard, destination-guru, email, enquiry, facebook, favorite, feedback, files, hr, hub-post, invite, json-mapper, neon-client, note, notification, onboarding, opportunities, organization, organization-overview, plan, platform-admin, portal, quote, quote-share, referral, reports, revenue, search, sms, social-post, tag, targets, task, ticket, tour-operator, transaction, user, user-org-roles, wallet, website-public
<!-- AUTO:END -->

---

## 1. What the system IS today

A **multi-tenant SaaS CRM for travel agencies**. It is NOT a greenfield project —
multi-tenancy already exists and is the core of the data model. The business
domain is the travel deal lifecycle:

**Enquiry → Quote → Booking** (with post-booking Upsells), plus clients, tasks,
notes, tickets, referrals/commission wallet, SMS/email comms, dashboards/reports,
social posting, and AI assistants.

Tenant model: **Organization (agency) → Branch (office) → User (staff) → Client (customer)**.

---

## 2. Stack

**Monorepo** (client + server + shared schema in one repo).

- **Frontend**: React 19, TypeScript 5.6 (strict), Vite 7, Wouter (routing),
  TanStack React Query 5 + Axios (data), React Hook Form + Zod (forms),
  Radix UI + Tailwind CSS 4.
- **Backend**: Node + Express 5, TypeScript, PostgreSQL via Drizzle ORM 0.39,
  Zod validation, Passport + express-session (sessions persisted to Postgres via
  connect-pg-simple), bcryptjs. Integrations: AWS S3 (uploads), nodemailer +
  imapflow (email), OpenAI (AI), web-push, node-cron, ws.
- **DB/migrations**: Drizzle Kit; schema source of truth is `shared/schema.ts`;
  migrations in `migrations/` (currently through 0010).
- **Testing**: ⚠️ NO test runner configured. Only `npm run check` (`tsc` typecheck).

---

## 3. Repository layout

```
client/        React SPA (src/pages, components, api/endpoints, hooks/queries, types, lib)
server/        Legacy v1 backend (still present — technical debt)
server/v2/     Active backend (modules/, routes/, middlewares/, config/, utils/, settings/)
shared/        schema.ts (Drizzle tables, ~100+ tables) + models
migrations/    Drizzle-generated SQL (0000–0010) + meta snapshots
scripts/       DB seeding (plans, org, roles, commission, baseline)
```

⚠️ Both `server/` (v1) and `server/v2/` exist in parallel — migration to v2 is in
progress; duplicate logic is a known source of debt.

---

## 4. Backend architecture (CLAUDE.md layering)

Strict layering, enforced per module: **Route → Controller → Service → Repository → Database**.
- Repositories: Drizzle only, no business logic.
- Services: business logic, throw `AppError`; global error middleware formats responses.
- Controllers: HTTP only. Routes: paths + middleware. Zod validation in middleware.

**51 modules** under `server/v2/modules/`, including:
booking, quote, quote-share, enquiry, transaction (parent of quote/booking),
client, neon-client, user, user-org-roles, branch, branch-member, organization,
plan, invite, onboarding, task, note, ticket, notification, sms, email, dashboard,
branch-overview, organization-overview, reports, revenue, targets, opportunities,
referral, wallet, tag, favorite, search, audit, feedback, hr, platform-admin,
portal, website-public, social-post, facebook, hub-post, announcement, chat,
destination-guru, ai-ask, json-mapper, admin-import, tour-operator, airport, files.

A typical module (e.g. `booking/`) has: `*.routes.ts`, `*.controller.ts`,
`*.service.ts`, `*.repository.ts`, `*.validator.ts`, `*.types.ts`, plus sub-features
(e.g. `booking-upsell.*`, `booking-image.*`).

**Known intentional deviations**: public/unauthenticated routes for token-based
quote sharing (`quote-public` / `quote-share`, `portal`, `website-public`) — these
expose data via share tokens, validated in the service layer.

---

## 5. Multi-tenancy (THE core of the system)

- **`orgId` is THE tenant boundary** — present on tenant-scoped tables and used as
  the first predicate in every scoped query. (See the Live-facts block for the
  current count; org_id flows to child rows like quote/booking via the parent
  `transaction`.)
- **`branchId`** is grouping within an org (soft labeling), not a hard security boundary.
- **Isolation model**: single shared schema, logical isolation via SQL `WHERE` predicates
  (NOT schema-per-tenant, NOT row-level encryption). PostgreSQL assumed trusted.
- Org deletion cascades to branches/users/clients/transactions/quotes/bookings.

Key tenant tables: `organization` (plan, seatLimit, branding, settings jsonb,
SMS credit limits, trialEndsAt), `branches`, `branchMembers` (org/branch/user +
orgRole), `user` (orgId, orgRole), `userOrgRoles` (user↔org↔role junction).

---

## 6. Auth & RBAC

- Session-based (Passport + express-session, sessions in Postgres). bcrypt passwords.
- On each request, middleware resolves a **Scope**:
  `{ orgId, branchId, orgRole, orgRoles[], userId }` (see `server/v2/utils/scope.ts`).
- Roles: `platform_admin` (vendor staff, cross-org), `org_admin`, `branch_manager`,
  `agent`, `homeworker`, `referral_agent`, `social_media_manager`.
- Repositories build scoped `WHERE` clauses from the Scope (org → branch → own-records),
  e.g. agents see own clients, branch managers see their branch, org_admin sees the org,
  platform_admin sees all.
- Frontend permission matrix in `client/src/lib/permissions.ts`
  (modules × access levels: none/read_own/read_all/write_own/write_all/admin).

---

## 7. Frontend

- Pages in `client/src/pages/` (~30, incl. an unauthenticated client `portal/`).
- API access via typed endpoint objects in `client/src/api/endpoints/*.api.ts`
  (Axios) wrapped by React Query hooks in `client/src/hooks/queries/`.
- Context hooks: `use-auth`, `use-agency`, `use-role`. White-label branding applier.

---

## 8. Revenue / business model signals (from the schema)

- Per-org **plans** (starter/growth/enterprise) with seat limits & feature flags (settings jsonb).
- **Commission** on deals (tour-operator rates), **referral** commissions + wallet/payouts.
- **SMS credits**: monthly limit + overage pricing per org.
- Trial support (`trialEndsAt`). Custom branding (logo/colors) for white-labeling.

---

## 9. Known gaps / risks for scaling as a CRM SaaS

These are the standing items a planner should weigh against any new requirement:

1. **No automated tests** — only `tsc`. No unit/integration/e2e. High regression risk.
2. **Dual v1/v2 backends** — duplicate logic; v1 should be retired.
3. **Audit logging** — an `audit` module exists but coverage across mutations is unverified.
4. **Inconsistent delete strategy** — mix of `isActive` soft-delete and cascade hard-delete.
5. **No visible rate limiting** — relevant for public/portal/share endpoints.
6. **No webhook/event bus** — limits external integration & async workflows.
7. **GDPR/data-export & account-deletion workflows** — not clearly present.
8. **Tenant isolation depends entirely on correct Scope WHERE clauses** — a single
   missing predicate leaks cross-tenant data; no DB-level RLS backstop.
9. **Custom fields** — schema is fixed per entity; multi-tenant CRMs often need
   per-org custom fields (would need JSONB or EAV approach).

---

## 10. How to keep this doc honest

When the planner reasons about fit, it should re-check the live code for anything
load-bearing rather than trusting this snapshot, because the repo evolves. Anchor
files to read first: `shared/schema.ts`, `server/v2/utils/scope.ts`,
`server/v2/middlewares/auth/`, a representative module under `server/v2/modules/`,
`client/src/lib/permissions.ts`, and `SAAS_MULTITENANCY_PLAN.md`.
