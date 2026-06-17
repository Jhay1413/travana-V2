# Client Folder Structure Migration Plan

> **Status:** DRAFT — for review. No code changes have been made.
> **Goal:** Migrate the React client from its current layout to the **feature-based** target structure documented in `CLAUDE.md` ("Client / Frontend Structure"), incrementally and without breaking imports.
> **Related:** `docs/better-auth-migration-plan.md` (the `auth/` folder depends on it).
>
> **⚠️ HARD CONSTRAINT — STRUCTURE ONLY, NO UI CHANGES.** This is a pure reorganization: files move and imports update, but the rendered UI, component behavior, styling, props, and runtime logic must stay **identical**. No redesigns, no markup/JSX changes, no styling tweaks, no refactoring of component internals beyond what a relocation strictly requires (import-path updates). Every phase's verification includes confirming the affected screens look and behave exactly as before. If a move would force a behavior change, stop and flag it instead of changing the UI.

---

## Target structure (from CLAUDE.md)

```
client/src/
  api/            client.ts (axios instance), endpoints.ts (path constants), queryClient.ts
  auth/           auth-client.ts, AuthProvider.tsx, useSession.ts, guards.tsx   (better-auth — PLANNED, not yet implemented)
  components/     ui/ (primitives), layout/ (Header, Sidebar, PageShell)
  features/       <feature>/ -> api/ (TanStack Query hooks), components/, types.ts, index.ts
  hooks/          generic shared hooks
  lib/            pure utilities
  pages/ (routes/) route-level components
  types/          global shared types
  config/env.ts
  styles/  App.tsx  main.tsx  router.tsx
```

**Conventions enforced by this plan:** feature work under `features/<feature>/`; data fetching in `features/<feature>/api/` via TanStack Query; HTTP only through the shared axios client + `endpoints` constants; import a feature via its `index.ts`; no direct axios in components; no feature logic in `components/ui` or `components/layout`; TS strict; named exports.

---

## 1. Current-state map (verified)

Top-level `client/src/`:

| Folder | Files | Reality |
|---|---|---|
| `api/` | 51 | `api/client/axios-client.ts` (singleton instance, default export, `baseURL: ""`, `withCredentials: true`), `api/client/interceptors.ts` (401 redirect + response unwrap, side-effect import in `main.tsx:2`), `api/endpoints/*.api.ts` (47 domain API objects), `api/index.ts` (barrel re-exporting all `*Api`) |
| `components/` | 207 | Domain folders (`quote/`, `booking/`, `client/`, `admin/`, `platform-admin/`, `social-quote/`, `agency/`, `boards/`, `lookups/`, `sms/`, `tasks/`), shared `ui/` (61), `layout/` (3: `app-header`, `app-layout`, `app-sidenav`), + 16 loose root `.tsx` files |
| `config/` | 1 | only `config/nav.ts` (no `env.ts`) |
| `data/` | 1 | static data |
| `hooks/` | 88 | `hooks/queries/` (47 + barrel), `hooks/mutations/` (35 + barrel), 6 generic root hooks (`use-auth`, `use-role`, `use-agency`, `use-mobile`, `use-toast`, `use-portal-api`) |
| `lib/` | 7 | `permissions.ts`, `queryClient.ts`, `utils.ts`, `note-time.ts`, `uk-airports.ts`, two import/parse helpers |
| `pages/` | 174 | Route components, flat files + multi-file dirs (`agency/` 31, `hr-v2/` 15, `hr/` 13, `portal/` 12, `agent-overview/` 11, `opportunities/` 11, `reports/` 9, `hub/` 9, `organization-overview/` 8, `travana/` 7, `branch-overview/` 7, `platform-admin/` 5) |
| `types/` | 35 | 17 domain subfolders (e.g. `types/auth/auth.types.ts`, `types/quote/`, `types/booking/`) |

**Key infrastructure facts (evidence):**

