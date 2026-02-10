You are assisting with a travel agency management system built with Drizzle ORM and PostgreSQL. Below is the complete database schema with all fields. Refer to this when answering any questions about the system.

---

## CORE ENTITY: Transaction

**transaction**
- id: UUID (PK, auto-generated)
- status: enum ('on_enquiry' | 'on_quote' | 'on_booking')
- is_active: boolean (default true)
- client_id: UUID → client.id
- holiday_type_id: UUID → package_type.id
- agent_id: UUID → usersTable.id
- lead_source: enum ('SHOP' | 'FACEBOOK' | 'WHATSAPP' | 'INSTAGRAM' | 'PHONE_ENQUIRY'), default 'SHOP'
- user_id: text → user.id (NOT NULL)
- created_at: timestamp (NOT NULL, default now)

### Relationships:
- 1:1 → enquiry (via enquiry.transaction_id UNIQUE)
- 1:N → quotes (via quote.transaction_id, NOT unique)
- 1:1 → booking (via booking.transaction_id UNIQUE)
- 1:N → notes, tasks, referrals

---

## ENQUIRY (1:1 with transaction)

**enquiry_table**
- id: UUID (PK)
- transaction_id: UUID → transaction.id (UNIQUE, CASCADE, NOT NULL)
- holiday_type_id: UUID → package_type.id (NOT NULL)
- accomodation_type_id: UUID → accomodation_type.id
- travel_date: date (string mode)
- adults: integer
- children: integer
- infants: integer
- cabin_type: varchar
- title: varchar
- flexibility_date: varchar
- flexible_date: varchar
- weekend_lodge: varchar
- accom_min_star_rating: varchar
- no_of_nights: integer
- budget: numeric
- max_budget: numeric (default '0.00')
- budget_type: enum ('PER_PERSON' | 'PACKAGE'), default 'PACKAGE'
- no_of_guests: integer
- no_of_pets: integer
- pre_cruise_stay: integer
- post_cruise_stay: integer
- status: enum ('NEW_LEAD' | 'ACTIVE' | 'LOST' | 'INACTIVE' | 'EXPIRED'), default 'NEW_LEAD'
- date_created: timestamp with timezone (default now)
- date_expiry: timestamp with timezone
- is_future_deal: boolean (default false)
- future_deal_date: date (string mode)
- is_expired: boolean (default false)
- is_active: boolean (default true)
- deletion_code: varchar
- deleted_by: UUID → usersTable.id
- deleted_at: timestamp with timezone
- email: varchar

**enquiry_destination**
- destination_id: UUID → destination.id
- enquiry_id: UUID → enquiry_table.id (CASCADE)

**enquiry_resorts**
- resorts_id: UUID → resorts.id
- enquiry_id: UUID → enquiry_table.id (CASCADE)

**enquiry_accomodation**
- accomodation_id: UUID → accomodation_list.id
- enquiry_id: UUID → enquiry_table.id (CASCADE)

**enquiry_board_basis**
- enquiry_id: UUID → enquiry_table.id (CASCADE)
- board_basis_id: UUID → board_basis.id

**enquiry_departure_airport**
- airport_id: UUID → airport.id
- enquiry_id: UUID → enquiry_table.id (CASCADE)

**enquiry_departure_port**
- port_id: UUID → port.id
- enquiry_id: UUID → enquiry_table.id (CASCADE)

**enquiry_cruise_line**
- cruise_line_id: UUID → cruise_line.id
- enquiry_id: UUID → enquiry_table.id (CASCADE)

**enquiry_cruise_destination**
- enquiry_id: UUID → enquiry_table.id (CASCADE)
- cruise_destination_id: UUID → cruise_destination.id

**enquiry_passenger**
- id: UUID (PK)
- enquiry_id: UUID → enquiry_table.id (CASCADE)
- type: varchar ('ADULT' | 'CHILD' | 'INFANT')
- age: integer

---

## QUOTE (many per transaction)

