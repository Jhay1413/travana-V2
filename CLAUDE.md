# Agent Delegation (AI Context)

Always route work to the subagent best suited to the task instead of doing
everything inline. Pick the most specific agent that fits; fall back to a
general agent only when nothing specific applies. Launch independent pieces of
work as concurrent agents in a single message.

Routing guide:
- **coder** — implement new features or fix bugs (client React/TS or server Express/Drizzle).
- **enhancer** — refactor / simplify / speed up working code without changing behavior.
- **tester** — write or run unit/integration tests, or verify changes pass.
- **code-reviewer** — review a diff/PR/files for bugs and architecture violations (read-only).
- **planner** / **Plan** — design an implementation strategy or evaluate architectural fit BEFORE building.
- **Explore** — broad read-only search across many files when you only need the conclusion.
- **claude-code-guide** — questions about Claude Code, the Agent SDK, or the Claude API.

Notes:
- Match the agent to the work even when the user doesn't name one.
- For multi-step tasks, plan first (planner/Plan), then implement (coder), then review (code-reviewer) / test (tester).
- Reuse a running/recent agent via its id when continuing related work, rather than starting fresh.

---

# Backend Architecture Rules (AI Context)

## Stack
- Node.js + TypeScript
- Express.js
- PostgreSQL
- Drizzle ORM
- Zod validation

---

## Required Architecture Flow

STRICT ORDER (never skip layers):

Route → Controller → Service → Repository → Database

Rules:
- Each layer calls ONLY the next layer.
- No direct DB access outside repositories.
- No business logic outside services.
- No HTTP logic outside controllers.

---

## Layer Responsibilities

### Routes
Purpose: define HTTP endpoints.

Allowed:
- Express Router
- paths + methods
- middleware usage
- call controllers

Not allowed:
- business logic
- database queries

---

### Controllers
Purpose: HTTP handling.

Responsibilities:
- read req.body / params / query
- call services
- return formatted responses
- set HTTP status codes

Forbidden:
- business logic
- database access

---

### Services
Purpose: business logic layer.

Responsibilities:
- implement business rules
- orchestrate workflows
- call repositories
- transform data
- throw business errors

Forbidden:
- Express usage
- SQL queries

---

### Repositories
Purpose: database access only.

Rules:
- use Drizzle ORM exclusively
- one repository per entity
- perform CRUD operations
- return raw data or null

Forbidden:
- business logic
- HTTP handling

---

## Folder Structure

The active backend is `server/v2/`. New work goes there. The `server/` root layer
(flat `routes/`, `controllers/`, `services/`, `repositories/` folders) is the v1
legacy layout — do not add features to it.

### v2 layout

```
server/
  index.ts                  # entry point — mounts v1 and v2 routers
  v2/
    routes/
      index.ts              # aggregates all module routers
    modules/
      <feature>/
        <feature>.routes.ts
        <feature>.controller.ts
        <feature>.service.ts
        <feature>.repository.ts
        <feature>.validator.ts   # present when the module validates input
        <feature>.types.ts       # present when the module has local types
    settings/
      <entity>/
        <entity>.routes.ts
        <entity>.controller.ts
        <entity>.service.ts
        <entity>.repository.ts
    lookup/
      lookup.routes.ts
      lookup.service.ts
      lookup.repository.ts
    middlewares/
      auth/
      error.middleware.ts
      validation.middleware.ts
      async-handler.ts
    utils/
    types/
      common/
    config/

shared/
  schema.ts                 # ALL Drizzle table definitions live here
```

### Key module examples

```
server/v2/modules/booking/
  booking.routes.ts
  booking.controller.ts
  booking.service.ts
  booking.repository.ts
  booking.validator.ts
  booking.types.ts

server/v2/modules/quote/
  quote.routes.ts
  quote.controller.ts
  quote.service.ts
  quote.repository.ts
  quote.validator.ts
  quote.types.ts

server/v2/settings/cruise/
  cruise.routes.ts
  cruise.controller.ts
  cruise.service.ts
  cruise.repository.ts
```

---

## Database
- PostgreSQL via Drizzle ORM.
- All Drizzle table definitions live in `shared/schema.ts` (shared across server and client).
- Queries only inside repositories.

---

## Validation
- Use Zod for ALL request validation.
- Validation happens in middleware before controllers, using the `validate()` helper
  from `server/v2/middlewares/validation.middleware.ts`.
- Each module that validates input defines its schemas in `<feature>.validator.ts`.

---

## Types
- Module-local types live inside the feature folder as `<feature>.types.ts`.
- Shared/common types live in `server/v2/types/`.
- Rules:
  - use interfaces or types
  - no `any`

---

## Error Handling
- Services throw AppError.
- Global error middleware (`server/v2/middlewares/error.middleware.ts`) handles responses.

---

## Naming Conventions
Routes: `*.routes.ts`
Controllers: `*.controller.ts`
Services: `*.service.ts`
Repositories: `*.repository.ts`
Validators: `*.validator.ts`
Types: `*.types.ts`

Use kebab-case for all file names (e.g. `quote-public.repository.ts`, not `quotePublic.repository.ts`).

---

## Response Flow

```
HTTP Request
 → Route (server/v2/modules/<feature>/<feature>.routes.ts)
 → Middleware (validation / auth)
 → Controller (<feature>.controller.ts)
 → Service (<feature>.service.ts)
 → Repository (<feature>.repository.ts)
 → Database (via Drizzle, schema from shared/schema.ts)
 → Response
```

---

## Critical Constraints