- **Path alias** is a single root config: `tsconfig.json:19-22` maps `@/* -> ./client/src/*` and `@shared/* -> ./shared/*`; mirrored in `vite.config.ts:26-30`. No `client/tsconfig.json`.
- **Router is `wouter`, inline in `client/src/App.tsx`** (App.tsx:2). There is **no `router.tsx`** — a single ~280-line `App.tsx` with ~60 `lazy(() => import("@/pages/..."))` declarations (App.tsx:20-79).
- **QueryClient already exists** at `lib/queryClient.ts` (not `api/`), imported by `App.tsx:3`; `App.tsx` hosts `QueryClientProvider` (App.tsx:269).
- **Query/mutation hooks** import API objects via the `@/api` barrel (e.g. `use-quote-queries.ts:2`). **178 files import the hook barrels; 47 files import `@/api`.**
- **Domain components already self-organize**: `components/quote/` has `sections/` + `hooks/` (52 files); `components/booking/` has `hooks/` (13); `components/client/` has `hooks/`, `modals/`, `sections/`, `tabs/`, `vip/`.
- **Naming is mixed**: dialogs/forms kebab (`quote-create-dialog.tsx`); cards/sections PascalCase (`QuoteCostingsCard.tsx`, `QuoteImagesSection.tsx`).
- **8 components bypass the axios singleton** (raw `axios`/`axios-client`): the 5 `components/lookups/add-*-modal.tsx`, `components/quote/hooks/use-quote-share.ts`, `components/ask-ai-dialog.tsx`, `components/boards/social-posts-board.tsx`.
- **No ESLint config exists** (no `.eslintrc*`/`eslint.config.*`, no eslint script). Boundary enforcement is net-new.
- **Verification commands**: `npm run check` (`tsc`), `npm run build` (`tsx script/build.ts` → vite), `npm run dev:client` (`vite dev --port 5000`).

---

## 2. Gap analysis (current → target)

| Current | Target | Delta / friction |
|---|---|---|
| `api/client/axios-client.ts` (default export) | `api/client.ts` | Rename + merge interceptors; keep `@/api` boundary. |
| `api/client/interceptors.ts` | fold into `api/client.ts` or `api/interceptors.ts` | side-effect import in `main.tsx:2` must still run. |
| `api/endpoints/*.api.ts` (47) + `api/index.ts` | per-feature `features/<f>/api/` + shared **`api/endpoints.ts`** (path constants) | Biggest conceptual gap: `endpoints.ts` does NOT exist; URLs are hardcoded in each `*.api.ts` (e.g. `/api/v2/quotes` in `quote.api.ts:17`). Extraction is real work, not a move. |
| `lib/queryClient.ts` | `api/queryClient.ts` | trivial move; update `App.tsx:3`. |
| `hooks/queries/use-X-queries.ts` + `hooks/mutations/use-X-mutations.ts` | `features/<X>/api/` | clean map; 178 importers reference the barrels. |
| `components/<domain>/` | `features/<domain>/components/` | clean map; 26 files import `@/components/{quote,booking,client}/` (96 occurrences). |
| `components/<domain>/hooks/` | `features/<domain>/hooks/` | local UI hooks — keep feature-internal. |
| `components/ui/` (61) | `components/ui/` | **stays as-is** (already correct). |
| `components/layout/` (3) | `components/layout/` | **stays as-is** (already correct). |
| `components/` loose 16 files | per-file triage (layout-ish vs feature vs shared) | does NOT map cleanly. |
| `types/<domain>/*.types.ts` | `features/<domain>/types.ts` + global `types/` | most feature-local; `types/auth/auth.types.ts` (`OrgRole`, used App.tsx:17) stays global. |
| `config/nav.ts` | `config/nav.ts` + add `config/env.ts` | `env.ts` net-new. |
| `pages/` flat + dirs | `pages/` (unchanged location) | only their imports into features change; page dirs (`agency/`, `hr-v2/`) are quasi-features — decide later. |
| `App.tsx` inline router | optional `router.tsx` | wouter inline works; extraction optional — defer. |
| `auth/` | `auth/` (better-auth) | **does not exist; blocked on `docs/better-auth-migration-plan.md`**. Do not build now. |

**Does NOT map cleanly:** the `endpoints.ts` path-constants concept; the 16 loose root components; page-level mini-feature dirs; the 8 raw-axios offenders; the `types/` split.

---

## 3. Feature decomposition (proposed `features/` folders)

Each feature folder: `api/` (TanStack Query hooks + fetchers), `components/`, `hooks/`, `types.ts`, `index.ts`.

