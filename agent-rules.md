# Backend Architecture Agent Rules

## Project Overview
Build a backend application using **Express + TypeScript + PostgreSQL + Drizzle ORM** with strict architectural patterns and separation of concerns.

---

## Core Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Validation**: Zod
- **Package Manager**: npm or pnpm

---

## Enforced Architecture Pattern

**STRICT FLOW**: `Routes → Controllers → Services → Repositories`

### Pattern Rules
1. **Routes** define HTTP endpoints and call Controllers
2. **Controllers** handle HTTP concerns (request/response) and call Services
3. **Services** contain business logic and call Repositories
4. **Repositories** handle database operations using Drizzle ORM
5. **Never skip layers** - each layer must call only the next layer down

---

## Project Structure

```
src/
├── config/
│   ├── database.ts          # Drizzle DB connection
│   └── env.ts                # Environment variables with Zod validation
├── routes/
│   ├── index.ts              # Route aggregator
│   ├── user.routes.ts
│   └── auth.routes.ts
├── controllers/
│   ├── user.controller.ts
│   └── auth.controller.ts
├── services/
│   ├── user.service.ts
│   └── auth.service.ts
├── repositories/
│   ├── user.repository.ts
│   └── auth.repository.ts
├── schemas/                  # Drizzle database schemas
│   ├── user.schema.ts
│   └── index.ts
├── types/                    # ALWAYS use folders for types
│   ├── user/
│   │   ├── user.types.ts
│   │   └── index.ts
│   ├── auth/
│   │   ├── auth.types.ts
│   │   └── index.ts
│   └── common/
│       ├── response.types.ts
│       └── index.ts
├── validators/               # Zod schemas for validation
│   ├── user.validator.ts
│   └── auth.validator.ts
├── utils/
│   ├── error-handler.ts
│   ├── logger.ts
│   ├── response.ts
│   └── async-handler.ts
├── middlewares/
│   ├── error.middleware.ts
│   ├── validation.middleware.ts
│   └── auth.middleware.ts
└── app.ts                    # Express app setup
└── server.ts                 # Server entry point
```

---

## Layer-by-Layer Implementation Guide

### 1. Routes Layer (`routes/`)

**Purpose**: Define HTTP endpoints and map to controllers

**Rules**:
- Use Express Router
- Only define HTTP methods and paths
- Call controller methods
- Apply middleware (validation, auth)
- No business logic

**Example**:
```typescript
// routes/user.routes.ts
import { Router } from 'express';
import { userController } from '@/controllers/user.controller';
import { validate } from '@/middlewares/validation.middleware';
import { createUserValidator } from '@/validators/user.validator';

const router = Router();

router.post(
  '/',
  validate(createUserValidator),
  userController.createUser
);

router.get('/:id', userController.getUserById);

export default router;
```

---

### 2. Controllers Layer (`controllers/`)

**Purpose**: Handle HTTP request/response, delegate to services

**Rules**:
- Extract data from `req.body`, `req.params`, `req.query`
- Call service layer methods
- Format responses using utility functions
- Handle HTTP status codes
- No business logic
- No database operations

**Example**:
```typescript
// controllers/user.controller.ts
import { Request, Response, NextFunction } from 'express';
import { userService } from '@/services/user.service';
import { successResponse } from '@/utils/response';
import { asyncHandler } from '@/utils/async-handler';
import type { CreateUserDTO } from '@/types/user';

export const userController = {
  createUser: asyncHandler(async (req: Request, res: Response) => {
    const userData: CreateUserDTO = req.body;
    const user = await userService.createUser(userData);

    return successResponse(res, user, 'User created successfully', 201);
  }),

  getUserById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await userService.getUserById(id);

    return successResponse(res, user, 'User retrieved successfully');
  })
};
```

---

### 3. Services Layer (`services/`)

**Purpose**: Contain business logic, orchestrate operations

**Rules**:
- Implement business rules and logic
- Call repository methods for data operations
- Can call multiple repositories
- Handle business-level errors
- Transform data as needed
- No HTTP concerns
- No direct database queries

**Example**:
```typescript
// services/user.service.ts
import { userRepository } from '@/repositories/user.repository';
import { AppError } from '@/utils/error-handler';
import type { CreateUserDTO, User } from '@/types/user';
import { hashPassword } from '@/utils/crypto';

export const userService = {
  async createUser(userData: CreateUserDTO): Promise<User> {
    // Business logic: Check if email exists
    const existingUser = await userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new AppError('Email already exists', 409);
    }

    // Business logic: Hash password
    const hashedPassword = await hashPassword(userData.password);

    // Call repository
    const user = await userRepository.create({
      ...userData,
      password: hashedPassword
    });

    return user;
  },

  async getUserById(id: string): Promise<User> {
    const user = await userRepository.findById(id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }
};
```

---

### 4. Repositories Layer (`repositories/`)

**Purpose**: Handle all database operations using Drizzle ORM

**Rules**:
- Use Drizzle ORM exclusively for database queries
- One repository per database table/entity
- Pure data access - no business logic
- Return raw data or null
- Use Drizzle query builder