**quote**
- id: UUID (PK)
- transaction_id: UUID → transaction.id (CASCADE, NOT NULL)
- deal_id: varchar
- holiday_type_id: UUID → package_type.id (NOT NULL)
- sales_price: numeric(10,2)
- package_commission: numeric(10,2)
- travel_date: date (NOT NULL)
- discounts: numeric(10,2)
- service_charge: numeric(10,2)
- num_of_nights: integer (NOT NULL, default 0)
- pets: integer (NOT NULL, default 0)
- cottage_id: UUID → cottages.id
- lodge_id: UUID → lodges.id
- quote_type: varchar (NOT NULL)
- deal_type: varchar
- pre_booked_seats: varchar
- flight_meals: boolean (default false)
- infant: integer
- child: integer
- adult: integer
- title: varchar
- price_per_person: numeric(10,2) (NOT NULL, default '0.00')
- lodge_type: varchar
- transfer_type: varchar (NOT NULL, default 'none')
- quote_status: enum ('NEW_LEAD' | 'QUOTE_IN_PROGRESS' | 'QUOTE_CALL' | 'QUOTE_READY' | 'AWAITING_DECISION' | 'REQUOTE' | 'WON' | 'ARCHIVED' | 'LOST' | 'INACTIVE' | 'EXPIRED')
- main_tour_operator_id: UUID → tour_operator.id
- date_created: timestamp with timezone (default now)
- date_expiry: timestamp with timezone
- is_future_deal: boolean (default false)
- future_deal_date: date (string mode)
- is_active: boolean (default true)
- deletion_code: varchar
- deleted_by: UUID → usersTable.id
- deleted_by_v2: text → user.id
- deleted_at: timestamp with timezone
- quote_ref: varchar
- isQuoteCopy: boolean (default false)
- isFreeQuote: boolean (default false)

**quote_flights**
- id: UUID (PK)
- quote_id: UUID → quote.id (CASCADE)
- flight_number: varchar
- flight_ref: varchar
- departing_airport_id: UUID → airport.id
- arrival_airport_id: UUID → airport.id
- tour_operator_id: UUID → tour_operator.id
- flight_type: varchar
- departure_date_time: timestamp
- arrival_date_time: timestamp
- is_included_in_package: boolean
- cost: numeric(10,2)
- commission: numeric(10,2)

**quote_accomodation**
- id: UUID (PK)
- booking_ref: varchar
- tour_operator_id: UUID → tour_operator.id
- no_of_nights: integer (NOT NULL, default 0)
- room_type: varchar
- board_basis_id: UUID → board_basis.id
- check_in_date_time: timestamp(6) with timezone
- stay_type: varchar
- is_primary: boolean (default false)
- is_included_in_package: boolean
- cost: numeric(10,2)
- commission: numeric(10,2)
- accomodation_id: UUID → accomodation_list.id
- quote_id: UUID → quote.id (CASCADE)

**quote_transfers**
- id: UUID (PK)
- booking_ref: varchar
- tour_operator_id: UUID → tour_operator.id
- pick_up_location: varchar
- drop_off_location: varchar
- pick_up_time: timestamp
- drop_off_time: timestamp
- is_included_in_package: boolean
- cost: numeric(10,2)
- commission: numeric(10,2)
- quote_id: UUID → quote.id (CASCADE)
- note: varchar

**quote_car_hire**
- id: UUID (PK)
- quote_id: UUID → quote.id (CASCADE)
- booking_ref: varchar
- tour_operator_id: UUID → tour_operator.id
- pick_up_location: varchar
- drop_off_location: varchar
- pick_up_time: timestamp
- drop_off_time: timestamp
- no_of_days: integer (NOT NULL, default 0)
- driver_age: integer (NOT NULL, default 0)
- is_included_in_package: boolean
- cost: numeric(10,2)
- commission: numeric(10,2)

**quote_attraction_ticket**
- id: UUID (PK)
- quote_id: UUID → quote.id (CASCADE)
- booking_ref: varchar
- tour_operator_id: UUID → tour_operator.id
- ticket_type: varchar
- date_of_visit: timestamp
- cost: numeric(10,2)
- commission: numeric(10,2)
- number_of_tickets: integer (NOT NULL, default 0)
- is_included_in_package: boolean

