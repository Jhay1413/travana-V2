import { db } from "../server/config/database";
import { plans, type InsertPlan } from "../shared/schema";
import { eq } from "drizzle-orm";

const SEED_PLANS: InsertPlan[] = [
  { code: "starter",    name: "Starter",    branchLimit: 1,    seatLimit: 10,   priceCents: 4900 },
  { code: "growth",     name: "Growth",     branchLimit: 4,    seatLimit: 50,   priceCents: 9900 },
  { code: "enterprise", name: "Enterprise", branchLimit: null, seatLimit: null, priceCents: 49900 },
];

async function main() {
  console.log("Seeding plans...");

  for (const plan of SEED_PLANS) {
    const [existing] = await db.select({ id: plans.id }).from(plans).where(eq(plans.code, plan.code)).limit(1);

    if (existing) {
      await db.update(plans).set(plan).where(eq(plans.code, plan.code));
      console.log(`  updated plan "${plan.code}" (branchLimit=${plan.branchLimit ?? "unlimited"})`);
    } else {
      await db.insert(plans).values(plan);
      console.log(`  created plan "${plan.code}" (branchLimit=${plan.branchLimit ?? "unlimited"})`);
    }
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
