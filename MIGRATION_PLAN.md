# Travel Agency CRM - Neon Database Migration Plan

## Overview

This document outlines the steps required to migrate from the current Replit PostgreSQL database to an external Neon database, while integrating your existing Drizzle schema and business logic.

**Estimated Timeline:** 3-4 weeks  
**Complexity:** High (50+ tables, 100k+ lines of business logic)

---

## Phase 1: Database Setup (Day 1)

### Step 1.1: Connect Neon Database
- [ ] Navigate to **Tools > Secrets** in Replit
- [ ] Update `DATABASE_URL` with your Neon connection string
- [ ] Format: `postgresql://username:password@hostname/database?sslmode=require`
- [ ] Restart the application to verify connection

### Step 1.2: Schema Compatibility Check
- [ ] Clean up schema formatting (remove markdown artifacts from your schema file)
- [ ] Validate all enum definitions
- [ ] Ensure proper Drizzle ORM syntax for all tables
- [ ] Test schema push to empty Neon database

---

## Phase 2: Authentication Migration (Days 2-3)

### Step 2.1: Replace Custom Auth with Replit Auth

**Tables to Remove (from your schema):**
- `user` (auth user table)
- `session`
- `account`
- `verification`
- `organization`
- `member`
- `invitation`

**Tables to Keep (Replit Auth provides):**
- `users` - Simple user table linked to Replit accounts
- `sessions` - Session management

### Step 2.2: User ID Reference Migration

Your schema has dual user references that need consolidation:

| Current Pattern | Migration Action |
|-----------------|------------------|
| `agent_id: uuid().references(() => usersTable.id)` | Remove - legacy pattern |
| `user_id: text().references(() => user.id)` | Keep - update to reference Replit users |

**Tables Requiring User ID Updates:**
- `transaction`
- `notes`
- `todos`
- `task`
- `ticket`
- `ticket_reply`
- `notification`
- `notification_token`
- `chatParticipant`
- `chatMessage`
- `chatMessageRead`
- `referral`
- `referralRequest`
- `agentTargetTable`
- `booking`
- `enquiry_table`
- `quote`

### Step 2.3: Data Migration Script
- [ ] Create script to map existing `user.id` values to Replit user IDs
- [ ] Update all foreign key references
- [ ] Preserve user roles and permissions

---

## Phase 3: Schema Integration (Days 4-7)

### Step 3.1: Core Tables to Add

#### Client Management
| Table | Purpose |
|-------|---------|
| `clientTable` | Client records with contact info, badges |
| `clientFileTable` | File attachments per client |

#### Transaction Flow (Enquiry → Quote → Booking)
| Table | Purpose |
|-------|---------|
| `transaction` | Central transaction record |
| `enquiry_table` | Initial enquiry details |
| `quote` | Quote with pricing |
| `booking` | Confirmed booking |

#### Booking Sub-tables
| Table | Purpose |
|-------|---------|
| `booking_accomodation` | Accommodation details |
| `booking_flights` | Flight bookings |
| `booking_transfers` | Transfer arrangements |
| `booking_car_hire` | Car rental |
| `booking_attraction_ticket` | Attraction tickets |
| `booking_lounge_pass` | Airport lounge passes |
| `booking_airport_parking` | Parking bookings |
| `booking_cruise` | Cruise bookings |
| `booking_cruise_itinerary` | Cruise itinerary |
| `booking_cruise_item_extra` | Cruise extras |

#### Reference Data Tables
| Table | Purpose |
|-------|---------|
| `country` | Countries list |
| `destination` | Destinations per country |
| `resorts` | Resorts per destination |
| `accomodation_type` | Accommodation types |
| `accomodation_list` | Specific accommodations |
| `airport` | Airports |
| `tour_operator` | Tour operators |
| `package_type` | Holiday package types |
| `tour_package_commission` | Commission rates |
| `board_basis` | Board basis options |
| `room_type` | Room types |

#### Cruise Tables
| Table | Purpose |
|-------|---------|
| `cruise_line` | Cruise lines |
| `cruise_ship` | Ships per cruise line |
| `cruise_itenary` | Cruise itineraries |
| `cruise_voyage` | Voyage details |
| `cruise_destination` | Cruise destinations |
| `port` | Cruise ports |
| `cruise_extra_item` | Extra items |