**quote_lounge_pass**
- id: UUID (PK)
- quote_id: UUID → quote.id (CASCADE)
- booking_ref: varchar
- terminal: varchar
- airport_id: UUID → airport.id
- date_of_usage: timestamp
- tour_operator_id: UUID → tour_operator.id
- cost: numeric(10,2)
- commission: numeric(10,2)
- is_included_in_package: boolean
- note: varchar

**quote_airport_parking**
- id: UUID (PK)
- booking_ref: varchar
- quote_id: UUID → quote.id (CASCADE)
- airport_id: UUID → airport.id
- parking_type: varchar
- parking_date: timestamp
- car_make: varchar
- car_model: varchar
- colour: varchar
- car_reg_number: varchar
- duration: varchar
- tour_operator_id: UUID → tour_operator.id
- is_included_in_package: boolean
- cost: numeric(10,2)
- commission: numeric(10,2)

**quote_cruise**
- id: UUID (PK)
- tour_operator_id: UUID → tour_operator.id
- cruise_line: varchar
- ship: varchar
- cruise_date: date
- cabin_type: varchar
- cruise_name: varchar
- pre_cruise_stay: integer (NOT NULL)
- post_cruise_stay: integer (NOT NULL)
- quote_id: UUID → quote.id (CASCADE)

**quote_cruise_item_extra**
- id: UUID (PK)
- cruise_extra_id: UUID → cruise_extra_item.id
- quote_cruise_id: UUID → quote_cruise.id (CASCADE)

**quote_cruise_itinerary**
- id: UUID (PK)
- quote_cruise_id: UUID → quote_cruise.id (CASCADE)
- day_number: integer
- description: varchar

**passengers**
- id: UUID (PK)
- type: varchar
- age: integer (NOT NULL, default 0)
- quote_id: UUID → quote.id (CASCADE)
- lounge_pass_id: UUID → quote_lounge_pass.id (CASCADE)
- booking_id: UUID → booking.id (CASCADE)

**travel_deal**
- id: UUID (PK)
- title: varchar (NOT NULL)
- subtitle: varchar
- post: text (NOT NULL)
- resortSummary: varchar
- hashtags: text[] (NOT NULL, default empty array)
- travelDate: date (string mode)
- nights: integer (NOT NULL)
- boardBasis: varchar
- departureAirport: varchar
- postSchedule: timestamp with timezone
- onlySocialsId: varchar
- luggageTransfers: varchar
- price: numeric(10,2)
- quote_id: UUID → quote.id (CASCADE, NOT NULL)
- created_at: timestamp with timezone (default now)

---

## BOOKING (1:1 with transaction)

**booking**
- id: UUID (PK)
- transaction_id: UUID → transaction.id (UNIQUE, CASCADE, NOT NULL)
- deal_type: varchar
- pre_booked_seats: varchar
- flight_meals: boolean (default false)
- holiday_type_id: UUID → package_type.id (NOT NULL)
- hays_ref: varchar (NOT NULL)
- supplier_ref: varchar (NOT NULL)
- is_active: boolean (default true)
- sales_price: numeric(10,2)
- package_commission: numeric(10,2)
- travel_date: date (NOT NULL)
- title: varchar
- discounts: numeric(10,2)
- service_charge: numeric(10,2)
- num_of_nights: integer (NOT NULL, default 0)
- pets: integer (NOT NULL, default 0)
- cottage_id: UUID → cottages.id
- lodge_id: UUID → lodges.id
- lodge_type: varchar
- transfer_type: varchar
- infant: integer (NOT NULL, default 0)
- child: integer (NOT NULL, default 0)
- adult: integer (NOT NULL, default 0)
- booking_status: enum ('BOOKED' | 'LOST')
- main_tour_operator_id: UUID → tour_operator.id
- date_created: timestamp with timezone (default now)
- deletion_code: varchar
- deleted_by: UUID → usersTable.id
- deleted_by_user: text → user.id
- deleted_at: timestamp with timezone (default now)

**booking_flights**
- id: UUID (PK)
- booking_id: UUID → booking.id (CASCADE)
- flight_number: varchar
- flight_ref: varchar
- departing_airport_id: UUID → airport.id
- arrival_airport_id: UUID → airport.id
- tour_operator_id: UUID → tour_operator.id
- flight_type: varchar
- departure_date_time: timestamp
- arrival_date_time: timestamp
- is_included_in_package: boolean
- cost: numeric(10,2)
- commission: numeric(10,2)