DO:
- follow layer order strictly
- place new features under `server/v2/modules/<feature>/`
- use `shared/schema.ts` for Drizzle table definitions
- use async/await
- named exports
- TypeScript strict mode

DO NOT:
- skip layers
- mix responsibilities
- query DB outside repositories
- add business logic to controllers or routes
- add new code to the v1 `server/` flat layout
- use `any`

---

## Mental Model

Controller = HTTP translator
Service = business brain
Repository = database access

---

# Client / Frontend Structure (AI Context)

## Stack
- React + TypeScript
- Vite
- TanStack Query (server state)
- Axios (HTTP)
- better-auth (auth client)

---

## Reference Folder Structure

> **NOTE — this is the TARGET structure, not the current layout.** New frontend work should follow it, but existing code differs and is migrating toward it. Today the client still uses `src/api/endpoints/`, `src/api/client/axios-client.ts`, `src/hooks/mutations/`, `src/hooks/queries/`, flat `src/components/` and `src/pages/`, and `src/types/` — there is no `features/` or `auth/` folder yet. The `auth/` (better-auth) section reflects the planned auth migration (see `docs/better-auth-migration-plan.md`), which is not yet implemented; auth is currently cookie/axios-based. When working in an existing area, match what's already there; apply this structure for net-new features unless told otherwise.

The client lives in `client/`. New frontend work follows this structure:

```
client/
├── public/
├── src/
│   ├── api/                      # Axios setup + API layer
│   │   ├── client.ts             # Axios instance (baseURL, interceptors)
│   │   ├── endpoints.ts          # Centralized endpoint constants
│   │   └── queryClient.ts        # TanStack QueryClient config
│   │
│   ├── auth/                     # better-auth integration
│   │   ├── auth-client.ts        # createAuthClient() instance
│   │   ├── AuthProvider.tsx      # Session context provider
│   │   ├── useSession.ts         # Hook wrapping auth client session
│   │   └── guards.tsx            # ProtectedRoute / RequireAuth
│   │
│   ├── components/               # Shared, reusable UI
│   │   ├── ui/                   # Primitives (Button, Input, Modal…)
│   │   ├── layout/               # Header, Sidebar, PageShell
│   │   └── shared/               # Cross-feature, non-primitive components
│   │
│   ├── features/                 # Feature-based modules (the core)
│   │   ├── users/
│   │   │   ├── api/              # queries + mutations for this feature
│   │   │   │   ├── useUsers.ts
│   │   │   │   └── useUpdateUser.ts
│   │   │   ├── components/
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   └── dashboard/
│   │       ├── api/
│   │       ├── components/
│   │       └── index.ts
│   │
│   ├── hooks/                    # Generic shared hooks
│   ├── lib/                      # Pure utilities/helpers
│   ├── pages/ (or routes/)       # Route-level components
│   ├── types/                    # Global/shared TS types
│   ├── config/                   # env, constants
│   │   └── env.ts
│   ├── styles/
│   ├── App.tsx
│   ├── main.tsx
│   └── router.tsx
│
├── .env
├── tsconfig.json
├── vite.config.ts
└── package.json
```

---

## Layer Responsibilities (Client)

### api/
Purpose: shared HTTP plumbing.
- `client.ts`: single configured Axios instance (`baseURL`, `withCredentials`, interceptors).
- `endpoints.ts`: centralized endpoint path constants — no hardcoded URL strings in features.
- `queryClient.ts`: the TanStack `QueryClient` config (defaults, retries, stale times).

### auth/
Purpose: authentication via better-auth.
- `auth-client.ts`: the `createAuthClient()` instance.
- `AuthProvider.tsx`: session context provider mounted near the app root.
- `useSession.ts`: hook wrapping the auth client's session.
- `guards.tsx`: route guards (`ProtectedRoute` / `RequireAuth`).

### features/
Purpose: feature-based modules — the core of the app.
- One folder per feature (e.g. `users/`, `dashboard/`).
- `api/`: feature-scoped TanStack Query hooks (`useUsers.ts`, `useUpdateUser.ts`) — these call the shared Axios `client` using `endpoints` constants.
- `components/`: components owned by that feature.
- `types.ts`: feature-local types.
- `index.ts`: the feature's public surface (re-exports) — import features through their `index.ts`, not deep paths.

### components/
Purpose: shared, reusable UI only.
- `ui/`: design-system primitives (Button, Input, Modal…).
- `layout/`: app shell (Header, Sidebar, PageShell).
- `shared/`: cross-feature components that are NOT primitives (e.g. rich-text-editor, mention-editor, ask-ai-dialog) — used by two or more unrelated features. A component used by only one feature belongs in that `features/<feature>/components/`, not here.
- No feature-specific business logic here — that belongs in `features/<feature>/components/`.

### hooks/ / lib/ / types/ / config/
- `hooks/`: generic cross-feature hooks (not tied to one feature).
- `lib/`: pure utilities/helpers (no React, no side effects).
- `types/`: global/shared TypeScript types.
- `config/env.ts`: environment + constants access.

### pages/ (or routes/)
Purpose: route-level components that compose features. Wiring only — push logic down into `features/`.

---

## Critical Constraints (Client)

DO:
- put feature work under `features/<feature>/`
- keep data fetching in TanStack Query hooks inside `features/<feature>/api/`
- call HTTP only through the shared Axios `client` + `endpoints` constants
- import a feature via its `index.ts`
- TypeScript strict mode, named exports

DO NOT:
- hardcode URLs or call `axios` directly inside components
- put feature business logic in `components/ui` or `components/layout`
- reach into another feature's internals (import its `index.ts` instead)
- use `any`