| `features/<feature>/` | Pulls in (existing files) |
|---|---|
| `quote/` | `components/quote/**` (52), `use-quote-queries` + image variants, `use-quote-mutations` + `use-quote-image-mutations`, `quote.api.ts`, `types/quote/**` |
| `booking/` | `components/booking/**` (13), `use-booking-queries` + `use-booking-upsell-queries`, `use-booking-*` mutations, `booking.api.ts`, `types/booking/**` |
| `client/` | `components/client/**`, `use-client-*`, `client.api.ts` + `client-file.api.ts` + `neon-client.api.ts`, `types/client/**` + `types/neon-client/**` |
| `enquiry/` | `components/enquiry-wizard.tsx`, `use-enquiry-*`, `enquiry.api.ts`, `types/enquiry/**` |
| `transaction/` | `transaction.api.ts` (+ pipeline) |
| `dashboard/` | `dashboard.api.ts`, `use-dashboard-queries`, `types/dashboard/**`, overlap with `pages/agent-overview` |
| `auth/` (interim) | `auth.api.ts`, `use-auth-queries`/`use-auth-mutations`/`use-registration-mutations`, `hooks/use-auth.ts`, `hooks/use-role.ts`, `components/role-route.tsx`, `types/auth/**` — **see §7: stage but do not finalize until better-auth** |
| `invite/` | `invite.api.ts`, `use-invite-*`, onboarding (`signup-agency`, `accept-invite`, `welcome-team`) |
| `organization/` | `organization.api.ts` + `organization-overview.api.ts` + `branch.api.ts` + `branch-overview.api.ts`, `components/agency/`, `pages/agency` |
| `platform-admin/` | `components/platform-admin/**`, `platform-admin.api.ts`, `use-platform-admin-*`, `pages/platform-admin/**` |
| `tasks/` | `components/tasks/**`, `task.api.ts` |
| `tickets/` | `ticket.api.ts`, `types/ticket/**` |
| `chat/` | `components/chat-rich-input.tsx`, `chat.api.ts`, `use-chat-*`, `types/chat/**` |
| `social/` | `components/social-quote/**`, `components/boards/social-posts-board.tsx`, `social-post.api.ts`, `hub-post.api.ts` |
| `sms/` | `components/sms/**`, `sms.api.ts`, `use-sms-mutations` |
| `lookups/` | `components/lookups/**`, `lookup.api.ts`, `use-lookup-queries` |
| `notifications/` | `notifications-dropdown.tsx` + `notification-toast.tsx`, `notification.api.ts`, `use-notification-*` |
| `reports/` | `pages/reports/**`, `reports.api.ts` + `revenue.api.ts` + `targets.api.ts`, `types/revenue|targets/**` |
| `hr/` | `pages/hr/**` + `pages/hr-v2/**`, `hr.api.ts` |
| `destination-guru/` | `components/destination-guru.tsx`, `destination-guru.api.ts` |

Smaller/leaf APIs (`airport`, `tag`, `note`, `reply`, `attachment`, `favorite`, `feedback`, `email`, `facebook`, `referral`, `wallet`, `plan`, `search`, `announcement`, `opportunities`, `user`, `user-profile`, `user-org-roles`, `tour-operator`, `json-mapper`) fold into the nearest owning feature or a small `features/<leaf>/`. **Defer the long tail** — do not block on a perfect taxonomy.

---

## 4. Recommended strategy: incremental / strangler (decisive)

**Big-bang is rejected.** 207 components, 174 pages, 178 importers of the hook barrels, an in-flight backend refactor (`feat/refactor-server`), a pending better-auth migration that owns `auth/`, and **zero client test coverage**. A big-bang touches ~600 files in one unreviewable PR and guarantees merge conflicts with the server refactor.

**Incremental works because the barrels are a natural seam.** `@/api` (47 importers) and `@/hooks/queries` + `@/hooks/mutations` (178 importers) are chokepoints. Move the *implementation* behind the barrel; have the old file **re-export from the new feature location**. Consumers keep importing `@/api` / `@/hooks/queries` and never break, while files relocate one at a time.

