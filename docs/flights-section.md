# FlightsSection — Logic & Data Reference

## Data Shape

Each item in the `flights` array:

```ts
{
  flightType: string | null;        // "outbound" | "inbound"
  flightNumber: string | null;      // e.g. "LS123" — optional, shown as badge
  departingAirport: string;         // departure airport name, e.g. "Manchester Intl"
  arrivalAirport: string;           // arrival airport name, e.g. "Alicante"
  departureDateTime: string | null; // ISO string e.g. "2026-05-01T19:10:00.000Z"
  arrivalDateTime: string | null;   // ISO string e.g. "2026-05-01T22:55:00.000Z"
  airline: string;                  // airline name (available but not currently rendered)
  legOrder: number | null;          // 0-based sort index within outbound/inbound group
}
```

### Minimal valid leg

```ts
{
  flightType: "outbound",
  flightNumber: null,
  departingAirport: "Manchester Intl",
  arrivalAirport: "Alicante",
  departureDateTime: "2026-05-01T19:10:00.000Z",
  arrivalDateTime: "2026-05-01T22:55:00.000Z",
  airline: "",
  legOrder: 0,
}
```

---

## Splitting Logic

Legs are split into two groups by `flightType`, then sorted by `legOrder`:

```ts
const outboundLegs = flights
  .filter(f => f.flightType === "outbound")
  .sort((a, b) => (a.legOrder || 0) - (b.legOrder || 0));

const inboundLegs = flights
  .filter(f => f.flightType === "inbound")
  .sort((a, b) => (a.legOrder || 0) - (b.legOrder || 0));
```

Each group is rendered as a **journey card** (blue for outbound, purple for inbound).

### Connecting flights

When a journey has `legs.length > 1`, each leg after index 0 is a connecting flight. A dashed "Connecting" divider is rendered between legs.

| `i` | Label |
|-----|-------|
| 0 | "Outbound Flight" / "Return Flight" |
| 1+ | "Connecting Flight 2", "Connecting Flight 3", … |

A pill badge (`{n} legs`) appears in the journey header when `legs.length > 1`.

---

## Time Rendering

### `formatDate(dateStr)`

Extracts the **date part only** (`YYYY-MM-DD`) from the ISO string, then formats via `en-GB` locale:

```ts
// "2026-05-01T19:10:00.000Z" → "1 May 2026"
const datePart = dateStr.substring(0, 10);           // "2026-05-01"
const [year, month, day] = datePart.split("-").map(Number);
const d = new Date(year, month - 1, day);            // local date, no UTC shift
return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
```

> **Why local date construction?** `new Date("2026-05-01T19:10:00.000Z")` is parsed as UTC and can shift the displayed date for users in timezones behind UTC (e.g. US). Using `new Date(year, month-1, day)` keeps the date as-is regardless of the viewer's timezone.

### `formatTime(dateTimeStr)`

Slices the time portion directly from the ISO string — **no Date object involved**:

```ts
// "2026-05-01T19:10:00.000Z" → "19:10"
const tIdx = dateTimeStr.indexOf("T");
return dateTimeStr.substring(tIdx + 1).substring(0, 5);
```

Returns `""` if there is no `T` in the string (date-only values).

---

## Per-Leg Rendering

Each leg displays three columns:

```
[Departing airport]   ✈  [Arriving airport]
[Date]           [flight no]        [Date]
[Time]                              [Time]

```

- Airport names fall back to `"TBC"` if empty.
- `flightNumber` is only shown when truthy.
- Date and time are rendered as two separate lines under each airport.

---

## Component Entry Point

```tsx
<FlightsSection flights={quote.flights} />
```

Returns `null` when `flights.length === 0` (section is hidden entirely for hot tub breaks and other non-flight quotes).

---

## API Response Example (Costa Blanca deal)

```json
"flightLegs": [
  {
    "legOrder": 0,
    "departureAirport": "Manchester Intl",
    "arrivalAirport": "Alicante",
    "departureDateTime": "2026-05-01T19:10:00.000Z",
    "arrivalDateTime": "2026-05-01T22:55:00.000Z"
  },
  {
    "legOrder": 0,
    "departureAirport": "Alicante",
    "arrivalAirport": "Manchester Intl",
    "departureDateTime": "2026-05-04T21:45:00.000Z",
    "arrivalDateTime": "2026-05-04T23:40:00.000Z"
  }
]
```

