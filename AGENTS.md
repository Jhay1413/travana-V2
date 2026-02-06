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




# Frontend Architecture Agent Rules

## Project Overview
Build a React frontend application using **React + TanStack Router + TypeScript + Axios + TanStack Query** with strict architectural patterns, organized API layer, and protected routes.

---

## Core Technology Stack

- **Framework**: React 18+
- **Language**: TypeScript
- **Routing**: TanStack Router (file-based routing)
- **HTTP Client**: Axios
- **Data Fetching**: TanStack Query (React Query)
- **State Management**: TanStack Query + React Context (for auth)
- **Package Manager**: npm or pnpm

---

## Enforced Architecture Pattern

**STRICT RULES**:
1. **ALL API requests** must be in the `api/` folder
2. **ALL data fetching** must use TanStack Query hooks
3. **ALL routes** must be protected with authentication checks
4. **Custom hooks** for all queries and mutations
5. **No direct Axios calls** in components - always use hooks

---

## Project Structure

```
src/
├── api/                          # ALL API requests go here
│   ├── client/
│   │   ├── axios-client.ts       # Axios instance configuration
│   │   └── interceptors.ts       # Request/response interceptors
│   ├── endpoints/
│   │   ├── auth.api.ts           # Auth-related API calls
│   │   ├── user.api.ts           # User-related API calls
│   │   └── product.api.ts        # Product-related API calls
│   └── index.ts                  # Export all API functions
├── hooks/                        # Custom hooks (TanStack Query)
│   ├── queries/
│   │   ├── use-user.ts           # User query hooks
│   │   ├── use-products.ts       # Product query hooks
│   │   └── index.ts
│   ├── mutations/
│   │   ├── use-auth.ts           # Auth mutation hooks
│   │   ├── use-user-mutations.ts
│   │   └── index.ts
│   └── use-auth-state.ts         # Auth state hook
├── routes/                       # TanStack Router routes
│   ├── __root.tsx                # Root route
│   ├── _authenticated.tsx        # Protected route layout
│   ├── _authenticated/
│   │   ├── dashboard.tsx         # Protected: /dashboard
│   │   ├── profile.tsx           # Protected: /profile
│   │   └── users/
│   │       ├── index.tsx         # Protected: /users
│   │       └── $id.tsx           # Protected: /users/:id
│   ├── _public.tsx               # Public route layout
│   ├── _public/
│   │   ├── login.tsx             # Public: /login
│   │   └── register.tsx          # Public: /register
│   └── index.tsx                 # Home route
├── components/
│   ├── ui/                       # Reusable UI components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── card.tsx
│   ├── layouts/
│   │   ├── authenticated-layout.tsx
│   │   └── public-layout.tsx
│   └── features/                 # Feature-specific components
│       ├── auth/
│       │   ├── login-form.tsx
│       │   └── register-form.tsx
│       └── users/
│           ├── user-list.tsx
│           └── user-card.tsx
├── lib/                          # Configuration & utilities
│   ├── query-client.ts           # TanStack Query client setup
│   ├── router.ts                 # TanStack Router setup
│   └── constants.ts              # App constants
├── contexts/
│   └── auth-context.tsx          # Auth context provider
├── types/                        # TypeScript types (organized by domain)
│   ├── api/
│   │   ├── request.types.ts
│   │   ├── response.types.ts
│   │   └── index.ts
│   ├── auth/
│   │   ├── auth.types.ts
│   │   └── index.ts
│   ├── user/
│   │   ├── user.types.ts
│   │   └── index.ts
│   └── common/
│       ├── pagination.types.ts
│       └── index.ts
├── utils/
│   ├── storage.ts                # LocalStorage helpers
│   ├── validators.ts             # Validation helpers
│   └── formatters.ts             # Data formatters
├── App.tsx
├── main.tsx
└── vite-env.d.ts
```

---

## Layer-by-Layer Implementation Guide

### 1. API Layer (`api/`)

**CRITICAL RULE**: ALL API requests MUST be defined in the `api/` folder

#### Axios Client Setup

```typescript
// api/client/axios-client.ts
import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;
```

