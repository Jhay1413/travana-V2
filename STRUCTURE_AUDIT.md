# Backend Structure Audit vs CLAUDE.md

**Audit date:** 2026-06-16  
**Scope:** `server/` directory only (client/ and shared/ noted where relevant)

---

## Verdict

The codebase does **not** follow the flat layer-folder structure prescribed by CLAUDE.md. Two parallel implementations coexist inside `server/`:

- **v1** (`server/` root layer folders) — flat layout that is structurally close to what CLAUDE.md describes, but contains significant layering violations.
- **v2** (`server/v2/`) — a module-based (feature-folder) layout that diverges entirely from the prescribed flat structure. v2 is the active and dominant implementation; v1 routes are still mounted alongside v2 routes from the same Express app.

CLAUDE.md's prescribed layout (`src/routes/`, `src/controllers/`, `src/services/`, …) matches neither of the two implementations. The root is `server/`, not `src/`. v2 uses per-feature modules. Neither version has a `schemas/` folder (Drizzle schemas live in `shared/schema.ts`).

---

## Side-by-Side: Prescribed vs Actual

### Top-Level Folder Layout

| Prescribed (`src/`) | Actual v1 (`server/`) | Actual v2 (`server/v2/`) |
|---|---|---|
| `routes/` | `routes/` (22 files) | `routes/index.ts` (aggregator only) |
| `controllers/` | `controllers/` (16 files) | Inside each `modules/<name>/` |
| `services/` | `services/` (29 files) | Inside each `modules/<name>/` |
| `repositories/` | `repositories/` (26 files) | Inside each `modules/<name>/` |
| `schemas/` | **MISSING** | **MISSING** (in `shared/schema.ts`) |
| `validators/` | `validators/` (8 files) | Inside each `modules/<name>/` (partial) |
| `middlewares/` | `middlewares/` | `middlewares/` |
| `utils/` | `utils/` | `utils/` |
| `types/` | `types/` | `types/` |
| `config/` | `config/` | `config/` |
| `app.ts` | **MISSING** | **MISSING** |
| `server.ts` | **MISSING** | **MISSING** (`index.ts` fills both roles) |

v2 adds three extra top-level concepts absent from CLAUDE.md:
- `server/v2/modules/` — 51 feature-module folders, each containing its own routes / controller / service / repository / types / validator files.
- `server/v2/settings/` — 11 entity-setting modules (accommodations, cruise, destinations, etc.) using the same per-module layout.
- `server/v2/lookup/` — a standalone lookup module (routes + service + repository; no controller).

### Naming Conventions

| Convention | v1 compliance | v2 compliance |
|---|---|---|
| `*.routes.ts` | Followed (`quote.routes.ts`, etc.) | Followed |
| `*.controller.ts` | Followed | Followed |
| `*.service.ts` | Partially — `newQuote.service.ts`, `vipEnrollment.service.ts`, `portal-chat-bridge.ts` deviate from kebab-case or omit the layer suffix | Followed |
| `*.repository.ts` | Followed | Followed |
| `*.validator.ts` | Followed | Partial — see below |
| `*.schema.ts` | **Absent** — no schema files exist in server/ | **Absent** |
| `*.types.ts` | Followed | Followed |

Misc naming deviations (v1): `ticketAttachment.controller.ts` (camelCase), `tourOperator.controller.ts` (camelCase), `portal-chat-bridge.ts` (no layer suffix).

---

## Rule-by-Rule Compliance Table

| Rule | v1 | v2 | Evidence |
|---|---|---|---|
| Flat `src/routes` + `src/controllers` + … layout | Partial (uses `server/` not `src/`) | **Violated** (module-based layout) | `server/v2/modules/booking/` contains all four layers |
| `schemas/` folder for Drizzle schemas | **Violated** | **Violated** | Drizzle table definitions live in `shared/schema.ts` |
| `app.ts` + `server.ts` entry points | **Violated** | **Violated** | Entry point is `server/index.ts` |
| Route → Controller → Service → Repository flow | Partial | Mostly followed (47 of 51 modules have all 4 layers) | See violations below |
| No DB access outside repositories | **Violated** | **Violated** (1 service) | See violations below |
| No business logic outside services | **Violated** | **Violated** | See violations below |
| No HTTP logic outside controllers | **Violated** | **Violated** | See violations below |
| Zod validation in middleware before controllers | Partial (8 validators in v1) | Partial (only ~18 of 51 modules have `*.validator.ts`) | `server/v2/middlewares/validation.middleware.ts` exists and is used, but most modules omit it |
| Services throw `AppError`; global error middleware | Compliant | Mostly compliant (some controllers also throw AppError) | `server/v2/middlewares/error.middleware.ts` |
| Named exports | Followed | Followed | `export const bookingService = { … }` |
| `async/await` | Followed | Followed | Consistent throughout |
| No `any` | **Violated** | **Violated** | 342 occurrences of `: any` / `as any` in v2 alone; portal routes alone have 57 |
| Types organised by domain under `types/` | Followed (v1) | Partial (v2 types live inside feature modules as `*.types.ts`) | `server/v2/modules/booking/booking.types.ts` |
| `*.validator.ts` naming | Followed | Partial — 33 of 51 modules have no validator file | See "NO VALIDATOR" list |