**booking_accomodation**
- id: UUID (PK)
- booking_ref: varchar
- tour_operator_id: UUID → tour_operator.id
- no_of_nights: integer (NOT NULL, default 0)
- room_type: varchar
- board_basis_id: UUID → board_basis.id
- check_in_date_time: timestamp
- stay_type: varchar
- is_primary: boolean (default false)
- is_included_in_package: boolean
- cost: numeric(10,2)
- commission: numeric(10,2)
- accomodation_id: UUID → accomodation_list.id
- booking_id: UUID → booking.id (CASCADE)

**booking_transfers**
- id: UUID (PK)
- booking_ref: varchar
- tour_operator_id: UUID → tour_operator.id
- pick_up_location: varchar
- drop_off_location: varchar
- pick_up_time: timestamp
- drop_off_time: timestamp
- is_included_in_package: boolean
- cost: numeric(10,2)
- commission: numeric(10,2)
- booking_id: UUID → booking.id (CASCADE)
- note: varchar

**booking_car_hire**
- id: UUID (PK)
- booking_id: UUID → booking.id (CASCADE)
- booking_ref: varchar
- tour_operator_id: UUID → tour_operator.id
- pick_up_location: varchar
- drop_off_location: varchar
- pick_up_time: timestamp
- drop_off_time: timestamp
- no_of_days: integer
- driver_age: integer
- is_included_in_package: boolean
- cost: numeric(10,2)
- commission: numeric(10,2)

**booking_attraction_ticket**
- id: UUID (PK)
- booking_id: UUID → booking.id (CASCADE)
- booking_ref: varchar
- tour_operator_id: UUID → tour_operator.id
- ticket_type: varchar
- date_of_visit: timestamp
- cost: numeric(10,2)
- commission: numeric(10,2)
- number_of_tickets: integer
- is_included_in_package: boolean

**booking_lounge_pass**
- id: UUID (PK)
- booking_id: UUID → booking.id (CASCADE)
- booking_ref: varchar
- terminal: varchar
- airport_id: UUID → airport.id
- date_of_usage: timestamp
- tour_operator_id: UUID → tour_operator.id
- cost: numeric(10,2)
- commission: numeric(10,2)
- is_included_in_package: boolean
- note: varchar

**booking_airport_parking**
- id: UUID (PK)
- booking_ref: varchar
- booking_id: UUID → booking.id (CASCADE)
- airport_id: UUID → airport.id
- parking_type: varchar
- parking_date: timestamp
- car_make: varchar
- car_model: varchar
- colour: varchar
- car_reg_number: varchar
- duration: varchar
- tour_operator_id: UUID → tour_operator.id
- is_included_in_package: boolean
- cost: numeric(10,2)
- commission: numeric(10,2)

**booking_cruise**
- id: UUID (PK)
- booking_id: UUID → booking.id (CASCADE)
- tour_operator_id: UUID → tour_operator.id
- cruise_line: varchar
- ship: varchar
- cruise_date: date
- cabin_type: varchar
- cruise_name: varchar
- pre_cruise_stay: integer
- post_cruise_stay: integer

**booking_cruise_item_extra**
- id: UUID (PK)
- cruise_extra_id: UUID → cruise_extra_item.id
- booking_cruise_id: UUID → booking_cruise.id (CASCADE)

**booking_cruise_itinerary**
- id: UUID (PK)
- booking_cruise_id: UUID → booking_cruise.id (CASCADE)
- day_number: integer
- description: varchar

---

## TRANSACTION-LEVEL CHILDREN

**notes**
- id: UUID (PK)
- description: varchar
- content: text
- agent_id: UUID → usersTable.id
- user_id: text → user.id
- createdAt: timestamp (string mode, NOT NULL, default now)
- parent_id: varchar
- transaction_id: UUID → transaction.id (CASCADE)