**How to keep imports working during the move:**
1. **Barrel re-export shims.** When `hooks/queries/use-quote-queries.ts` moves to `features/quote/api/`, replace the old file with `export * from "@/features/quote/api/queries";`. Old importers compile unchanged. Delete shims in cleanup.
2. **`@/api` stays a facade.** `api/index.ts` keeps re-exporting `quoteApi` etc., now sourced from `features/quote/api/`. No consumer edits mid-migration.
3. **`git mv`** for every move (preserve history/blame).
4. **One feature per PR**, each independently shippable.
5. **Coordinate with the server refactor**: short-lived branches off `feat/refactor-server`, merged quickly; avoid touching `App.tsx` (highest-conflict file) until late.

---

## 5. Phased plan

**Verification gate for every phase:** `npm run check` (tsc) passes, `npm run build` (vite) passes, `npm run dev:client` boots, touched routes render, **and the affected screens are visually and behaviourally identical to before the move (structure-only — see the hard constraint at the top).** Owner agent in brackets.

### Phase 0 — Decisions + lint scaffolding (no moves) [planner → human, then coder]
- Resolve the §8 open questions (naming convention, pages vs routes, boundary-lint now vs later).
- Add an ESLint config (none exists) with `import/no-restricted-paths` or `eslint-plugin-boundaries`, initially **warn-only**.
- Verify: `npm run check` green; lint runs.

### Phase 1 — Non-breaking `api/` + `config/` scaffolding [enhancer] — ✅ DONE
- `git mv client/src/lib/queryClient.ts client/src/api/queryClient.ts`; update `App.tsx:3` import only.
- Introduce `api/client.ts` re-exporting the existing axios instance (keep `axios-client.ts` re-exporting temporarily, or `git mv` + fix the ~10 relative importers — prefer keeping the `@/api` boundary).
- Keep `interceptors.ts` as a side-effect; `main.tsx:2` keeps working.
- Create `api/endpoints.ts` (seed a few constants) and `config/env.ts` (wrap `import.meta.env`). No consumers yet.
- Verify gate.

### Phase 2 — Confirm `components/ui` + `components/layout` are clean [code-reviewer]
- Already match target. Audit only: ensure no feature logic leaked (the 8 raw-axios offenders are NOT in ui/layout). No moves. Document as "compliant."

