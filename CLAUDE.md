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