#### Interceptors

```typescript
// api/client/interceptors.ts
import { apiClient } from './axios-client';
import { getToken, clearAuth } from '@/utils/storage';

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear auth and redirect
      clearAuth();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

#### API Endpoint Functions

```typescript
// api/endpoints/auth.api.ts
import { apiClient } from '../client/axios-client';
import type { 
  LoginRequest, 
  LoginResponse, 
  RegisterRequest, 
  RegisterResponse 
} from '@/types/auth';

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/login', data);
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<RegisterResponse> => {
    const response = await apiClient.post<RegisterResponse>('/auth/register', data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
};

// api/endpoints/user.api.ts
import { apiClient } from '../client/axios-client';
import type { User, UpdateUserRequest } from '@/types/user';

export const userApi = {
  getUsers: async () => {
    const response = await apiClient.get<User[]>('/users');
    return response.data;
  },

  getUserById: async (id: string) => {
    const response = await apiClient.get<User>(`/users/${id}`);
    return response.data;
  },

  updateUser: async (id: string, data: UpdateUserRequest) => {
    const response = await apiClient.put<User>(`/users/${id}`, data);
    return response.data;
  },

  deleteUser: async (id: string) => {
    await apiClient.delete(`/users/${id}`);
  },
};

// api/index.ts
export * from './endpoints/auth.api';
export * from './endpoints/user.api';
```

---

### 2. TanStack Query Hooks (`hooks/`)

**CRITICAL RULE**: ALL data fetching MUST use TanStack Query hooks

#### Query Hooks

```typescript
// hooks/queries/use-user.ts
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { userApi } from '@/api';
import type { User } from '@/types/user';

// Query Keys
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: string) => [...userKeys.lists(), { filters }] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};

// Get all users
export const useUsers = (): UseQueryResult<User[], Error> => {
  return useQuery({
    queryKey: userKeys.lists(),
    queryFn: userApi.getUsers,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Get user by ID
export const useUser = (id: string): UseQueryResult<User, Error> => {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => userApi.getUserById(id),
    enabled: !!id, // Only run if ID exists
  });
};

// Get current authenticated user
export const useCurrentUser = () => {
  return useQuery({
    queryKey: ['auth', 'currentUser'],
    queryFn: () => authApi.getCurrentUser(),
    retry: false,
  });
};
```

#### Mutation Hooks

```typescript
// hooks/mutations/use-auth.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { authApi } from '@/api';
import { setToken, clearAuth } from '@/utils/storage';
import type { LoginRequest, RegisterRequest } from '@/types/auth';

export const useLogin = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
    onSuccess: (response) => {
      setToken(response.token);
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      navigate({ to: '/dashboard' });
    },
    onError: (error: any) => {
      console.error('Login failed:', error);
    },
  });
};

export const useRegister = () => {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: RegisterRequest) => authApi.register(data),
    onSuccess: (response) => {
      setToken(response.token);
      navigate({ to: '/dashboard' });
    },
  });
};

export const useLogout = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      clearAuth();
      queryClient.clear();
      navigate({ to: '/login' });
    },
  });
};

// hooks/mutations/use-user-mutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '@/api';
import { userKeys } from '@/hooks/queries/use-user';
import type { UpdateUserRequest } from '@/types/user';

export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserRequest }) =>
      userApi.updateUser(id, data),
    onSuccess: (_, variables) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: userKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => userApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
};
```

---

### 3. TanStack Router with Protected Routes (`routes/`)

**CRITICAL RULE**: ALL authenticated routes MUST use route protection

#### Root Route

```typescript
// routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <TanStackRouterDevtools />
      <ReactQueryDevtools />
    </>
  ),
});
```

#### Protected Route Layout

```typescript
// routes/_authenticated.tsx
import { 
  createFileRoute, 
  Outlet, 
  redirect 
} from '@tanstack/react-router';
import { AuthenticatedLayout } from '@/components/layouts/authenticated-layout';
import { getToken } from '@/utils/storage';

