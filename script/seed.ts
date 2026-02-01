import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  users,
  clients,
  quotes,
  accommodations,
  flights,
  commissions,
  quoteImages,
  notes,
} from "../shared/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function seed() {
  console.log("🌱 Seeding database...");

  // Create users
  const [user1, user2, user3] = await db.insert(users).values([
    {
      name: "Sophie Turner",
      email: "sophie.turner@example.com",
      role: "Agent",
      avatar: "/attached_assets/Avatar3_1769960371403.png",
    },
    {
      name: "Amelia Brooks",
      email: "amelia.brooks@example.com",
      role: "Homeworker",
      avatar: "/attached_assets/Avatar3_1769960371403.png",
    },
    {
      name: "Oliver Hayes",
      email: "oliver.hayes@example.com",
      role: "Manager",
      avatar: "/attached_assets/Avatar3_1769960371403.png",
    },
  ]).returning();

  console.log("✅ Users created");

  // Create clients
  const [client1, client2, client3] = await db.insert(clients).values([
    {
      name: "Ava Harrington",
      email: "ava.harrington@example.com",
      phone: "+44 20 7946 0821",
      tier: "Platinum",
      stage: "Booked",
      location: "Kensington, London",
      nextTrip: "Maldives · 9 nights · Overwater villa",
      value: "18450",
      lastTouch: "Today",
      tags: ["Honeymoon", "VIP", "WhatsApp"],
      userId: user1.id,
    },
    {
      name: "James Whitmore",
      email: "james.whitmore@example.com",
      phone: "+44 20 7123 4567",
      tier: "Gold",
      stage: "Quote",
      location: "Chelsea, London",
      nextTrip: "Japan · 12 nights · Cultural tour",
      value: "24500",
      lastTouch: "2 days ago",
      tags: ["Tailor-Made", "Business"],
      userId: user2.id,
    },
    {
      name: "Emma Richardson",
      email: "emma.richardson@example.com",
      phone: "+44 20 7987 6543",
      tier: "Standard",
      stage: "Enquiry",
      location: "Notting Hill, London",
      nextTrip: "Mediterranean cruise · 10 nights",
      value: "12800",
      lastTouch: "1 week ago",
      tags: ["Family", "Cruise"],
      userId: user1.id,
    },
  ]).returning();

  console.log("✅ Clients created");

  // Create quotes
  const [quote1, quote2, quote3] = await db.insert(quotes).values([
    {
      clientId: client1.id,
      userId: user1.id,
      status: "In Play",
      packageType: "Luxury Beach",
      quoteTitle: "Maldives — Coco Beach Resort, 7 nights",
      destination: "Maldives",
      travelDate: "2026-02-14",
      returnDate: "2026-02-21",
      passengersAdults: 2,
      passengersChildren: 2,
      childAges: [6, 10],
    },
    {
      clientId: client2.id,
      userId: user2.id,
      status: "In Play",
      packageType: "Tailor-Made",
      quoteTitle: "Japan — Kyoto + Tokyo, 12 nights",
      destination: "Japan",
      travelDate: "2026-03-18",
      returnDate: "2026-03-30",
      passengersAdults: 2,
      passengersChildren: 0,
      childAges: [],
    },
    {
      clientId: client1.id,
      userId: user3.id,
      status: "Won",
      packageType: "Luxury Beach",
      quoteTitle: "Santorini — Caldera Suite, 5 nights",
      destination: "Greece",
      travelDate: "2026-05-10",
      returnDate: "2026-05-15",
      passengersAdults: 2,
      passengersChildren: 0,
      childAges: [],
    },
  ]).returning();

  console.log("✅ Quotes created");

  // Create accommodations
  await db.insert(accommodations).values([
    {
      quoteId: quote1.id,
      property: "Luxury Coco Beach Resort",
      board: "Half Board",
      roomType: "Overwater Villa (Private Pool)",
      notes: "Early check-in requested · Anniversary amenities",
    },
    {
      quoteId: quote2.id,
      property: "Mixed (Kyoto + Tokyo)",
      board: "B&B",
      roomType: "King room",
      notes: "Include private guide 2 days in Kyoto",
    },
    {
      quoteId: quote3.id,
      property: "Caldera Luxury Resort",
      board: "Half Board",
      roomType: "Caldera Suite (Private Pool)",
      notes: "Champagne on arrival",
    },
  ]);

  console.log("✅ Accommodations created");

  // Create flights
  await db.insert(flights).values([
    {
      quoteId: quote1.id,
      direction: "outbound",
      fromAirport: "LHR",
      toAirport: "MLE",
      carrier: "BA",
      flightNo: "BA061",
      depart: new Date("2026-02-14T10:15:00"),
      arrive: new Date("2026-02-14T22:40:00"),
    },
    {
      quoteId: quote1.id,
      direction: "inbound",
      fromAirport: "MLE",
      toAirport: "LHR",
      carrier: "BA",
      flightNo: "BA060",
      depart: new Date("2026-02-21T00:30:00"),
      arrive: new Date("2026-02-21T06:55:00"),
    },
    {
      quoteId: quote2.id,
      direction: "outbound",
      fromAirport: "LHR",
      toAirport: "HND",
      carrier: "BA",
      flightNo: "BA007",
      depart: new Date("2026-03-18T12:30:00"),
      arrive: new Date("2026-03-19T10:15:00"),
    },
    {
      quoteId: quote2.id,
      direction: "inbound",
      fromAirport: "HND",
      toAirport: "LHR",
      carrier: "BA",
      flightNo: "BA006",
      depart: new Date("2026-03-30T13:05:00"),
      arrive: new Date("2026-03-30T19:45:00"),
    },
    {
      quoteId: quote3.id,
      direction: "outbound",
      fromAirport: "LHR",
      toAirport: "JTR",
      carrier: "BA",
      flightNo: "BA632",
      depart: new Date("2026-05-10T08:00:00"),
      arrive: new Date("2026-05-10T13:30:00"),
    },
    {
      quoteId: quote3.id,
      direction: "inbound",
      fromAirport: "JTR",
      toAirport: "LHR",
      carrier: "BA",
      flightNo: "BA633",
      depart: new Date("2026-05-15T14:30:00"),
      arrive: new Date("2026-05-15T18:00:00"),
    },
  ]);

  console.log("✅ Flights created");

  // Create commissions
  await db.insert(commissions).values([
    {
      quoteId: quote1.id,
      tourOperator: "Elegant Escapes",
      price: "18950",
      commissionPercent: "12",
      commissionValue: "2274",
      agentSplitPercent: "35",
      agentSplitValue: "795.90",
      netToAgency: "1478.10",
    },
    {
      quoteId: quote2.id,
      tourOperator: "InsideJapan Tours",
      price: "14200",
      commissionPercent: "15",
      commissionValue: "2130",
      agentSplitPercent: "40",
      agentSplitValue: "852",
      netToAgency: "1278",
    },
    {
      quoteId: quote3.id,
      tourOperator: "Greek Island Specialists",
      price: "8500",
      commissionPercent: "10",
      commissionValue: "850",
      agentSplitPercent: "30",
      agentSplitValue: "255",
      netToAgency: "595",
    },
  ]);

  console.log("✅ Commissions created");

  // Create quote images
  await db.insert(quoteImages).values([
    {
      quoteId: quote1.id,
      url: "/attached_assets/Luxury-Coco-Beach-Resort.jpg",
      isPrimary: true,
    },
    {
      quoteId: quote1.id,
      url: "/attached_assets/Luxury-Coco-Beach-Resort.jpg",
      isPrimary: false,
    },
    {
      quoteId: quote1.id,
      url: "/attached_assets/Luxury-Coco-Beach-Resort.jpg",
      isPrimary: false,
    },
    {
      quoteId: quote1.id,
      url: "/attached_assets/Luxury-Coco-Beach-Resort.jpg",
      isPrimary: false,
    },
    {
      quoteId: quote1.id,
      url: "/attached_assets/Luxury-Coco-Beach-Resort.jpg",
      isPrimary: false,
    },
  ]);

  console.log("✅ Quote images created");

  // Create notes
  await db.insert(notes).values([
    {
      quoteId: quote1.id,
      content: "Client prefers sunset side villa; avoid near pier.",
    },
    {
      quoteId: quote1.id,
      content: "Offer two options: 7 nights + upgrade vs 10 nights standard.",
    },
    {
      quoteId: quote2.id,
      content: "Client interested in cherry blossom season timing.",
    },
    {
      quoteId: quote2.id,
      content: "Wants to include a day trip to Mount Fuji.",
    },
  ]);

  console.log("✅ Notes created");

  console.log("✨ Seeding completed successfully!");
  
  await pool.end();
  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});