**Example**:
```typescript
// repositories/user.repository.ts
import { db } from '@/config/database';
import { users } from '@/schemas/user.schema';
import { eq } from 'drizzle-orm';
import type { CreateUserDTO, User } from '@/types/user';

export const userRepository = {
  async create(userData: CreateUserDTO): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();

    return user;
  },

  async findById(id: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user || null;
  },

  async findByEmail(email: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user || null;
  },

  async update(id: string, data: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();

    return user;
  },

  async delete(id: string): Promise<void> {
    await db
      .delete(users)
      .where(eq(users.id, id));
  }
};
```

---

### 5. Database Schemas (`schemas/`)

**Purpose**: Define Drizzle ORM database schemas

**Example**:
```typescript
// schemas/user.schema.ts
import { pgTable, uuid, varchar, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});
```

---

### 6. Types (`types/`)

**CRITICAL RULE**: Always organize types in folders by domain

**Structure**:
```
types/
├── user/
│   ├── user.types.ts
│   ├── user-dto.types.ts
│   └── index.ts
├── auth/
│   ├── auth.types.ts
│   └── index.ts
└── common/
    ├── response.types.ts
    ├── pagination.types.ts
    └── index.ts
```

**Example**:
```typescript
// types/user/user.types.ts
export interface User {
  id: string;
  email: string;
  password: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDTO {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface UpdateUserDTO {
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
}

// types/user/index.ts
export * from './user.types';
export * from './user-dto.types';
```

---

### 7. Validators (`validators/`)

**Purpose**: Zod schemas for request validation

**Example**:
```typescript
// validators/user.validator.ts
import { z } from 'zod';

export const createUserValidator = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    firstName: z.string().min(2).optional(),
    lastName: z.string().min(2).optional()
  })
});

export const updateUserValidator = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID')
  }),
  body: z.object({
    firstName: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    isActive: z.boolean().optional()
  })
});
```

---

### 8. Utilities (`utils/`)

**Purpose**: Reusable helper functions

**Examples**:

```typescript
// utils/response.ts
import { Response } from 'express';

export const successResponse = (
  res: Response,
  data: any,
  message: string = 'Success',
  statusCode: number = 200
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

// utils/error-handler.ts
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// utils/async-handler.ts
import { Request, Response, NextFunction } from 'express';

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

---

### 9. Middlewares (`middlewares/`)

**Example**:
```typescript
// middlewares/validation.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { AppError } from '@/utils/error-handler';

export const validate = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(new AppError(error.errors[0].message, 400));
      }
      next(error);
    }
  };
};

// middlewares/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/utils/error-handler';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
};
```

---

### 10. Configuration (`config/`)

**Example**:
```typescript
// config/database.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/schemas';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export const db = drizzle(pool, { schema });

// config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string()
});

export const env = envSchema.parse(process.env);
```

---

## Critical Rules

### ✅ DO:
- Always follow the route → controller → service → repository pattern
- Use Zod for ALL input validation
- Organize types in folders by domain
- Use Drizzle ORM for all database operations
- Use async/await consistently
- Handle errors at appropriate layers
- Export using named exports (not default)
- Use TypeScript strict mode

### ❌ DON'T:
- Skip architectural layers
- Put business logic in controllers or routes
- Put HTTP logic in services
- Make direct database calls outside repositories
- Use `any` type
- Mix concerns between layers
- Use default exports (except for routes)

---

## File Naming Conventions

- Routes: `*.routes.ts`
- Controllers: `*.controller.ts`
- Services: `*.service.ts`
- Repositories: `*.repository.ts`
- Validators: `*.validator.ts`
- Types: `*.types.ts`
- Schemas: `*.schema.ts`
- Utils: Descriptive names (e.g., `error-handler.ts`)

---

## Example App Setup

```typescript
// app.ts
import express from 'express';
import routes from '@/routes';
import { errorHandler } from '@/middlewares/error.middleware';

const app = express();

app.use(express.json());
app.use('/api', routes);
app.use(errorHandler);

export default app;

// server.ts
import app from './app';
import { env } from '@/config/env';

const PORT = env.PORT;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## Package.json Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```

---

## Essential Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "drizzle-orm": "^0.29.0",
    "pg": "^8.11.0",
    "zod": "^3.22.0",
    "dotenv": "^16.3.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "@types/pg": "^8.10.0",
    "drizzle-kit": "^0.20.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0"
  }
}
```

---

## Quick Start Checklist

1. ✅ Initialize project with TypeScript
2. ✅ Install dependencies
3. ✅ Setup database schema with Drizzle
4. ✅ Create folder structure as specified
5. ✅ Define types in organized folders
6. ✅ Create Zod validators
7. ✅ Build repository layer (database access)
8. ✅ Build service layer (business logic)
9. ✅ Build controller layer (HTTP handling)
10. ✅ Define routes with validation
11. ✅ Add error handling middleware
12. ✅ Test the flow: Route → Controller → Service → Repository

---

## Remember

**Every request must flow through all layers in order:**
```
HTTP Request 
  → Route (define endpoint)
  → Middleware (validate)
  → Controller (handle HTTP)
  → Service (business logic)
  → Repository (database)
  → Database
```

**No shortcuts. No skipping layers. This ensures maintainability, testability, and separation of concerns.**