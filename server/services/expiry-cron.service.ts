import cron from "node-cron";
import { db } from "../config/database";
import { enquiry_table, quote } from "@shared/schema";
import { and, eq, lt, sql } from "drizzle-orm";

/**
 * Mark enquiries older than 7 days as expired
 */
async function expireOldEnquiries(): Promise<void> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const result = await db
      .update(enquiry_table)
      .set({ is_expired: true })
      .where(
        and(
          eq(enquiry_table.is_expired, false),
          lt(enquiry_table.date_created, sevenDaysAgo)
        )
      )
      .returning({ id: enquiry_table.id });

    console.log(`[Expiry Cron] Expired ${result.length} old enquiries`);
  } catch (error) {
    console.error("[Expiry Cron] Error expiring old enquiries:", error);
  }
}

/**
 * Mark quotes older than 7 days as expired
 */
async function expireOldQuotes(): Promise<void> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const result = await db
      .update(quote)
      .set({ is_expired: true })
      .where(
        and(
          eq(quote.is_expired, false),
          lt(quote.date_created, sevenDaysAgo)
        )
      )
      .returning({ id: quote.id });

    console.log(`[Expiry Cron] Expired ${result.length} old quotes`);
  } catch (error) {
    console.error("[Expiry Cron] Error expiring old quotes:", error);
  }
}

/**
 * Run expiry check for both enquiries and quotes
 */
export async function runExpiryCheck(): Promise<void> {
  console.log("[Expiry Cron] Running expiry check at", new Date().toISOString());
  await Promise.all([
    expireOldEnquiries(),
    expireOldQuotes(),
  ]);
}

/**
 * Initialize cron jobs for expiring old enquiries and quotes
 * Runs every day at midnight (00:00)
 */
export function initializeExpiryCron(): void {
  // Run at midnight every day (00:00)
  cron.schedule("0 0 * * *", async () => {
    await runExpiryCheck();
  });

  console.log("[Expiry Cron] Scheduled to run daily at midnight (00:00)");
  
  // Optional: Run once on startup for immediate check
  // Uncomment the line below if you want to check on server start
  // runExpiryCheck();
}
