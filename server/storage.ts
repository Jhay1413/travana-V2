import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc, and, sql } from "drizzle-orm";
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
  type User,
  type InsertUser,
  type Client,
  type InsertClient,
  type Quote,
  type InsertQuote,
  type Accommodation,
  type InsertAccommodation,
  type Flight,
  type InsertFlight,
  type Commission,
  type InsertCommission,
  type QuoteImage,
  type InsertQuoteImage,
  type Note,
  type InsertNote,
} from "@shared/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  listUsers(): Promise<User[]>;

  // Clients
  getClient(id: string): Promise<Client | undefined>;
  listClients(): Promise<Client[]>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<void>;

  // Quotes
  getQuote(id: string): Promise<Quote | undefined>;
  listQuotes(): Promise<Quote[]>;
  listQuotesByClient(clientId: string): Promise<Quote[]>;
  listQuotesByStatus(status: string): Promise<Quote[]>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, quote: Partial<InsertQuote>): Promise<Quote | undefined>;
  deleteQuote(id: string): Promise<void>;

  // Accommodations
  getAccommodationByQuoteId(quoteId: string): Promise<Accommodation | undefined>;
  createAccommodation(accommodation: InsertAccommodation): Promise<Accommodation>;
  updateAccommodation(id: string, accommodation: Partial<InsertAccommodation>): Promise<Accommodation | undefined>;

  // Flights
  listFlightsByQuoteId(quoteId: string): Promise<Flight[]>;
  createFlight(flight: InsertFlight): Promise<Flight>;
  updateFlight(id: string, flight: Partial<InsertFlight>): Promise<Flight | undefined>;

  // Commissions
  getCommissionByQuoteId(quoteId: string): Promise<Commission | undefined>;
  createCommission(commission: InsertCommission): Promise<Commission>;
  updateCommission(id: string, commission: Partial<InsertCommission>): Promise<Commission | undefined>;

  // Quote Images
  listQuoteImagesByQuoteId(quoteId: string): Promise<QuoteImage[]>;
  createQuoteImage(image: InsertQuoteImage): Promise<QuoteImage>;
  deleteQuoteImage(id: string): Promise<void>;

  // Notes
  listNotesByQuoteId(quoteId: string): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: string, content: string): Promise<Note | undefined>;
  deleteNote(id: string): Promise<void>;

  // Dashboard Stats
  getDashboardStats(): Promise<{
    totalClients: number;
    totalQuotes: number;
    totalRevenue: number;
    avgDealSize: number;
    inPlayCount: number;
    wonCount: number;
    lostCount: number;
  }>;
}

