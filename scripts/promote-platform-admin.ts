import { db } from "../server/v2/config/database";
import { user } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const email = process.argv[2]?.trim();
  if (!email) {
    console.error("Usage: tsx scripts/promote-platform-admin.ts <email>");
    process.exit(1);
  }

  const [updated] = await db
    .update(user)
    .set({ role: "platform_admin" })
    .where(eq(user.email, email))
    .returning({ id: user.id, email: user.email, role: user.role });

  if (!updated) {
    console.error(`No user found with email: ${email}`);
    process.exit(2);
  }

  console.log(`Promoted ${updated.email} → role=${updated.role} (id: ${updated.id})`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