**task**
- id: UUID (PK)
- agent_id: UUID → usersTable.id (SET NULL on delete)
- user_id: text → user.id (SET NULL on delete)
- client_id: UUID → client.id (SET NULL on delete)
- assigned_by_id: UUID → usersTable.id (SET NULL on delete)
- assigned_by_id_v2: text → user.id (SET NULL on delete)
- transaction_id: UUID → transaction.id (CASCADE)
- deal_id: varchar
- transaction_type: varchar
- title: varchar
- type: varchar (default 'task')
- task: varchar
- due_date: timestamp
- number: varchar
- priority: varchar
- status: varchar
- created_at: timestamp (string mode, NOT NULL, default now)

**referral**
- id: UUID (PK)
- referrerId: text → user.id (SET NULL on delete)
- transactionId: UUID → transaction.id (CASCADE)
- referralStatus: enum ('PENDING' | 'RELEASED' | 'REJECTED'), default 'PENDING'
- potentialCommission: numeric
- commission: numeric
- createdAt: timestamp (default now)
- updatedAt: timestamp (default now)

---

## REFERENCE / LOOKUP TABLES

**user** (auth)
- id: text (PK)
- name: text (NOT NULL)
- email: text (NOT NULL, UNIQUE)
- emailVerified: boolean (NOT NULL, default false)
- image: text
- createdAt: timestamp (NOT NULL, default now)
- updatedAt: timestamp (NOT NULL, default now)
- role: text (NOT NULL)
- banned: boolean (default false)
- banReason: text
- banExpires: timestamp
- firstName: text (NOT NULL)
- lastName: text (NOT NULL)
- phoneNumber: text (NOT NULL)
- orgName: text
- percentageCommission: integer

**client**
- id: UUID (PK)
- title: varchar
- firstName: varchar (NOT NULL)
- surename: varchar (NOT NULL)
- DOB: date (string mode)
- phoneNumber: varchar (NOT NULL)
- email: varchar
- emailIsAllowed: boolean
- VMB: varchar
- VMBfirstAccess: varchar
- whatsAppVerified: boolean (NOT NULL, default false)
- mailAllowed: boolean (default false)
- houseNumber: varchar
- city: varchar
- street: varchar
- country: varchar
- post_code: varchar
- avatarUrl: varchar
- badge: varchar
- createdAt: timestamp (NOT NULL, default now)
- referrerId: text → user.id (SET NULL on delete)

**package_type**
- id: UUID (PK)
- name: varchar (NOT NULL)

**tour_operator**
- id: UUID (PK)
- name: varchar

**tour_package_commission** (composite PK)
- package_type_id: UUID → package_type.id
- tour_operator_id: UUID → tour_operator.id
- percentage_commission: decimal(5,2)

**board_basis**
- id: UUID (PK)
- type: varchar (NOT NULL)

**accomodation_type**
- id: UUID (PK)
- type: varchar

**accomodation_list**
- id: UUID (PK)
- type_id: UUID → accomodation_type.id
- name: varchar (NOT NULL)
- resorts_id: UUID → resorts.id
- description: varchar

**country**
- id: UUID (PK)
- country_name: varchar (NOT NULL)
- country_code: varchar

**destination**
- id: UUID (PK)
- name: varchar (NOT NULL)
- type: varchar
- country_id: UUID → country.id

**resorts**
- id: UUID (PK)
- name: varchar (NOT NULL)
- destination_id: UUID → destination.id

**airport**
- id: UUID (PK)
- airport_code: varchar (NOT NULL)
- airport_name: varchar (NOT NULL)
- country_id: UUID → country.id

**park**
- id: UUID (PK)
- name: varchar
- image_1: varchar
- image_2: varchar
- location: varchar
- city: varchar
- county: varchar
- code: varchar
- description: varchar

**lodges**
- id: UUID (PK)
- park_id: UUID → park.id
- lodge_name: varchar
- lodge_code: varchar (indexed)
- image: varchar
- adults: integer
- children: integer
- bedrooms: integer
- bathrooms: integer
- pets: integer
- sleeps: integer
- infants: integer

**cottages**
- id: UUID (PK)
- cottage_name: varchar
- location: varchar
- cottage_code: varchar
- bedrooms: integer
- bathrooms: integer
- sleeps: integer
- pets: integer
- image_1: varchar
- image_2: varchar
- details_url: varchar

**cruise_line**
- id: UUID (PK)
- name: varchar

