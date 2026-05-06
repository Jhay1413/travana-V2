# Frontend Architecture Rules (AI Context)

## Stack
- React 18
- TypeScript (strict mode)
- TanStack Query (server state)
- React Hook Form + Zod (forms and validation)
- Axios (HTTP client)
- Tailwind CSS + shadcn/ui (styling and primitives)
- Wouter (routing)

---

## Required Data Flow

STRICT ORDER (never skip layers):

Component → Hook (query/mutation) → API endpoint function → Axios client → Server

Rules:
- Components never call axios directly.
- Components never import from `api/` directly.
- All server state lives in TanStack Query — never in useState.
- All form state lives in React Hook Form — never in useState.
- API functions live only in `api/endpoints/`.
- Query and mutation hooks live only in `hooks/queries/` and `hooks/mutations/`.

---

## Layer Responsibilities

### Pages (`pages/`)
Purpose: top-level route views.

Allowed:
- Compose feature components
- Use query/mutation hooks
- Handle page-level layout

Forbidden:
- Direct API calls
- Inline axios usage
- Business logic beyond simple conditional rendering

---

### Components (`components/`)
Purpose: reusable UI building blocks.

Allowed:
- Receive data via props
- Use query/mutation hooks for self-contained data needs
- Emit events via callbacks

Forbidden:
- Direct API calls
- Direct axios usage
- Managing server state with useState

---

### Query Hooks (`hooks/queries/`)
Purpose: read server data via TanStack Query.

Rules:
- One file per domain: `use-quote-queries.ts`, `use-client-queries.ts`, etc.
- Always call the corresponding API endpoint function — never axios directly.
- Always define and export query keys from the same file.
- Export from `hooks/queries/index.ts`.

Example shape:
```typescript
export const quoteKeys = {
  all: ['quotes'] as const,
  detail: (id: string) => ['quotes', id] as const,
};

export function useQuote(id: string) {
  return useQuery({
    queryKey: quoteKeys.detail(id),
    queryFn: () => quoteApi.getById(id),
  });
}
```

---

### Mutation Hooks (`hooks/mutations/`)
Purpose: write server data via TanStack Query.

Rules:
- One file per domain: `use-quote-mutations.ts`, etc.
- Always invalidate relevant query keys in `onSuccess`.
- Never update local state manually after a mutation — always re-fetch via invalidation.
- Export from `hooks/mutations/index.ts`.

Example shape:
```typescript
export function useCreateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateQuotePayload) => quoteApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.all });
    },
  });
}
```

---

### API Endpoint Functions (`api/endpoints/`)
Purpose: define HTTP calls as plain async functions.

Rules:
- One file per domain: `quote.api.ts`, `client.api.ts`, etc.
- Always import from `@/api/client/axios-client` — never instantiate axios elsewhere.
- Return typed data — never return `any`.
- Functions are plain `async` — no React, no hooks.
- Re-export from `api/endpoints/index.ts`.

Example shape:
```typescript
import axios from '@/api/client/axios-client';
import type { Quote, CreateQuotePayload } from '@/types/quote';

export const quoteApi = {
  getById: async (id: string): Promise<Quote> => {
    const { data } = await axios.get(`/api/quotes/${id}`);
    return data;
  },
  create: async (payload: CreateQuotePayload): Promise<Quote> => {
    const { data } = await axios.post('/api/quotes', payload);
    return data;
  },
};
```

---

### Types (`types/`)
Purpose: shared TypeScript types and interfaces.

Rules:
- Organised by domain folder: `types/quote/`, `types/client/`, etc.
- Each folder has an `index.ts` that re-exports everything.
- No `any`. Use `unknown` and narrow when necessary.
- Prefer `interface` for object shapes, `type` for unions and aliases.
- Never define types inside component files — always extract to `types/`.

---

## Folder Structure

```
client/src/
  api/
    client/
      axios-client.ts       ← single axios instance, never create another
    endpoints/
      quote.api.ts
      client.api.ts
      ...
      index.ts
  components/
    ui/                     ← shadcn primitives, never modify directly
    <feature-name>/         ← feature-specific components
    <ComponentName>.tsx     ← shared reusable components
  hooks/
    queries/
      use-quote-queries.ts
      ...
      index.ts
    mutations/
      use-quote-mutations.ts
      ...
      index.ts
  lib/
    utils.ts                ← cn() and other pure utilities
    queryClient.ts          ← TanStack Query client config
  pages/
    <domain>/
      <PageName>.tsx
  types/
    quote/
      quote.types.ts
      index.ts
    ...
```

