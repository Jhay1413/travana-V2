# Apple Travel Agency Command Center

## Overview

This is a premium travel agency CRM (Customer Relationship Management) application built as a full-stack TypeScript project. The application provides travel agents with a command center to manage clients, quotes, accommodations, flights, commissions, and notes. It features a glassmorphism UI design with support for multiple user roles (Admin, Manager, Agent, Homeworker, Referer) and uses GBP currency formatting throughout.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **HTTP Client**: Axios with interceptors for session auth and response unwrapping
- **Styling**: Tailwind CSS v4 with shadcn/ui component library (New York style)
- **Animations**: Framer Motion for UI transitions
- **Build Tool**: Vite with custom plugins for Replit integration

The frontend follows an AGENTS.md-compliant architecture with strict separation of concerns:

#### API Layer (`client/src/api/`)
- `client/axios-client.ts` - Axios instance with `withCredentials: true` for session-based auth
- `client/interceptors.ts` - Response interceptor unwraps `{ success, data }` envelope; 401 interceptor redirects to login
- `endpoints/*.api.ts` - Domain-specific API endpoint functions (auth, client, quote, ticket, attachment, reply, etc.)
- `index.ts` - Barrel export of all API modules

#### Custom Hooks (`client/src/hooks/`)
- `queries/*.ts` - TanStack Query hooks with query key factories for data fetching (e.g., `useClients`, `useTickets`, `useAttachments`)
- `mutations/*.ts` - Mutation hooks with automatic query invalidation (e.g., `useCreateClient`, `useUpdateTicket`)
- Components ONLY use hooks for data access, never direct API calls

#### Type System (`client/src/types/`)
- Domain-organized folders: `client/`, `quote/`, `ticket/`, `attachment/`, `reply/`, `user/`, `auth/`, `dashboard/`, `tour-operator/`, `airport/`, `notification/`, `api/`
- Each folder has an `index.ts` barrel export

Key pages include:
- Landing page (unauthenticated users)
- Command Center (dashboard)
- Clients list and detail views
- Quote management
- Ticket management

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Style**: RESTful JSON API under `/api/*` prefix
- **Build**: esbuild for production bundling with selective dependency bundling

The server uses a storage abstraction layer (`IStorage` interface) that wraps database operations, making it easier to swap implementations if needed.

### Authentication
- **Provider**: Replit Auth via OpenID Connect
- **Session Storage**: PostgreSQL-backed sessions using `connect-pg-simple`
- **Session Duration**: 7 days with secure, HTTP-only cookies

Authentication is handled through dedicated routes in `/server/replit_integrations/auth/` with:
- OIDC discovery and token management
- User upsert on login (creates or updates user records)
- Session middleware with Passport.js

### Database
- **Database**: PostgreSQL (required via `DATABASE_URL` environment variable)
- **ORM**: Drizzle ORM with Zod schema validation
- **Migrations**: Drizzle Kit with `drizzle-kit push` for schema sync

The architecture follows a **transaction-centric** pattern where a `Transaction` is the central entity:
- Transaction → Enquiry (1:1)
- Transaction → Quotes (1:N, multi-variant)
- Transaction → Booking (1:1, converted from accepted quote)
- Transaction → Notes (1:N)

Transaction status lifecycle: `on_enquiry` → `on_quote` → `on_booking`

Schema includes tables for:
- `sessions` - Authentication session storage
- `users` - User accounts with role-based access
- `client_table` / `neon_clients` - Customer records (3300+ neon clients)
- `transaction` - Central entity linking enquiry, quotes, booking
- `enquiry_table` - Travel enquiry records (1:1 with transaction)
- `quote` - Multi-variant quote packages (N:1 with transaction)
- `booking` - Confirmed bookings (1:1 with transaction)
- `transaction_notes` - Notes keyed by transaction
- `deal_images` - Image attachments for deals
- `tasks` - Task management system
- `favorites` - Pinned/favorited items per user
- `tour_operators` / `airports` - Lookup tables
- `tickets` / `ticket_attachments` / `ticket_replies` - Support ticket system
- `notifications` - User notification system

Backend uses repository/service/controller pattern:
- `server/repositories/` - Data access layer (transaction, newQuote, booking, enquiryTable, etc.)
- `server/services/` - Business logic layer
- `server/controllers/` - Request handling
- `server/routes/` - Express route definitions

Frontend hooks follow transaction-centric pattern:
- `useTransactions()` - Fetch transactions with nested enquiry/quotes/booking
- `useQuote(id)` / `useQuotes()` - Quote data access
- `useBooking(id)` / `useBookings()` - Booking data access
- `useEnquiry(id)` / `useEnquiries()` - Enquiry data access
- `useNotes(transactionId)` - Notes keyed by transaction

### Development vs Production
- **Development**: Vite dev server with HMR, served through Express middleware
- **Production**: Static file serving from `dist/public`, single bundled server file

## External Dependencies

### Core Services
- **PostgreSQL**: Primary database (must be provisioned with `DATABASE_URL`)
- **Replit Auth**: OpenID Connect authentication provider

### Key NPM Packages
- `drizzle-orm` / `drizzle-kit`: Database ORM and migration tooling
- `express`: HTTP server framework
- `passport` / `openid-client`: Authentication handling
- `@tanstack/react-query`: Async state management
- `axios`: HTTP client for frontend API layer
- `@radix-ui/*`: Headless UI primitives for shadcn components
- `framer-motion`: Animation library
- `zod`: Runtime schema validation

### Replit-Specific Integrations
- `@replit/vite-plugin-runtime-error-modal`: Error overlay in development
- `@replit/vite-plugin-cartographer`: Development tooling
- `@replit/vite-plugin-dev-banner`: Development environment indicator
- Custom `vite-plugin-meta-images`: OpenGraph image handling for deployments