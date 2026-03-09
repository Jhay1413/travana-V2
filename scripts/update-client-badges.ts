import { db } from "../server/config/database";
import { clientTable } from "../shared/schema";
import { sql, eq, inArray } from "drizzle-orm";

async function updateClientBadges() {
  console.log("🔄 Starting client badge update...\n");

  const result = await db.execute(sql`
    SELECT ct.id, ct."firstName", ct.surename, ct.badge,
      COUNT(b.id)::int AS "bookingCount"
    FROM client_table ct
    JOIN transaction t ON t.client_id = ct.id
    JOIN booking_table b ON b.transaction_id = t.id
    GROUP BY ct.id, ct."firstName", ct.surename, ct.badge
    HAVING COUNT(b.id) >= 2
    ORDER BY COUNT(b.id) DESC
  `);
  const bookingCounts = (result as any).rows || result as any;

  const vipClients = bookingCounts.filter(c => c.bookingCount > 3);
  const repeatClients = bookingCounts.filter(c => c.bookingCount >= 2 && c.bookingCount <= 3);

  console.log(`Found ${vipClients.length} clients with more than 3 bookings → VIP Client`);
  console.log(`Found ${repeatClients.length} clients with 2-3 bookings → Repeat Client\n`);

  let vipUpdated = 0;
  let repeatUpdated = 0;
  let skipped = 0;

  for (const client of vipClients) {
    if (client.badge === "VIP Client") {
      console.log(`  ⏭️  ${client.firstName} ${client.surename} (${client.bookingCount} bookings) — already VIP Client`);
      skipped++;
      continue;
    }
    await db.update(clientTable).set({ badge: "VIP Client" }).where(eq(clientTable.id, client.id));
    console.log(`  ⭐ ${client.firstName} ${client.surename} (${client.bookingCount} bookings) — ${client.badge || "No badge"} → VIP Client`);
    vipUpdated++;
  }

  for (const client of repeatClients) {
    if (client.badge === "Repeat Client") {
      console.log(`  ⏭️  ${client.firstName} ${client.surename} (${client.bookingCount} bookings) — already Repeat Client`);
      skipped++;
      continue;
    }
    if (client.badge === "VIP Client") {
      console.log(`  ⏭️  ${client.firstName} ${client.surename} (${client.bookingCount} bookings) — keeping VIP Client`);
      skipped++;
      continue;
    }
    await db.update(clientTable).set({ badge: "Repeat Client" }).where(eq(clientTable.id, client.id));
    console.log(`  🔁 ${client.firstName} ${client.surename} (${client.bookingCount} bookings) — ${client.badge || "No badge"} → Repeat Client`);
    repeatUpdated++;
  }

  console.log(`\n✅ Done!`);
  console.log(`   VIP Client updates: ${vipUpdated}`);
  console.log(`   Repeat Client updates: ${repeatUpdated}`);
  console.log(`   Skipped (already correct): ${skipped}`);
  console.log(`   Total clients processed: ${bookingCounts.length}`);

  process.exit(0);
}

updateClientBadges().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
