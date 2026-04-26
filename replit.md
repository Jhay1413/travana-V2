# Apple Travel Agency Command Center

## Overview

This project is a full-stack TypeScript CRM application designed for travel agencies. It provides a command center for managing clients, quotes, accommodations, flights, commissions, and notes. Key capabilities include multi-user role support (Admin, Manager, Agent, Homeworker, Referer), a glassmorphism UI, GBP currency formatting, and AI-powered destination intelligence. The business vision is to provide a premium, efficient, and comprehensive tool for travel agents to streamline their operations and enhance client management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query for server state
- **HTTP Client**: Axios with interceptors
- **Styling**: Tailwind CSS v4 with shadcn/ui components (New York style)
- **Animations**: Framer Motion
- **Build Tool**: Vite

The frontend architecture follows an AGENTS.md-compliant structure with distinct API, custom hooks, and type system layers. Key pages include a Command Center dashboard, client management, quote management, ticket management, and an AI-powered Destination Guru. A global search feature allows agents to quickly find information across clients, quotes, and bookings with categorized and color-coded results.

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Style**: RESTful JSON API
- **Build**: esbuild

The backend uses a repository/service/controller pattern and a storage abstraction layer. It supports a transaction-centric database model where a `Transaction` is the central entity linking enquiries, quotes, and bookings.

### Authentication
- **Provider**: Replit Auth (OpenID Connect) for agents, custom PIN/WebAuthn for client portal.
- **Session Storage**: PostgreSQL-backed sessions for agents, JWT tokens for client portal.
- **Features**: User upsert on login, email/password login with bcrypt, forgot/reset password flows.

### Database
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with Zod schema validation
- **Migrations**: Drizzle Kit

The database schema includes tables for users, clients, transactions, quotes, bookings, support tickets, notifications, destination intelligence, feedback, announcements, and a comprehensive SMS notification system. A client portal provides secure access for clients via PIN or biometric login, enabling them to view quotes, bookings, and communicate with agents. A portal-to-internal chat bridge synchronizes client messages with the internal live chat system, and web push notifications alert clients to new messages. A public website API exposes deals and destination information for external consumption.

### Development vs Production
- **Development**: Vite dev server with HMR.
- **Production**: Static file serving, single bundled server file.

## External Dependencies

### Core Services
- **PostgreSQL**: Primary database.
- **Replit Auth**: OpenID Connect provider.
- **Twilio**: SMS notification service (via Replit Connectors).

### Key NPM Packages
- `drizzle-orm` / `drizzle-kit`: ORM and migrations.
- `express`: HTTP server.
- `passport` / `openid-client`: Authentication.
- `@tanstack/react-query`: Async state management.
- `axios`: HTTP client.
- `@radix-ui/*`: Headless UI primitives.
- `framer-motion`: Animation library.
- `zod`: Runtime schema validation.
- `web-push`: Web Push notifications.

### Replit-Specific Integrations
- `@replit/vite-plugin-runtime-error-modal`
- `@replit/vite-plugin-cartographer`
- `@replit/vite-plugin-dev-banner`
- Custom `vite-plugin-meta-images`