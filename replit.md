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
- Destination Guru (AI-powered destination intelligence with OpenAI generation and database persistence)

#### Global Search
- **Backend**: `GET /api/search?q=<term>` (`server/repositories/search.repository.ts`) — single SQL query per category with proper JOINs for destination/country/accommodation data
- **Frontend**: `useGlobalSearch` hook (`client/src/hooks/queries/use-search-queries.ts`) with 250ms debounce in `command-center-shell.tsx`
- Searches across clients (name, email, phone, city), quotes (destination, country, accommodation, tour operator, client name), and bookings (destination, country, accommodation, hays ref, supplier ref, client name)
- Results are categorized with color-coded badges (blue=Client, amber=Quote, green=Booking)
- Clicking a result navigates to the relevant detail page
- Shows up to 5 results per category

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
- Email/password login with bcrypt hashing
- Forgot password flow: generates reset token (stored in `user.resetToken`/`user.resetTokenExpiry`), 1-hour expiry
- Reset password flow: validates token, updates password, clears token
- Frontend pages: `/forgot-password` and `/reset-password/:token` (public, no auth required)

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
- `destination_guru` - AI-generated destination intelligence (JSONB data, unique per destination)
- `feedback` - User feedback/suggestions/bug reports with status tracking
- `hub_announcements` - TheHUB news & announcements with rich text content, categories, pinning, and optional image_url
- `hub_announcement_likes` - Like tracking for hub announcements (unique per user+announcement)
- `quote_views` - Customer view tracking for shared quotes (device, browser, IP)
- `audit_log` - Deletion audit trail for quotes/bookings (entity snapshot, reason, performer)
- `quote_customer_actions` - Customer responses to shared quotes (accepted/changes_requested)
- `portal_messages` - Client-agent messaging for portal (sender, agent_name, text)
- `chat_conversations` - Internal live chat conversations (type, name, portalClientId, portalClientName for portal-linked chats)
- `chat_participants` - Chat conversation membership
- `chat_messages` - Chat message content with sender tracking
- `webauthn_credentials` - Biometric login credentials for portal clients (WebAuthn/Passkeys)
- `push_subscriptions` - Web Push notification subscriptions for portal clients (endpoint, p256dh, auth keys)

#### Client Portal Authentication
- **PIN Login**: Clients log in with email + 4-digit PIN (bcrypt-hashed, stored in `client_table.portal_pin`)
- **Biometric Login**: After first PIN login, WebAuthn/Passkeys registration for Face ID/fingerprint
- **JWT Tokens**: Portal auth uses JWT tokens (30-day expiry) with `clientId` + `email` payload
- **Portal Middleware**: `portalAuth` middleware on protected routes extracts clientId from Bearer token
- **PIN Management**: Agents set/change/remove client PINs from the client detail page (Portal Access section above Contact Details)
- **Portal Routes**: All at `/api/portal/*` (registered before auth middleware in `server/index.ts`)
  - Public: `/login`, `/webauthn/login`, `/webauthn/check`, `/deals`, `/has-pin/:clientId`, `/set-pin`, `/remove-pin`, `/push/vapid-key`
  - Protected (JWT): `/user`, `/quotes`, `/bookings`, `/messages`, `/message`, `/quote-request`, `/interest`, `/webauthn/register`, `/push/subscribe`, `/push/unsubscribe`
- **Real Data**: Portal quotes/bookings pull from `transaction` → `quote`/`booking` tables using `transaction.client_id`

#### Portal-to-Internal Chat Bridge
- **Bridge Service**: `server/services/portal-chat-bridge.ts` bidirectionally syncs portal messages with the internal live chat system
- **Portal → Chat**: When a portal client sends a message/quote-request/interest, it creates or reuses a `chat_conversations` entry (keyed by `portalClientId` with unique index), adds the appropriate agent(s) as participants, inserts a `chat_messages` row with synthetic senderId `portal-client:{clientId}`, and creates notifications
- **Chat → Portal**: When an agent replies in a portal-linked conversation, `bridgeAgentReplyToPortal()` writes a corresponding `portal_messages` row so the client sees the reply
- **Agent Routing**: Messages from clients with transactions route to the transaction's `user_id` (assigned agent); deal interest or unassigned clients route to all active agents
- **Participant Reconciliation**: On each message, participants are reconciled to the current intended agent set (adds new, removes stale)
- **Frontend**: Portal conversations display with green "PORTAL" badge and emerald-colored message bubbles in the Live Chat section
- **Frontend**: `use-portal-api.ts` hooks use `portalFetch()` with Bearer token auth; 401 auto-redirects to login

#### Web Push Notifications (Portal)
- **Service Worker**: `client/public/portal-sw.js` handles push events and notification clicks (navigates to `/portal/messages`)
- **Backend Service**: `server/services/push-notification.service.ts` manages subscriptions and sends push via `web-push` library
- **VAPID Keys**: Stored in `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` env vars
- **Subscription Flow**: Portal layout auto-registers service worker and subscribes on mount (with permission prompt); logout unsubscribes both client-side and server-side
- **Trigger**: `bridgeAgentReplyToPortal()` in portal-chat-bridge sends push notification to client after writing portal message
- **Security**: Subscribe deletes any existing subscription for same endpoint before inserting (prevents cross-account leakage); unsubscribe enforces clientId ownership

#### Quote Sharing System
- Quotes can be shared via unique 6-char tokens stored in `quote_table.quote_token`
- Public API: `/api/public/quote/:token` (no auth required, registered before auth middleware in `server/index.ts`)
- Authenticated API: `/api/quote-share/:id/...` (generates tokens, views, actions, with ownership checks)
- Public page: `/view-quote/:token` renders `PublicQuotePage` (detected in `App.tsx` before auth check)
- Routes split: `server/routes/quote-public.routes.ts` (public) and `server/routes/quote-share.routes.ts` (authenticated with RBAC)
- Agent share UI: `ShareQuotePanel.tsx` (Copy Link, Email, WhatsApp, SMS, Messenger) and `QuoteEngagement.tsx` (view stats, customer actions)

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