> Note: the public deals API (`/api/public/website/deals/:id`) returns `flightLegs` with camelCase field names (`departureAirport`, `arrivalAirport`). The public quote API (`/api/public/quote/:token`) returns them under `flights` with `departingAirport`, `arrivalAirport`, `flightType`, and `legOrder` as shown in the type above.

---

## Mapping Deals API `flightLegs` → `FlightsSection`

### The problem: two mismatches

The deals API shape and the `FlightsSection` expected shape differ in two ways:

| | Deals API (`flightLegs`) | FlightsSection (`flights`) |
|---|---|---|
| Direction field | **missing** — no `flightType` | **required** — `"outbound"` \| `"inbound"` |
| Departure field name | `departureAirport` | `departingAirport` |

Without `flightType`, `FlightsSection` filters both legs out of both groups and renders nothing.

### Deals API response (Costa Blanca)

```json
"flightLegs": [
  {
    "legOrder": 0,
    "departureAirport": "Manchester Intl",
    "arrivalAirport": "Alicante",
    "departureDateTime": "2026-05-01T19:10:00.000Z",
    "arrivalDateTime": "2026-05-01T22:55:00.000Z"
  },
  {
    "legOrder": 0,
    "departureAirport": "Alicante",
    "arrivalAirport": "Manchester Intl",
    "departureDateTime": "2026-05-04T21:45:00.000Z",
    "arrivalDateTime": "2026-05-04T23:40:00.000Z"
  }
]
```

Both legs have `legOrder: 0` and no `flightType`. Direction must be inferred by **array position** — the server always writes outbound legs first, inbound legs second, with each direction resetting `legOrder` to 0.

### Transform function

```ts
const flights = deal.flightLegs.map((leg, i, arr) => ({
  flightType: i < arr.length / 2 ? "outbound" : "inbound",
  departingAirport: leg.departureAirport,  // rename
  arrivalAirport: leg.arrivalAirport,
  departureDateTime: leg.departureDateTime,
  arrivalDateTime: leg.arrivalDateTime,
  flightNumber: null,
  airline: "",
  legOrder: leg.legOrder,
}));
```

### What FlightsSection renders after transform

```
FlightsSection splits by flightType:

outboundLegs = [{ departingAirport: "Manchester Intl", arrivalAirport: "Alicante", legOrder: 0 }]
inboundLegs  = [{ departingAirport: "Alicante", arrivalAirport: "Manchester Intl", legOrder: 0 }]

┌─ ✈ Outbound Journey ──────────────────────────────┐
│  Manchester Intl          ✈          Alicante      │
│  1 May 2026                          1 May 2026    │
│  19:10                               22:55         │
└────────────────────────────────────────────────────┘

┌─ ✈ Return Journey ────────────────────────────────┐
│  Alicante                 ✈   Manchester Intl      │
│  4 May 2026                          4 May 2026    │
│  21:45                               23:40         │
└────────────────────────────────────────────────────┘
```

### Connecting flight example (3 total legs: 2 outbound, 1 inbound)

```ts
// Input: 3 legs → arr.length / 2 = 1.5
// i=0 → 0 < 1.5 → "outbound", legOrder 0  (first outbound leg)
// i=1 → 1 < 1.5 → "outbound", legOrder 1  (connecting)
// i=2 → 2 < 1.5 → "inbound",  legOrder 0  (return flight)
```

```
┌─ ✈ Outbound Journey  [2 legs] ────────────────────┐
│  Manchester  ✈  Amsterdam                          │
│  ·············· Connecting ···············         │
│  Amsterdam   ✈  Alicante                           │
└────────────────────────────────────────────────────┘

┌─ ✈ Return Journey ────────────────────────────────┐
│  Alicante    ✈  Manchester                         │
└────────────────────────────────────────────────────┘
```

### formatTime detail

Time is sliced directly from the ISO string — no `Date` object, no timezone conversion:

```
"2026-05-01T19:10:00.000Z"
            ↑
            T found at index 10
            substring(11, 16) → "19:10"
```

### formatDate detail

Date is constructed using the local `Date` constructor to prevent UTC timezone shift:

```
"2026-05-01T19:10:00.000Z"
 ↑
 datePart = "2026-05-01"
 new Date(2026, 4, 1)  ← month is 0-indexed
 → "1 May 2026"  (en-GB locale)
```

Using `new Date("2026-05-01T19:10:00.000Z")` instead would shift the date for
users in UTC− timezones (e.g. a US viewer would see "30 Apr 2026").
