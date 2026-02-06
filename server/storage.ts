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
  tourOperators,
  airports,
  tickets,
  ticketAttachments,
  ticketReplies,
  notifications,
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
  type TourOperator,
  type InsertTourOperator,
  type Airport,
  type InsertAirport,
  type Ticket,
  type InsertTicket,
  type TicketAttachment,
  type InsertTicketAttachment,
  type TicketReply,
  type InsertTicketReply,
  type Notification,
  type InsertNotification,
  clientTable,
  type NeonClient,
  type InsertClientTable,
} from "@shared/schema";

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
});

export const db = drizzle(pool);

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
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

  // Tour Operators
  listTourOperators(): Promise<TourOperator[]>;
  getTourOperator(id: string): Promise<TourOperator | undefined>;
  createTourOperator(op: InsertTourOperator): Promise<TourOperator>;
  updateTourOperator(id: string, op: Partial<InsertTourOperator>): Promise<TourOperator | undefined>;
  deleteTourOperator(id: string): Promise<void>;

  // Airports
  listAirports(): Promise<Airport[]>;
  getAirport(id: string): Promise<Airport | undefined>;
  createAirport(airport: InsertAirport): Promise<Airport>;
  updateAirport(id: string, airport: Partial<InsertAirport>): Promise<Airport | undefined>;
  deleteAirport(id: string): Promise<void>;

  // Tickets
  listTickets(): Promise<Ticket[]>;
  listTicketsByClient(clientId: string): Promise<Ticket[]>;
  listTicketsByUser(userId: string): Promise<Ticket[]>;
  getTicket(id: string): Promise<Ticket | undefined>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicket(id: string, ticket: Partial<InsertTicket>): Promise<Ticket | undefined>;
  deleteTicket(id: string): Promise<void>;

  // Ticket Attachments
  listAttachmentsByTicket(ticketId: string): Promise<TicketAttachment[]>;
  getAttachment(id: string): Promise<TicketAttachment | undefined>;
  createAttachment(attachment: InsertTicketAttachment): Promise<TicketAttachment>;
  deleteAttachment(id: string): Promise<void>;

  // Ticket Replies
  listRepliesByTicket(ticketId: string): Promise<TicketReply[]>;
  getReply(id: string): Promise<TicketReply | undefined>;
  createReply(reply: InsertTicketReply): Promise<TicketReply>;
  updateReply(id: string, content: string): Promise<TicketReply | undefined>;
  deleteReply(id: string): Promise<void>;

  // Notifications
  listNotificationsByUser(userId: string): Promise<Notification[]>;
  listUnreadNotificationsByUser(userId: string): Promise<Notification[]>;
  getNotification(id: string): Promise<Notification | undefined>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: string): Promise<void>;
  deleteNotification(id: string): Promise<void>;

  // Neon Clients
  getNeonClient(id: string): Promise<NeonClient | undefined>;
  listNeonClients(): Promise<NeonClient[]>;
  createNeonClient(client: InsertClientTable): Promise<NeonClient>;
  updateNeonClient(id: string, client: Partial<InsertClientTable>): Promise<NeonClient | undefined>;
  deleteNeonClient(id: string): Promise<void>;
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

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users).set({ ...user, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
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

  // Tour Operators
  async listTourOperators(): Promise<TourOperator[]> {
    return db.select().from(tourOperators).orderBy(tourOperators.name);
  }

  async getTourOperator(id: string): Promise<TourOperator | undefined> {
    const result = await db.select().from(tourOperators).where(eq(tourOperators.id, id));
    return result[0];
  }

  async createTourOperator(op: InsertTourOperator): Promise<TourOperator> {
    const result = await db.insert(tourOperators).values(op).returning();
    return result[0];
  }

  async updateTourOperator(id: string, op: Partial<InsertTourOperator>): Promise<TourOperator | undefined> {
    const result = await db
      .update(tourOperators)
      .set({ ...op, updatedAt: new Date() })
      .where(eq(tourOperators.id, id))
      .returning();
    return result[0];
  }

  async deleteTourOperator(id: string): Promise<void> {
    await db.delete(tourOperators).where(eq(tourOperators.id, id));
  }

  // Airports
  async listAirports(): Promise<Airport[]> {
    return db.select().from(airports).orderBy(airports.name);
  }

  async getAirport(id: string): Promise<Airport | undefined> {
    const result = await db.select().from(airports).where(eq(airports.id, id));
    return result[0];
  }

  async createAirport(airport: InsertAirport): Promise<Airport> {
    const result = await db.insert(airports).values(airport).returning();
    return result[0];
  }

  async updateAirport(id: string, airport: Partial<InsertAirport>): Promise<Airport | undefined> {
    const result = await db.update(airports).set(airport).where(eq(airports.id, id)).returning();
    return result[0];
  }

  async deleteAirport(id: string): Promise<void> {
    await db.delete(airports).where(eq(airports.id, id));
  }

  // Tickets
  async listTickets(): Promise<Ticket[]> {
    return db.select().from(tickets).orderBy(desc(tickets.createdAt));
  }

  async listTicketsByClient(clientId: string): Promise<Ticket[]> {
    return db.select().from(tickets).where(eq(tickets.clientId, clientId)).orderBy(desc(tickets.createdAt));
  }

  async listTicketsByUser(userId: string): Promise<Ticket[]> {
    return db.select().from(tickets).where(eq(tickets.userId, userId)).orderBy(desc(tickets.createdAt));
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    const result = await db.select().from(tickets).where(eq(tickets.id, id));
    return result[0];
  }

  async createTicket(ticket: InsertTicket): Promise<Ticket> {
    const result = await db.insert(tickets).values(ticket).returning();
    return result[0];
  }

  async updateTicket(id: string, ticket: Partial<InsertTicket>): Promise<Ticket | undefined> {
    const result = await db
      .update(tickets)
      .set({ ...ticket, updatedAt: new Date() })
      .where(eq(tickets.id, id))
      .returning();
    return result[0];
  }

  async deleteTicket(id: string): Promise<void> {
    await db.delete(tickets).where(eq(tickets.id, id));
  }

  // Ticket Attachments
  async listAttachmentsByTicket(ticketId: string): Promise<TicketAttachment[]> {
    return db.select().from(ticketAttachments).where(eq(ticketAttachments.ticketId, ticketId)).orderBy(desc(ticketAttachments.createdAt));
  }

  async getAttachment(id: string): Promise<TicketAttachment | undefined> {
    const result = await db.select().from(ticketAttachments).where(eq(ticketAttachments.id, id));
    return result[0];
  }

  async createAttachment(attachment: InsertTicketAttachment): Promise<TicketAttachment> {
    const result = await db.insert(ticketAttachments).values(attachment).returning();
    return result[0];
  }

  async deleteAttachment(id: string): Promise<void> {
    await db.delete(ticketAttachments).where(eq(ticketAttachments.id, id));
  }

  // Ticket Replies
  async listRepliesByTicket(ticketId: string): Promise<TicketReply[]> {
    return db.select().from(ticketReplies).where(eq(ticketReplies.ticketId, ticketId)).orderBy(ticketReplies.createdAt);
  }

  async getReply(id: string): Promise<TicketReply | undefined> {
    const result = await db.select().from(ticketReplies).where(eq(ticketReplies.id, id));
    return result[0];
  }

  async createReply(reply: InsertTicketReply): Promise<TicketReply> {
    const result = await db.insert(ticketReplies).values(reply).returning();
    return result[0];
  }

  async updateReply(id: string, content: string): Promise<TicketReply | undefined> {
    const result = await db
      .update(ticketReplies)
      .set({ content, updatedAt: new Date() })
      .where(eq(ticketReplies.id, id))
      .returning();
    return result[0];
  }

  async deleteReply(id: string): Promise<void> {
    await db.delete(ticketReplies).where(eq(ticketReplies.id, id));
  }

  // Notifications
  async listNotificationsByUser(userId: string): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
  }

  async listUnreadNotificationsByUser(userId: string): Promise<Notification[]> {
    return db.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.read, false))).orderBy(desc(notifications.createdAt));
  }

  async getNotification(id: string): Promise<Notification | undefined> {
    const result = await db.select().from(notifications).where(eq(notifications.id, id));
    return result[0];
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(notification).returning();
    return result[0];
  }

  async markNotificationRead(id: string): Promise<Notification | undefined> {
    const result = await db.update(notifications).set({ read: true }).where(eq(notifications.id, id)).returning();
    return result[0];
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
  }

  async deleteNotification(id: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  }

  // Neon Clients
  async getNeonClient(id: string): Promise<NeonClient | undefined> {
    const result = await db.select().from(clientTable).where(eq(clientTable.id, id)).limit(1);
    return result[0];
  }

  async listNeonClients(): Promise<NeonClient[]> {
    return await db.select().from(clientTable).orderBy(desc(clientTable.createdAt));
  }

  async createNeonClient(client: InsertClientTable): Promise<NeonClient> {
    const result = await db.insert(clientTable).values(client).returning();
    return result[0];
  }

  async updateNeonClient(id: string, client: Partial<InsertClientTable>): Promise<NeonClient | undefined> {
    const result = await db.update(clientTable).set(client).where(eq(clientTable.id, id)).returning();
    return result[0];
  }

  async deleteNeonClient(id: string): Promise<void> {
    await db.delete(clientTable).where(eq(clientTable.id, id));
  }
}

export const storage = new DbStorage();