**cruise_ship**
- id: UUID (PK)
- name: varchar
- cruise_line_id: UUID → cruise_line.id (CASCADE)

**cruise_itenary**
- id: UUID (PK)
- ship_id: UUID → cruise_ship.id (CASCADE)
- itenary: varchar
- departure_port: varchar (NOT NULL)
- date: date (NOT NULL)

**cruise_voyage**
- id: UUID (PK)
- itinerary_id: UUID → cruise_itenary.id (CASCADE)
- day_number: numeric
- description: varchar

**cruise_destination**
- id: UUID (PK)
- name: varchar

**port**
- id: UUID (PK)
- cruise_destination_id: UUID → cruise_destination.id
- name: varchar

**cruise_extra_item**
- id: UUID (PK)
- name: varchar

**room_type**
- id: UUID (PK)
- name: varchar

**deletion_codes**
- id: UUID (PK)
- is_used: boolean (default false)
- code: varchar
- created_at: timestamp (NOT NULL, default now)

**deal_images**
- id: UUID (PK)
- image_url: varchar
- s3Key: varchar
- owner_type: enum ('package_holiday' | 'hot_tub_break' | 'cruise')
- owner_id: text (NOT NULL)
- isPrimary: boolean (default false)
- UNIQUE constraint on (owner_id, image_url)

**forwardsReport**
- id: UUID (PK)
- month: integer (NOT NULL)
- monthName: varchar (NOT NULL)
- year: integer (NOT NULL)
- target: numeric(10,2) (NOT NULL)
- company_commission: numeric(10,2) (NOT NULL)
- agent_commission: numeric(10,2) (NOT NULL)
- created_at: timestamp (NOT NULL, default now)
- adjustment: numeric(10,2) (default '0.00')
- deal_ids: text[] (NOT NULL, default empty array)
- historical_ids: text[] (NOT NULL, default empty array)
- UNIQUE constraint on (year, month)

**referral_request**
- id: UUID (PK)
- referrerId: text → user.id (CASCADE)
- referredStatus: enum ('PENDING' | 'APPROVED' | 'REJECTED'), default 'PENDING'
- notes: varchar
- createdAt: timestamp (default now)
- updatedAt: timestamp (default now)
- clientId: UUID → client.id (CASCADE)

---

## VISUAL RELATIONSHIP MAP

```
Transaction
├── 1:1 → Enquiry
│         ├── many → enquiry_destination
│         ├── many → enquiry_resorts
│         ├── many → enquiry_accomodation
│         ├── many → enquiry_board_basis
│         ├── many → enquiry_departure_airport
│         ├── many → enquiry_departure_port
│         ├── many → enquiry_cruise_line
│         ├── many → enquiry_cruise_destination
│         └── many → enquiry_passenger
│
├── 1:N → Quotes
│         ├── many → quote_flights
│         ├── many → quote_accomodation
│         ├── many → quote_transfers
│         ├── many → quote_car_hire
│         ├── many → quote_attraction_ticket
│         ├── many → quote_lounge_pass
│         ├── many → quote_airport_parking
│         ├── 1:1  → quote_cruise
│         │         ├── many → quote_cruise_item_extra
│         │         └── many → quote_cruise_itinerary
│         ├── many → passengers
│         └── 1:1  → travel_deal
│
├── 1:1 → Booking
│         ├── many → booking_flights
│         ├── many → booking_accomodation
│         ├── many → booking_transfers
│         ├── many → booking_car_hire
│         ├── many → booking_attraction_ticket
│         ├── many → booking_lounge_pass
│         ├── many → booking_airport_parking
│         ├── 1:1  → booking_cruise
│         │         ├── many → booking_cruise_item_extra
│         │         └── many → booking_cruise_itinerary
│         └── many → passengers
│
├── many → Notes
├── many → Tasks
└── many → Referrals
```

All child tables cascade-delete from their parent.
The transaction lifecycle flows: on_enquiry → on_quote → on_booking.
All monetary fields use numeric(10,2).
All IDs are UUIDs auto-generated via gen_random_uuid() unless otherwise noted.
Passengers can link to EITHER a quote OR a booking, never both simultaneously.