export class DbStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async listUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // Clients
  async getClient(id: string): Promise<Client | undefined> {
    const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    return result[0];
  }

  async listClients(): Promise<Client[]> {
    return await db.select().from(clients).orderBy(desc(clients.createdAt));
  }

  async createClient(client: InsertClient): Promise<Client> {
    const result = await db.insert(clients).values(client).returning();
    return result[0];
  }

  async updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined> {
    const result = await db.update(clients).set(client).where(eq(clients.id, id)).returning();
    return result[0];
  }

  async deleteClient(id: string): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  // Quotes
  async getQuote(id: string): Promise<Quote | undefined> {
    const result = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
    return result[0];
  }

  async listQuotes(): Promise<Quote[]> {
    return await db.select().from(quotes).orderBy(desc(quotes.createdAt));
  }

  async listQuotesByClient(clientId: string): Promise<Quote[]> {
    return await db.select().from(quotes).where(eq(quotes.clientId, clientId)).orderBy(desc(quotes.createdAt));
  }

  async listQuotesByStatus(status: string): Promise<Quote[]> {
    return await db.select().from(quotes).where(eq(quotes.status, status)).orderBy(desc(quotes.createdAt));
  }

  async createQuote(quote: InsertQuote): Promise<Quote> {
    const result = await db.insert(quotes).values(quote).returning();
    return result[0];
  }

  async updateQuote(id: string, quote: Partial<InsertQuote>): Promise<Quote | undefined> {
    const result = await db.update(quotes).set(quote).where(eq(quotes.id, id)).returning();
    return result[0];
  }

  async deleteQuote(id: string): Promise<void> {
    await db.delete(quotes).where(eq(quotes.id, id));
  }

  // Accommodations
  async getAccommodationByQuoteId(quoteId: string): Promise<Accommodation | undefined> {
    const result = await db.select().from(accommodations).where(eq(accommodations.quoteId, quoteId)).limit(1);
    return result[0];
  }

  async createAccommodation(accommodation: InsertAccommodation): Promise<Accommodation> {
    const result = await db.insert(accommodations).values(accommodation).returning();
    return result[0];
  }

  async updateAccommodation(id: string, accommodation: Partial<InsertAccommodation>): Promise<Accommodation | undefined> {
    const result = await db.update(accommodations).set(accommodation).where(eq(accommodations.id, id)).returning();
    return result[0];
  }

  // Flights
  async listFlightsByQuoteId(quoteId: string): Promise<Flight[]> {
    return await db.select().from(flights).where(eq(flights.quoteId, quoteId));
  }

  async createFlight(flight: InsertFlight): Promise<Flight> {
    const result = await db.insert(flights).values(flight).returning();
    return result[0];
  }

  async updateFlight(id: string, flight: Partial<InsertFlight>): Promise<Flight | undefined> {
    const result = await db.update(flights).set(flight).where(eq(flights.id, id)).returning();
    return result[0];
  }

  // Commissions
  async getCommissionByQuoteId(quoteId: string): Promise<Commission | undefined> {
    const result = await db.select().from(commissions).where(eq(commissions.quoteId, quoteId)).limit(1);
    return result[0];
  }

  async createCommission(commission: InsertCommission): Promise<Commission> {
    const result = await db.insert(commissions).values(commission).returning();
    return result[0];
  }

  async updateCommission(id: string, commission: Partial<InsertCommission>): Promise<Commission | undefined> {
    const result = await db.update(commissions).set(commission).where(eq(commissions.id, id)).returning();
    return result[0];
  }

  // Quote Images
  async listQuoteImagesByQuoteId(quoteId: string): Promise<QuoteImage[]> {
    return await db.select().from(quoteImages).where(eq(quoteImages.quoteId, quoteId));
  }

  async createQuoteImage(image: InsertQuoteImage): Promise<QuoteImage> {
    const result = await db.insert(quoteImages).values(image).returning();
    return result[0];
  }

  async deleteQuoteImage(id: string): Promise<void> {
    await db.delete(quoteImages).where(eq(quoteImages.id, id));
  }

  // Notes
  async listNotesByQuoteId(quoteId: string): Promise<Note[]> {
    return await db.select().from(notes).where(eq(notes.quoteId, quoteId)).orderBy(desc(notes.createdAt));
  }

  async createNote(note: InsertNote): Promise<Note> {
    const result = await db.insert(notes).values(note).returning();
    return result[0];
  }

  async updateNote(id: string, content: string): Promise<Note | undefined> {
    const result = await db.update(notes).set({ content }).where(eq(notes.id, id)).returning();
    return result[0];
  }

  async deleteNote(id: string): Promise<void> {
    await db.delete(notes).where(eq(notes.id, id));
  }

  // Dashboard Stats
  async getDashboardStats(): Promise<{
    totalClients: number;
    totalQuotes: number;
    totalRevenue: number;
    avgDealSize: number;
    inPlayCount: number;
    wonCount: number;
    lostCount: number;
  }> {
    const clientCount = await db.select({ count: sql<number>`count(*)` }).from(clients);
    const quoteCount = await db.select({ count: sql<number>`count(*)` }).from(quotes);
    const revenue = await db.select({ total: sql<number>`COALESCE(SUM(CAST(${commissions.netToAgency} AS DECIMAL)), 0)` }).from(commissions);
    const avgDeal = await db.select({ avg: sql<number>`COALESCE(AVG(CAST(${commissions.netToAgency} AS DECIMAL)), 0)` }).from(commissions);
    
    const inPlay = await db.select({ count: sql<number>`count(*)` }).from(quotes).where(eq(quotes.status, "In Play"));
    const won = await db.select({ count: sql<number>`count(*)` }).from(quotes).where(eq(quotes.status, "Won"));
    const lost = await db.select({ count: sql<number>`count(*)` }).from(quotes).where(eq(quotes.status, "Lost"));

    return {
      totalClients: Number(clientCount[0]?.count || 0),
      totalQuotes: Number(quoteCount[0]?.count || 0),
      totalRevenue: Number(revenue[0]?.total || 0),
      avgDealSize: Number(avgDeal[0]?.avg || 0),
      inPlayCount: Number(inPlay[0]?.count || 0),
      wonCount: Number(won[0]?.count || 0),
      lostCount: Number(lost[0]?.count || 0),
    };
  }
}

export const storage = new DbStorage();
