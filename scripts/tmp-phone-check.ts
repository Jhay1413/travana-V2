// TEMP diagnostic (delete after use): list clients whose phone digits end
// with the tail of 07968215588 — explains a phone_conflict during onboarding.
import { db } from "../server/v2/config/database";
import { sql } from "drizzle-orm";

async function main() {
  const res = await db.execute(sql`
    SELECT id, "firstName", surename, "phoneNumber", org_id, "createdAt"
    FROM client_table
    WHERE regexp_replace(COALESCE("phoneNumber", ''), '[^0-9]', '', 'g') LIKE '%68215588'
    ORDER BY "createdAt" DESC
    LIMIT 10
  `);
  console.log(JSON.stringify(res.rows ?? res, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
