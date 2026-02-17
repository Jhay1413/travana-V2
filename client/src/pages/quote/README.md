# Quote Page Refactoring

## Directory Structure

```
client/src/pages/quote/
├── index.tsx                        # Main QuotePage component
├── components/
│   ├── EmojiPicker.tsx              # ✅ Emoji selector widget
│   ├── NoteEditor.tsx               # ✅ Rich text editor for notes  
│   ├── StatusPill.tsx               # ✅ Quote/booking status badge
│   ├── QuoteHeader.tsx              # Header with back, pin, copy, export actions
│   ├── QuoteItinerary.tsx           # Main content: images, details, tags
│   ├── QuoteTasksSection.tsx        # Tasks management section
│   ├── QuoteNotesSection.tsx        # Notes and replies section
│   ├── QuoteSummaryTimeline.tsx     # Travel timeline (flights, hotel, transfer)
│   └── EditQuoteDialog.tsx          # Edit quote/booking dialog
├── hooks/
│   └── useQuoteData.ts              # ✅ Data fetching & transformation
└── utils/
    ├── types.ts                     # ✅ TypeScript type definitions
    ├── constants.ts                 # ✅ Constants (emoji categories, currency)
    ├── formatters.ts                # ✅ Pure formatting functions
    ├── transformers.ts              # ✅ Data transformation functions
    └── index.ts                     # ✅ Barrel export

✅ = Completed
```

## Pattern Overview

This refactoring follows the same pattern as the client page:

### 1. Utils (`utils/`)
Pure functions and type definitions:
- **types.ts**: QuoteDisplay interface and related types
- **constants.ts**: EMOJI_CATEGORIES, currency formatter
- **formatters.ts**: formatUKDate, formatLeadSource, formatRelativeTime, etc.
- **transformers.ts**: transformQuoteData (API → Display format)

### 2. Hooks (`hooks/`)
Data fetching and state management:
- **useQuoteData.ts**: Fetches quote/booking, transforms data, prepares images

### 3. Components (`components/`)
UI components with single responsibilities:
- **Small**: EmojiPicker, StatusPill (< 50 lines)
- **Medium**: NoteEditor (~180 lines), QuoteHeader (~80 lines)
- **Large**: QuoteTasksSection (~220 lines), QuoteNotesSection (~120 lines), QuoteSummaryTimeline (~300 lines), EditQuoteDialog (~200 lines)

### 4. Main Component (`index.tsx`)
Orchestrates everything, handles routing, manages state

## Benefits

1. **Maintainability**: Each file has a single responsibility
2. **Testability**: Components can be tested in isolation
3. **Reusability**: Components work as standalone or embedded
4. **Discoverability**: Clear structure, easy to find code
5. **Collaboration**: Multiple developers can work on different files

## Component Responsibilities

### QuoteHeader
- Back button (to client page)
- Pin/Unpin to dashboard
- Copy quote details
- Export button

### QuoteItinerary
- Hero image with gallery
- Quote title and status
- Travel dates and destination  
- Tags management (add/remove)
- Package details based on type (hotel, cruise, hot tub)

### QuoteTasksSection
- Display pending and completed tasks
- Add new tasks with presets
- Mark tasks as complete/incomplete
- Delete tasks
- Task due dates with overdue indicators

### QuoteNotesSection
- Display hierarchical notes (parent + replies)
- Create new notes with rich text editor
- Edit existing notes
- Reply to notes
- Delete notes

### QuoteSummaryTimeline
- Visual timeline of the trip
- Outbound flight
- Hotel check-in
- Transfers
- Cruise embarkation (if applicable)
- Lodge check-in/out (if applicable)
- Inbound flight

### EditQuoteDialog
- Comprehensive form for editing all quote details
- Package type-specific fields (hotel, cruise, lodge)
- Flight details (outbound/inbound)
- Accommodation details
- Passenger info
- Pricing and commissions

## Usage Example

```tsx
import QuotePage from '@/pages/quote';

// Use as a standalone page (current usage)
<Route path="/clients/:clientId/quotes/:quoteId" component={QuotePage} />
<Route path="/clients/:clientId/bookings/:quoteId" component={() => <QuotePage isBooking={true} />} />

// Or import individual components for embedding
import { QuoteTasksSection, QuoteNotesSection } from '@/pages/quote/components';

<QuoteTasksSection quoteId="123" entityType="quote" />
<QuoteNotesSection transactionId="456" />
```

## Migration Notes

- Original file: 2,388 lines
- Refactored: ~100 lines (index.tsx) + 8-10 component files (~80-300 lines each)
- Zero functional changes - pure refactoring
- All existing tests should continue to work
- All data-testid attributes preserved

## Next Steps

1. ✅ Extract utilities (types, formatters, transformers, constants)
2. ✅ Create useQuoteData hook
3. ✅ Extract small components (EmojiPicker, StatusPill, NoteEditor)
4. 🔄 Extract large components (Tasks, Notes, Timeline, Edit Dialog)
5. 🔄 Create main index.tsx
6. ⏳ Test for errors
7. ⏳ Document component APIs
