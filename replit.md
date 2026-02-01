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
- **Styling**: Tailwind CSS v4 with shadcn/ui component library (New York style)
- **Animations**: Framer Motion for UI transitions
- **Build Tool**: Vite with custom plugins for Replit integration

The frontend follows a page-based structure with shared components. Key pages include:
- Landing page (unauthenticated users)
- Command Center (dashboard)
- Clients list and detail views
- Quote management

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

Schema includes tables for:
- `sessions` - Authentication session storage
- `users` - User accounts with role-based access
- `clients` - Customer records with tier/stage tracking
- `quotes` - Travel quote packages
- `accommodations` - Lodging details per quote
- `flights` - Flight itineraries per quote
- `commissions` - Commission tracking
- `quote_images` - Image attachments for quotes
- `notes` - General notes system

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
- `@radix-ui/*`: Headless UI primitives for shadcn components
- `framer-motion`: Animation library
- `zod`: Runtime schema validation

### Replit-Specific Integrations
- `@replit/vite-plugin-runtime-error-modal`: Error overlay in development
- `@replit/vite-plugin-cartographer`: Development tooling
- `@replit/vite-plugin-dev-banner`: Development environment indicator
- Custom `vite-plugin-meta-images`: OpenGraph image handling for deployments