### Phase 3 — PILOT: migrate `quote` feature [coder + manual test + code-reviewer] — ✅ DONE
**Why quote first:** richest, most self-contained domain (already has `components/quote/sections/` + `hooks/`), core to the Enquiry→Quote→Booking lifecycle, exercises every pattern (queries, mutations, image uploads, a raw-axios offender in `use-quote-share.ts`). Proving it here de-risks the rest.
- Create `features/quote/{api,components,hooks}/`, `types.ts`, `index.ts`.
- `git mv` `components/quote/**` → `features/quote/components/**`.
- `git mv` `use-quote-queries.ts` + image variants, `use-quote-mutations.ts` + `use-quote-image-mutations.ts` → `features/quote/api/`.
- Move `quote.api.ts` fetchers into `features/quote/api/` (extract URL literals into `api/endpoints.ts`); fix `use-quote-share.ts` to use the shared client.
- Move `types/quote/**` → `features/quote/types.ts`.
- Replace old files with re-export shims; keep `@/api` and `@/hooks/queries` barrels re-exporting from the feature.
- `features/quote/index.ts` re-exports the public surface.
- Leave the 26 cross-feature `@/components/quote/...` importers on shims for now; convert opportunistically. App.tsx `QuotePage` lazy import stays (it's a page).
- Verify gate + manually exercise `/quotes/:quoteId`.

### Phase 4 — Fan out core lifecycle features [coder, one PR each] — ✅ DONE
Order: `booking` → `client` → `enquiry` → `transaction` → `dashboard`. Same recipe. Fix raw-axios offenders as encountered (`boards/social-posts-board.tsx`, `lookups/add-*`, `ask-ai-dialog.tsx`).

### Phase 5 — Supporting features [coder/enhancer] — ✅ DONE
`organization`, `platform-admin`, `invite`/onboarding, `reports`, `hr`, `tasks`, `tickets`, `chat`, `social`, `sms`, `lookups`, `notifications`, `destination-guru`, plus leaf APIs (`airport`, `announcement`, `attachment`, `email`, `favorite`, `feedback`, `json-mapper`, `note`, `opportunities`, `referral`, `reply`, `search`, `tag`, `tour-operator`, `user`, `user-profile`) and `wallet` — all moved to `features/`, with shims at old locations. After this, `api/endpoints/` holds only `auth.api.ts` (deferred). 36 feature folders.

### Phase 6 — Convert consumers off shims + delete shims + relocate loose components [enhancer + code-reviewer] — ✅ DONE
**Outcome:** all 95 per-file shims deleted; ~160 importer files codemoded to feature paths; loose components relocated (new `components/shared/` for rich-text-editor/mention-editor/ask-ai-dialog, new `features/hub/`, plus chat/email/destination-guru/social/notifications/client component folders); `header-create-menu` → `components/layout`; `types/chat` folded into `features/chat/types`. `types/` now holds only `auth/`; `hooks/queries` + `hooks/mutations` hold only their `index.ts` barrel + auth files. `tsc` clean, `vite build` green. **Kept as facades** (feature-sourced): the `@/api`, `@/hooks/queries`, `@/hooks/mutations` aggregator barrels — fully retiring them (so consumers import only from `@/features/<x>`) is optional later cleanup. **Deferred (Phase 7):** `branding-applier`, `role-route`, all `auth.*` files/hooks/types. `components/admin` left as-is (not part of a feature).
- Codemod imports: `@/components/quote/...` → `@/features/quote`; `@/hooks/queries` → feature `api/`.
- Delete all re-export shim files. Trim `@/api` barrel.
- **Relocate the loose root components** left in `components/` to their decided homes (verified by importer analysis; resolves open question #6). Same `git mv` + path-rewrite recipe:

  | Loose component | Home |
  |---|---|
  | `chat-rich-input` | `features/chat/components` |
  | `email-inbox` | `features/email/components` |
  | `destination-guru` | `features/destination-guru/components` |
  | `social-post-preview-dialog` | `features/social/components` |
  | `notification-toast`, `notifications-dropdown` | `features/notifications/components` |
  | `hub-components`, `hub-shell` | new `features/hub/components` (with `pages/hub/**` as route shells) |
  | `csv-import-dialog` | `features/client/components` (sole consumer is the clients page) |
  | `header-create-menu` | `components/layout` (part of the header) |
  | `rich-text-editor`, `mention-editor`, `ask-ai-dialog` | new **`components/shared/`** (cross-feature, non-primitive — see spec note) |
  | `branding-applier`, `role-route` | **defer to Phase 7** (auth/org bootstrapping) |

- Flip ESLint boundary rules **warn → error**.
- Verify gate; full manual smoke across roles.

### Phase 7 — `auth/` (DEFERRED — see §7) [coder, post-better-auth]
- Only after `docs/better-auth-migration-plan.md` lands. Then create `auth/{auth-client.ts, AuthProvider.tsx, useSession.ts, guards.tsx}`, migrating `hooks/use-auth.ts`, `use-role.ts`, `components/role-route.tsx`, `auth.api.ts`.

### Phase 8 (optional) — extract `router.tsx` from `App.tsx` [coder]
- Cosmetic; defer to avoid conflicts with the server refactor and better-auth (both touch auth gating in `App.tsx`).

---

## 6. Mechanics — moving files without breaking imports

- **Preserve history:** always `git mv`, never delete+create.
- **Path alias:** no change needed — `@/* -> client/src/*` (tsconfig.json:20, vite.config.ts:28) already covers `@/features/...`. Do **not** add per-feature tsconfig paths (avoids tsconfig/vite drift).
- **Barrel shims** (core trick): old location re-exports new location so the 178 hook-importers and 47 api-importers never break mid-flight.
- **Boundary lint** (add, warn-first): `eslint-plugin-boundaries` or `import/no-restricted-paths` to enforce: (a) no `import axios`/`axios-client` outside `api/` and `features/*/api/` (catches the 8 offenders); (b) no deep cross-feature imports — only `@/features/<x>` (index); (c) `components/ui` and `components/layout` may not import from `features/`. Start **warn** (Phase 0), flip to **error** (Phase 6).
- **Windows / case-sensitivity gotcha (critical — win32 repo):** `git mv` that only changes case (e.g. `QuoteCostingsCard.tsx` → `quote-costings-card.tsx`) is unreliable on case-insensitive NTFS. If renaming, two-step (`git mv X tmp && git mv tmp x`) or `git mv -f`, and set `git config core.ignorecase false` for the migration. **Recommendation: do NOT rename files during the structural move** — relocate first, keep existing names; do any kebab-vs-Pascal normalization in a separate, isolated PR.

---

## 7. Coordination with the better-auth migration

- `docs/better-auth-migration-plan.md` is **DRAFT, no code changes**. It keeps the client cookie/axios model; auth integration collapses to one server-side seam (`isAuthenticated`).
- The target `auth/` folder (`auth-client.ts`, `AuthProvider.tsx`, `useSession.ts`, `guards.tsx`) is a **better-auth** shape. Building it now = throwaway scaffolding.
- **Sequencing:** keep current auth files (`hooks/use-auth.ts`, `use-role.ts`, `auth.api.ts`, `components/role-route.tsx`) **in place** through Phases 1-6. Treat `auth` as a *staged* feature but do NOT migrate into `auth/` until better-auth lands (Phase 7). Avoid editing `App.tsx`'s auth gating (App.tsx:184-265) during the structural migration — better-auth will rewrite that seam.

---

## 8. Risks & open questions (human decisions required)

1. **File naming convention.** Mixed kebab (`quote-create-dialog.tsx`) vs PascalCase (`QuoteCostingsCard.tsx`). CLAUDE.md mandates kebab for the *backend*; the client section does not. **Decide:** normalize to kebab, or keep PascalCase for components (React-idiomatic) + kebab for non-components. Do case-renames in an isolated PR (win32 risk, §6).
2. **`pages/` vs `routes/`.** CLAUDE.md allows either. Recommend **keep `pages/`** (174 files, no upside to renaming).
3. **Boundary lint now or later?** No ESLint config today. Recommend warn-only in Phase 0, error in Phase 6. Human must approve adding ESLint to toolchain/CI.
4. **`endpoints.ts` scope.** Full extraction of all hardcoded URLs (e.g. `/api/v2/quotes`, `quote.api.ts:17`) is significant. **Decide:** extract incrementally per-feature, or only centralize the `/api/v2` prefix.
5. **Page-level mini-features.** `pages/agency/` (31), `pages/hr-v2/` (15), `pages/portal/` (12) contain their own components — `features/` or page-local? Recommend: extract data/components into `features/`, keep route shells in `pages/`.
6. **Shared cross-feature components.** ✅ **RESOLVED.** Genuinely cross-feature, non-primitive components (`rich-text-editor`, `mention-editor`, `ask-ai-dialog`) go in a new **`components/shared/`** bucket (added to the CLAUDE.md client spec). Feature-owned loose components move to their feature; `header-create-menu` → `components/layout`; `branding-applier`/`role-route` defer to Phase 7. Full disposition table is in Phase 6. Moves are deferred to Phase 6 (executed with the shim-removal codemod, so all import rewrites happen in one pass).
7. **`router.tsx` extraction** — optional; recommend deferring (Phase 8) to avoid `App.tsx` conflicts.
8. **No client tests** — verification is typecheck + build + manual smoke only. Risk of silent runtime regressions (e.g. a missed lazy import). Mitigate with per-feature smoke checklists; consider a minimal smoke test before fan-out.

---

## 9. Relevant files

- `CLAUDE.md` (target spec — "Client / Frontend Structure")
- `client/src/App.tsx` (wouter router, lazy page imports, auth gating)
- `client/src/main.tsx` (interceptor side-effect import)
- `client/src/api/client/axios-client.ts`, `client/src/api/client/interceptors.ts`, `client/src/api/index.ts`
- `client/src/lib/queryClient.ts`
- `client/src/hooks/queries/use-quote-queries.ts` (barrel-consumer pattern)
- `client/src/api/endpoints/quote.api.ts` (hardcoded URLs)
- `tsconfig.json` (lines 19-22), `vite.config.ts` (lines 26-30)
- `docs/better-auth-migration-plan.md` (`auth/` dependency)