---

## Concrete Discrepancies (Ordered by Significance)

### 1. Two Parallel Implementations — Active Conflict

Both v1 and v2 are mounted simultaneously from `server/index.ts`:

```
import routes from "./routes/index";      // v1
import v2Routes from "./v2/routes/index"; // v2
```

CLAUDE.md describes a single prescribed layout. The codebase has two incompatible layouts coexisting. When a feature exists in both (e.g. quote, booking), it is unclear which is authoritative without checking route prefixes.

### 2. `schemas/` Folder Entirely Missing

CLAUDE.md mandates a `schemas/` folder for Drizzle schema definitions. There is none in `server/`. All Drizzle table definitions reside in `shared/schema.ts`. This is a reasonable architectural choice (shared across client/server) but directly contradicts the prescribed layout.

### 3. Direct DB Access in v1 Route Files (Severe Layering Violation)

Six v1 route files import `db` and run Drizzle queries directly — bypassing both the controller and the repository layers:

- `server/routes/quote.routes.ts` — runs `db.select()`, `db.update()` directly (lines 66, 75, 87, 98)
- `server/routes/audit.routes.ts` — runs `db.select()` and `db.transaction()` directly (lines 14, 49, 57, 60, 67, 105, 113, 123)
- `server/routes/adminImport.routes.ts`
- `server/routes/userProfile.routes.ts`
- `server/routes/portal.routes.ts`
- `server/routes/settings.routes.ts`

This violates "No direct DB access outside repositories" and "No business logic outside services/controllers."

### 4. `portal.routes.ts` (v2) — All Layers Collapsed Into Route File (838 Lines)

`server/v2/modules/portal/portal.routes.ts` (838 lines) has no controller and no service delegation. It:
- Defines inline middleware (`portalAuth`, `requireStaffAuth`)
- Calls repositories directly (`portalRepository`, `neonClientRepository`, `quotePublicRepository`, `portalLoginTokenRepository`)
- Contains complex business logic (bcrypt comparison, token signing/verification, data assembly, notification dispatch)
- Calls other module services directly (referral, wallet, tag, push-notification, sms)

This violates Route → Controller → Service → Repository at every layer boundary.

### 5. `lookup.routes.ts` (v2) — Skips Controller Layer (171 Lines)

`server/v2/lookup/lookup.routes.ts` defines inline async handler closures that call `lookupService.*` directly from the router. There is no controller. The error handling is also non-standard (`catch (err: any) { res.status(500)… }` instead of using the global error middleware).

### 6. `user-org-roles.service.ts` — Drizzle Query in Service Layer

`server/v2/modules/user-org-roles/user-org-roles.service.ts` (line 149) runs a raw Drizzle query:

```
db.select({ role: user.role }).from(user).where(eq(user.id, userId)).limit(1)
```

This violates "No SQL queries" in services. The query should be extracted to `user-org-roles.repository.ts`.

### 7. AppError Thrown in Controllers (Minor)

Several v2 controllers throw `AppError` for authentication/authorization checks (e.g. `audit.controller.ts`, `email.controller.ts`, `facebook.controller.ts`). CLAUDE.md specifies that only services throw `AppError`. Auth guard errors are borderline acceptable in middleware, but doing it inside controllers blurs layer responsibilities. Affected files: `audit`, `email`, `facebook`, `invite`, `notification`, `organization`, `organization-member`, `platform-admin`, `sms`, `targets` controllers.

### 8. Majority of v2 Modules Have No `*.validator.ts`