// This layout wraps all protected routes
export const Route = createFileRoute('/_authenticated')({
  // Before load - check authentication
  beforeLoad: async ({ location }) => {
    const token = getToken();

    if (!token) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: AuthenticatedLayoutComponent,
});

function AuthenticatedLayoutComponent() {
  return (
    <AuthenticatedLayout>
      <Outlet />
    </AuthenticatedLayout>
  );
}
```

#### Protected Routes

```typescript
// routes/_authenticated/dashboard.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useCurrentUser } from '@/hooks/queries/use-user';

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {user?.firstName}!</p>
    </div>
  );
}

// routes/_authenticated/users/index.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useUsers } from '@/hooks/queries/use-user';
import { UserList } from '@/components/features/users/user-list';

export const Route = createFileRoute('/_authenticated/users/')({
  component: UsersPage,
});

function UsersPage() {
  const { data: users, isLoading, error } = useUsers();

  if (isLoading) return <div>Loading users...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>Users</h1>
      <UserList users={users || []} />
    </div>
  );
}

// routes/_authenticated/users/$id.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useUser } from '@/hooks/queries/use-user';

export const Route = createFileRoute('/_authenticated/users/$id')({
  component: UserDetailPage,
});

function UserDetailPage() {
  const { id } = Route.useParams();
  const { data: user, isLoading } = useUser(id);

  if (isLoading) return <div>Loading user...</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div>
      <h1>{user.firstName} {user.lastName}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

#### Public Routes

```typescript
// routes/_public.tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { PublicLayout } from '@/components/layouts/public-layout';
import { getToken } from '@/utils/storage';

export const Route = createFileRoute('/_public')({
  // Redirect to dashboard if already authenticated
  beforeLoad: async () => {
    const token = getToken();
    if (token) {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: () => (
    <PublicLayout>
      <Outlet />
    </PublicLayout>
  ),
});

// routes/_public/login.tsx
import { createFileRoute } from '@tanstack/react-router';
import { LoginForm } from '@/components/features/auth/login-form';

export const Route = createFileRoute('/_public/login')({
  component: LoginPage,
});

function LoginPage() {
  return (
    <div>
      <h1>Login</h1>
      <LoginForm />
    </div>
  );
}
```

---

### 4. Components Using Hooks

**RULE**: Components should ONLY use hooks, never direct API calls

```typescript
// components/features/auth/login-form.tsx
import { useState } from 'react';
import { useLogin } from '@/hooks/mutations/use-auth';
import type { LoginRequest } from '@/types/auth';

export const LoginForm = () => {
  const [formData, setFormData] = useState<LoginRequest>({
    email: '',
    password: '',
  });

  const loginMutation = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={formData.password}
        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        placeholder="Password"
        required
      />
      <button type="submit" disabled={loginMutation.isPending}>
        {loginMutation.isPending ? 'Logging in...' : 'Login'}
      </button>
      {loginMutation.isError && (
        <p>Error: {loginMutation.error.message}</p>
      )}
    </form>
  );
};

// components/features/users/user-list.tsx
import { useDeleteUser } from '@/hooks/mutations/use-user-mutations';
import type { User } from '@/types/user';

interface UserListProps {
  users: User[];
}

export const UserList = ({ users }: UserListProps) => {
  const deleteMutation = useDeleteUser();

  const handleDelete = (id: string) => {
    if (confirm('Are you sure?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div>
      {users.map((user) => (
        <div key={user.id}>
          <h3>{user.firstName} {user.lastName}</h3>
          <p>{user.email}</p>
          <button onClick={() => handleDelete(user.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
};
```

---

### 5. Configuration Files

#### TanStack Query Client

```typescript
// lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

#### Router Setup

```typescript
// lib/router.ts
import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export const router = createRouter({ 
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
```

---

### 6. Utility Functions

```typescript
// utils/storage.ts
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setUser = (user: any): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getUser = (): any | null => {
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
};

export const clearAuth = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};
```

---

### 7. Types Organization

**CRITICAL RULE**: Always organize types in folders by domain

```typescript
// types/auth/auth.types.ts
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface RegisterResponse {
  token: string;
  user: User;
}

// types/auth/index.ts
export * from './auth.types';

// types/user/user.types.ts
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
}

// types/user/index.ts
export * from './user.types';

// types/api/response.types.ts
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}
```

---

### 8. Main App Setup

```typescript
// main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { router } from './lib/router';
import { queryClient } from './lib/query-client';
import './api/client/interceptors'; // Initialize interceptors
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);
```

---

## Critical Rules Summary

### ✅ DO:

1. **API Organization**:
   - ✅ ALL API requests in `api/` folder
   - ✅ Use Axios client with interceptors
   - ✅ One file per resource (auth.api.ts, user.api.ts)

2. **Data Fetching**:
   - ✅ ALL data fetching through TanStack Query hooks
   - ✅ Use `useQuery` for GET requests
   - ✅ Use `useMutation` for POST/PUT/DELETE
   - ✅ Define query keys for cache management

3. **Route Protection**:
   - ✅ ALL authenticated routes under `_authenticated/`
   - ✅ Check auth in `beforeLoad`
   - ✅ Redirect to login if not authenticated
   - ✅ Redirect to dashboard if already authenticated (on login page)

4. **Component Patterns**:
   - ✅ Components use hooks only
   - ✅ No direct Axios calls in components
   - ✅ Handle loading and error states

5. **Type Safety**:
   - ✅ Organize types in folders by domain
   - ✅ Type all API requests and responses
   - ✅ Export types through index files

### ❌ DON'T:

- ❌ Make API calls outside the `api/` folder
- ❌ Use Axios directly in components
- ❌ Skip TanStack Query hooks
- ❌ Create unprotected routes for authenticated content
- ❌ Use `any` type
- ❌ Skip error handling
- ❌ Forget to invalidate queries after mutations
- ❌ Store sensitive data unencrypted

---

## File Naming Conventions

- API files: `*.api.ts`
- Query hooks: `use-*.ts` (e.g., `use-user.ts`)
- Mutation hooks: `use-*-mutations.ts`
- Components: `kebab-case.tsx`
- Types: `*.types.ts`
- Routes: Follow TanStack Router conventions

---

## Essential Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@tanstack/react-router": "^1.58.0",
    "@tanstack/react-query": "^5.59.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@tanstack/router-devtools": "^1.58.0",
    "@tanstack/react-query-devtools": "^5.59.0",
    "@tanstack/router-vite-plugin": "^1.58.4",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

---

## Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-vite-plugin';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    TanStackRouterVite(), // Generates route tree
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

---

## Environment Variables

```env
# .env
VITE_API_BASE_URL=http://localhost:3000/api
```

---

## Quick Start Checklist

1. ✅ Install dependencies (React, TanStack Router, TanStack Query, Axios)
2. ✅ Setup Vite with path aliases
3. ✅ Create folder structure as specified
4. ✅ Setup Axios client with interceptors in `api/client/`
5. ✅ Define API endpoints in `api/endpoints/`
6. ✅ Create TanStack Query client in `lib/`
7. ✅ Create custom hooks in `hooks/queries/` and `hooks/mutations/`
8. ✅ Setup protected route layout `_authenticated.tsx`
9. ✅ Setup public route layout `_public.tsx`
10. ✅ Create routes with proper protection
11. ✅ Build components that use hooks
12. ✅ Add authentication utilities
13. ✅ Test the auth flow and route protection

---

## Architecture Flow

```
Component
  ↓
Custom Hook (useQuery/useMutation)
  ↓
API Function (api/endpoints/)
  ↓
Axios Client (with interceptors)
  ↓
Backend API
```

---

## Route Protection Flow

```
User navigates to /dashboard
  ↓
TanStack Router checks beforeLoad
  ↓
Is token in localStorage?
  ├─ YES → Render protected route
  └─ NO → Redirect to /login
```

---

## Remember

- **Every API call goes through the `api/` folder**
- **Every data fetch uses TanStack Query hooks**
- **Every authenticated route is protected with `beforeLoad`**
- **Components never call APIs directly - always use hooks**
- **Types are organized in folders by domain**

This ensures maintainability, type safety, proper caching, and secure authentication!