#### UK Breaks (Lodges/Cottages)
| Table | Purpose |
|-------|---------|
| `park` | Holiday parks |
| `lodges` | Lodges per park |
| `cottages` | Cottages |

#### Tasks & Tickets
| Table | Purpose |
|-------|---------|
| `task` | Tasks/reminders |
| `taskSnooze` | Snoozed tasks |
| `ticket` | Support tickets |
| `ticket_reply` | Ticket replies |
| `ticket_file` | Ticket attachments |
| `ticket_reply_file` | Reply attachments |
| `ticketSnooze` | Snoozed tickets |

#### Notes & Todos
| Table | Purpose |
|-------|---------|
| `notes` | Transaction notes |
| `todos` | Agent to-do items |

#### Chat System
| Table | Purpose |
|-------|---------|
| `chatRoom` | Chat rooms |
| `chatParticipant` | Room participants |
| `chatMessage` | Messages |
| `chatMessageRead` | Read receipts |

#### Referrals
| Table | Purpose |
|-------|---------|
| `referral` | Referral commissions |
| `referralRequest` | Referral requests |

#### Reporting
| Table | Purpose |
|-------|---------|
| `agentTargetTable` | Agent sales targets |
| `forwardsReport` | Commission reports |
| `historicalBooking` | Historical data |
| `headlinesTable` | System announcements |

#### Other
| Table | Purpose |
|-------|---------|
| `deal_images` | Deal images |
| `deletion_codes` | Deletion audit codes |
| `account_request` | Account requests |
| `flights` | Flight reference data |

### Step 3.2: Schema Enums to Add

```typescript
export const bookingStatus = pgEnum('booking_status', ['BOOKED', 'LOST']);
export const chatRoleEnum = pgEnum('chat_role', ['admin', 'member']);
export const messageTypeEnum = pgEnum('message_type', ['text', 'image', 'file', 'system']);
export const chatRoomTypeEnum = pgEnum('chat_room_type', ['direct', 'group']);
export const enquiryStatusEnum = pgEnum('enquiry_status', ['ACTIVE', 'LOST', 'INACTIVE', 'EXPIRED', 'NEW_LEAD']);
export const budgetTypeEnum = pgEnum('budget_type', ['PER_PERSON', 'PACKAGE']);
export const todoStatus = pgEnum('todo_status', ['PENDING', 'DONE']);
export const quoteStatusEnum = pgEnum('quote_status', [
  'NEW_LEAD', 'QUOTE_IN_PROGRESS', 'QUOTE_CALL', 'QUOTE_READY',
  'AWAITING_DECISION', 'REQUOTE', 'WON', 'ARCHIVED', 'LOST', 'INACTIVE', 'EXPIRED'
]);
export const referralStatusEnum = pgEnum('referral_status', ['PENDING', 'APPROVED', 'REJECTED']);
export const releasedStatusEnum = pgEnum('released_status', ['PENDING', 'RELEASED', 'REJECTED']);
export const leadSourceEnum = pgEnum('lead_source', ['SHOP', 'FACEBOOK', 'WHATSAPP', 'INSTAGRAM', 'PHONE_ENQUIRY']);
export const transactionStatusEnum = pgEnum('transaction_status', ['on_quote', 'on_enquiry', 'on_booking']);
export const accountStatusEnum = pgEnum('account_status', ['pending', 'approved', 'rejected']);
export const owner_type_enum = pgEnum('owner_type_enum', ['package_holiday', 'hot_tub_break', 'cruise']);
```

### Step 3.3: Run Schema Push
```bash
npm run db:push
```

---

## Phase 4: API Layer (Days 8-14)

### Step 4.1: Identify Business Logic Components

From your 100k lines, categorise:
- [ ] API route handlers (need Express adaptation)
- [ ] Database query functions (mostly reusable)
- [ ] Business logic utilities (mostly reusable)
- [ ] Frontend components (need React adaptation)

### Step 4.2: Priority API Endpoints

#### Transaction Flow
- [ ] `POST /api/transactions` - Create new transaction
- [ ] `GET /api/transactions/:id` - Get transaction with enquiry/quote/booking
- [ ] `PATCH /api/transactions/:id/status` - Update transaction status

