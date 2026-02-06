import { db } from "../config/database";
import { enquiries, type Enquiry, type InsertEnquiry } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const enquiryRepository = {
  async findById(id: string): Promise<Enquiry | undefined> {
    const [result] = await db.select().from(enquiries).where(eq(enquiries.id, id)).limit(1);
    return result;
  },

  async findAll(): Promise<Enquiry[]> {
    return await db.select().from(enquiries).orderBy(desc(enquiries.createdAt));
  },

  async findByClientId(clientId: string): Promise<Enquiry[]> {
    return await db.select().from(enquiries).where(eq(enquiries.clientId, clientId)).orderBy(desc(enquiries.createdAt));
  },

  async create(enquiry: InsertEnquiry): Promise<Enquiry> {
    const [result] = await db.insert(enquiries).values(enquiry).returning();
    return result;
  },

  async update(id: string, data: Partial<InsertEnquiry>): Promise<Enquiry | undefined> {
    const [result] = await db.update(enquiries).set({ ...data, updatedAt: new Date() }).where(eq(enquiries.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(enquiries).where(eq(enquiries.id, id));
  },
};