33 of 51 modules in `server/v2/modules/` have no validator file. CLAUDE.md mandates "Zod validation in middleware before controllers." Routes for these modules either perform no input validation or do validation inline in the controller/service. This is a systemic gap rather than a rare exception.

### 9. `ai-ask.service.ts` — No Repository, Crosses Module Boundary

`server/v2/modules/ai-ask/ai-ask.service.ts` calls `noteRepository.create(…)` from a different module (`note`). Inter-module direct repository calls are not prohibited by CLAUDE.md but do create coupling; note storage should arguably go through a service. Additionally the call passes `as any` to work around the type mismatch.

### 10. `server/` Root vs Prescribed `src/`

CLAUDE.md specifies the root as `src/`. The actual root is `server/`. This is a naming mismatch that affects every file path in the document.

### 11. `schemas/` Absent; `app.ts` / `server.ts` Absent

CLAUDE.md mandates `schemas/` (for Drizzle schemas) and two entry-point files `app.ts` + `server.ts`. None of these exist anywhere in the server tree.

### 12. Widespread `any` Usage

`server/v2` contains 342 instances of `: any` or `as any`. CLAUDE.md forbids `any`. The `lookup.routes.ts` error catches (`err: any`) account for 16, and `portal.routes.ts` accounts for 57 of these.

### 13. Inconsistent Naming in v1

Several v1 files use camelCase or omit the layer suffix contrary to the kebab-case `*.layer.ts` convention:
- `server/controllers/ticketAttachment.controller.ts`
- `server/controllers/tourOperator.controller.ts`
- `server/services/newQuote.service.ts`
- `server/services/vipEnrollment.service.ts`
- `server/services/portal-chat-bridge.ts` (no layer suffix)

---

## What Is Compliant

For completeness, the following items are correctly implemented:

- Global error middleware (`server/v2/middlewares/error.middleware.ts`) handles `AppError` and Multer errors uniformly.
- `validate()` middleware (`server/v2/middlewares/validation.middleware.ts`) wraps Zod parsing correctly and calls `next(AppError)` on failure.
- v2 controllers contain no Drizzle imports; they only call services.
- v2 repositories appear to use Drizzle exclusively (no business logic observed).
- Named exports are used consistently across v2 services and controllers.
- `async/await` is used uniformly.
- TypeScript strict mode is enabled in `tsconfig.json`.
- Types are domain-organised under `server/types/` (v1) and inside feature modules (v2).
- 47 of 51 v2 modules have the full four-layer stack (routes → controller → service → repository).

---

## Recommendation

**Update CLAUDE.md to reflect the v2 module-based reality rather than restructuring the code.**

Restructuring ~51 modules from a module-based layout back to a flat layer layout would be a large, risky refactor with no functional gain. The module-based layout is an industry-standard alternative (NestJS calls it "feature modules") that is internally coherent. Flattening it would make cross-module navigation harder, not easier.

**CLAUDE.md should be updated to describe:**

1. The actual root path (`server/v2/modules/<feature>/`) not `src/`.
2. The per-module file convention: each module folder contains `<name>.routes.ts`, `<name>.controller.ts`, `<name>.service.ts`, `<name>.repository.ts`, and optionally `<name>.validator.ts` and `<name>.types.ts`.
3. The `shared/schema.ts` location for Drizzle table definitions (replacing the `schemas/` folder rule).
4. The entry point pattern (`server/index.ts`) rather than `app.ts` + `server.ts`.

**Separately, these concrete violations in the code should be fixed regardless of which layout CLAUDE.md describes:**

| Priority | Fix |
|---|---|
| High | Extract DB queries out of `server/routes/audit.routes.ts`, `quote.routes.ts`, `userProfile.routes.ts`, `portal.routes.ts`, `settings.routes.ts`, `adminImport.routes.ts` into repositories. |
| High | Refactor `server/v2/modules/portal/portal.routes.ts` (838 lines) — extract a controller and delegate business logic to the existing portal service and repositories. |
| High | Move the Drizzle query in `user-org-roles.service.ts` line 149 into `user-org-roles.repository.ts`. |
| Medium | Add controllers to `server/v2/lookup/lookup.routes.ts` and wire through the global error middleware. |
| Medium | Add `*.validator.ts` files (Zod schemas) to the 33 modules that currently have none. |
| Low | Remove `any` annotations (340+ instances). |
| Low | Rename camelCase v1 files to kebab-case. |
| Low | Decide whether v1 routes are still needed and remove them if v2 has full coverage. |
