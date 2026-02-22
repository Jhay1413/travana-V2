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

src/
  routes/
  controllers/
  services/
  repositories/
  schemas/
  validators/
  middlewares/
  utils/
  types/
  config/
  app.ts
  server.ts

---

## Validation
- Use Zod for ALL request validation.
- Validation happens in middleware before controllers.

---

## Types
- Organized by domain folders.
Example:

types/
  user/
  auth/
  common/

Rules:
- use interfaces or types
- no `any`

---

## Database
- PostgreSQL via Drizzle ORM.
- Schemas defined in `/schemas`.
- Queries only inside repositories.

---

## Error Handling
- Services throw AppError.
- Global error middleware handles responses.

---

## Naming Conventions
Routes: *.routes.ts
Controllers: *.controller.ts
Services: *.service.ts
Repositories: *.repository.ts
Validators: *.validator.ts
Schemas: *.schema.ts
Types: *.types.ts

---

## Response Flow

HTTP Request
 → Route
 → Middleware (validation/auth)
 → Controller
 → Service
 → Repository
 → Database
 → Response

---

## Critical Constraints

DO:
- follow layer order strictly
- use async/await
- named exports
- TypeScript strict mode

DO NOT:
- skip layers
- mix responsibilities
- query DB outside repositories
- add business logic to controllers

---

## Mental Model

Controller = HTTP translator  
Service = business brain  
Repository = database access