---

## Forms

- Use React Hook Form for ALL forms — never controlled components with useState.
- Schema defined with Zod, passed to `zodResolver`.
- Schema and default values defined in `types/<domain>/<domain>.types.ts`, not inside component files.
- Always use `<FormField>`, `<FormItem>`, `<FormLabel>`, `<FormControl>`, `<FormMessage>` from shadcn Form primitives.

```typescript
// Schema lives in types/, not in the component
export const createQuoteSchema = z.object({
  title: z.string().min(1),
  price: z.number().positive(),
});

export type CreateQuoteValues = z.infer<typeof createQuoteSchema>;
```

---

## Component Rules

### shadcn/ui
- Import primitives from `@/components/ui/<component>`.
- Never modify files inside `components/ui/` — extend by wrapping.
- If a new primitive is needed, add it via the shadcn CLI.

### New Components
- Use named exports — never default exports.
- Props interface defined in the same file (small) or in `types/` (complex/shared).
- One component per file.
- File name matches component name in kebab-case: `booking-summary-card.tsx` for `BookingRHFForm`.

### Styling
- Use Tailwind utility classes only.
- Never write inline `style={{}}` objects.
- Use `cn()` from `@/lib/utils` to merge conditional classes.
- Do not create new CSS files.

---

## State Management Rules

| State type | Where it lives |
|------------|---------------|
| Server data (API responses) | TanStack Query (`useQuery`) |
| Form data | React Hook Form (`useForm`) |
| UI-only state (open/close, tab, toggle) | `useState` in the component |
| Shared UI state across many components | `useState` lifted to nearest common ancestor |
| Global auth/user state | TanStack Query (`useCurrentUser`) |

**Never use useState for server data. Never use useQuery for form state.**

---

## Query Key Rules

- Always define query keys as constants in the query file — never inline strings.
- Use a factory object pattern so keys are composable.
- Pass query keys to `invalidateQueries` by reference, never by retyping the string.

```typescript
// CORRECT
export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  detail: (id: string) => [...clientKeys.all, 'detail', id] as const,
};

// WRONG
queryClient.invalidateQueries({ queryKey: ['clients'] }); // never retype
```

---

## Naming Conventions

| File type | Convention | Example |
|-----------|-----------|---------|
| Pages | PascalCase | `QuotePage.tsx` |
| Components | PascalCase | `BookingRHFForm.tsx` |
| Query hooks | `use-<domain>-queries.ts` | `use-quote-queries.ts` |
| Mutation hooks | `use-<domain>-mutations.ts` | `use-quote-mutations.ts` |
| API files | `<domain>.api.ts` | `quote.api.ts` |
| Type files | `<domain>.types.ts` | `quote.types.ts` |
| Utility files | kebab-case | `json-import-handler.ts` |
| UI primitives | kebab-case | `searchable-select.tsx` |

---

## Error Handling

- Wrap mutations in try/catch only when custom logic is needed on error.
- Use TanStack Query's `onError` / `isError` for displaying errors to users.
- Use `useToast()` from `@/hooks/use-toast` for user-facing error messages.
- Never `console.error` in production code paths — surface errors to the UI or the query error state.

---

## Critical Constraints

DO:
- Follow the data flow strictly: Component → Hook → API → axios
- Use named exports everywhere
- Type all function parameters and return values
- Use `@/` path alias for all imports — never use relative `../../` paths
- Keep components focused — split when a component exceeds ~200 lines
- Always invalidate query keys after mutations

DO NOT:
- Call axios directly from a component or page
- Use `any` — use `unknown` and narrow it
- Manage server data in `useState`
- Manage form state outside React Hook Form
- Modify files inside `components/ui/` directly
- Create a second axios instance
- Define schemas inside component files
- Use default exports

---

## Mental Model

Page = layout and composition
Component = focused UI unit
Query Hook = read from server
Mutation Hook = write to server
API function = HTTP call definition
Type = shape contract