#### Enquiry Management
- [ ] `POST /api/enquiries` - Create enquiry
- [ ] `GET /api/enquiries` - List enquiries with filters
- [ ] `PATCH /api/enquiries/:id` - Update enquiry
- [ ] `POST /api/enquiries/:id/expire` - Expire enquiry

#### Quote Builder
- [ ] `POST /api/quotes` - Create quote from enquiry
- [ ] `GET /api/quotes/:id` - Get quote details
- [ ] `PATCH /api/quotes/:id` - Update quote
- [ ] `POST /api/quotes/:id/duplicate` - Duplicate quote
- [ ] `POST /api/quotes/:id/convert` - Convert to booking

#### Booking Management
- [ ] `POST /api/bookings` - Create booking from quote
- [ ] `GET /api/bookings/:id` - Get booking with all sub-items
- [ ] `PATCH /api/bookings/:id` - Update booking
- [ ] Booking sub-item CRUD (accommodations, flights, transfers, etc.)

#### Client Management
- [ ] `GET /api/clients` - List clients
- [ ] `POST /api/clients` - Create client
- [ ] `GET /api/clients/:id` - Get client with transactions
- [ ] `PATCH /api/clients/:id` - Update client
- [ ] `GET /api/clients/:id/files` - Get client files

#### Tasks & Tickets
- [ ] Task CRUD operations
- [ ] Ticket CRUD with replies
- [ ] Snooze functionality

#### Commission & Reporting
- [ ] Calculate quote commission
- [ ] Calculate booking commission
- [ ] Agent target tracking
- [ ] Forwards report generation

### Step 4.3: Storage Interface Updates

Update `server/storage.ts` with new interfaces:
- [ ] `ITransactionStorage`
- [ ] `IEnquiryStorage`
- [ ] `IQuoteStorage`
- [ ] `IBookingStorage`
- [ ] `ITaskStorage`
- [ ] `ITicketStorage`
- [ ] `IChatStorage`
- [ ] `IReferralStorage`
- [ ] `IReportingStorage`

---

## Phase 5: Frontend Adaptation (Days 15-21)

### Step 5.1: Core Page Updates

| Page | Changes Needed |
|------|----------------|
| Command Center | Add transaction pipeline view |
| Client Detail | Add full transaction history |
| New Quote | Integrate with enquiry flow |
| Booking View | Full booking management |
| Tasks | Task list with snooze |
| Tickets | Ticket system with replies |
| Reports | Commission and target dashboards |

### Step 5.2: New Components Needed

- [ ] Transaction pipeline board
- [ ] Enquiry form (multi-step)
- [ ] Quote builder (with pricing calculator)
- [ ] Booking editor (with all sub-items)
- [ ] Passenger management
- [ ] Flight selector
- [ ] Accommodation selector
- [ ] Commission calculator display
- [ ] Chat interface
- [ ] Referral management

---

## Phase 6: Testing & Deployment (Days 22-28)

### Step 6.1: Testing Checklist
- [ ] Authentication flow with Replit Auth
- [ ] Full transaction lifecycle (enquiry → quote → booking)
- [ ] Commission calculations accuracy
- [ ] All CRUD operations
- [ ] File uploads
- [ ] Chat functionality
- [ ] Notification system

### Step 6.2: Data Migration
- [ ] Export existing data from old system
- [ ] Transform to match new schema
- [ ] Import into Neon database
- [ ] Verify data integrity

### Step 6.3: Deployment
- [ ] Final testing in production environment
- [ ] DNS/domain configuration
- [ ] Publish via Replit

---

## Key Decisions Required

Before starting, confirm:

1. **Current Stack**
   - What framework are you using? (Next.js, React, etc.)
   - What backend framework? (Express, Hono, etc.)

2. **Business Logic Files**
   - Share key calculation functions (quote pricing, commission)
   - Share API route handlers for reference

3. **Data Migration**
   - Do you have existing data to migrate?
   - What format is it in?

4. **Priority Features**
   - What features must work first?
   - What can be deferred?

---

## Notes

- Your schema has some typos to fix: `surename` should be `surname`
- Dual user reference pattern (`agent_id` + `user_id`) should be consolidated
- Some tables have `user_id_v2` indicating an ongoing migration - decide which to keep

---

*Document created: February 2026*
