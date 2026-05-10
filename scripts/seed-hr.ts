import { db } from "../server/config/database";
import { hrEmployeesTable, hrRemindersTable, organization } from "../shared/schema";
import { sql, eq } from "drizzle-orm";
import { employees, reminders } from "../artifacts/mockup-sandbox/src/components/mockups/travana-hr/_data";

async function resolveOrgId(): Promise<string> {
  const fromEnv = process.env.HR_SEED_ORG_ID;
  if (fromEnv) return fromEnv;

  const fromArg = process.argv[2];
  if (fromArg) return fromArg;

  // Fall back to the first org in the DB. Errors if there's more than one,
  // because silently picking one of several is dangerous.
  const orgs = await db.select({ id: organization.id, name: organization.name }).from(organization);
  if (orgs.length === 0) {
    throw new Error("No organizations exist — create one first or pass HR_SEED_ORG_ID env var / orgId CLI arg.");
  }
  if (orgs.length > 1) {
    const list = orgs.map(o => `  - ${o.id} (${o.name})`).join("\n");
    throw new Error(`Multiple organizations found — pick one explicitly via HR_SEED_ORG_ID env var or CLI arg:\n${list}`);
  }
  return orgs[0].id;
}

async function main() {
  const orgId = await resolveOrgId();
  console.log(`Seeding HR fixtures into org ${orgId}…`);

  await db.execute(sql`TRUNCATE TABLE hr_employees, hr_reminders`);

  for (let i = 0; i < employees.length; i++) {
    const e = employees[i];
    await db.insert(hrEmployeesTable).values({
      id: e.id,
      orgId,
      name: e.name,
      role: e.role,
      team: e.team,
      status: e.status,
      employmentType: e.employmentType,
      location: e.location,
      email: e.email,
      phone: e.phone,
      startDate: e.startDate,
      probationEnd: e.probationEnd ?? null,
      manager: e.manager,
      emergencyContact: e.emergencyContact as any,
      avatarColor: e.avatarColor,
      initials: e.initials,
      holidayAllowance: e.holidayAllowance,
      holidayUsed: e.holidayUsed,
      sickDaysYTD: e.sickDaysYTD,
      documents: e.documents as any,
      holidays: e.holidays as any,
      training: e.training as any,
      notes: e.notes as any,
      timeline: e.timeline as any,
      onboarding: e.onboarding as any,
      sortOrder: i,
    });
  }
  for (let i = 0; i < reminders.length; i++) {
    const r = reminders[i];
    await db.insert(hrRemindersTable).values({
      id: r.id,
      orgId,
      type: r.type,
      message: r.message,
      employee: r.employee,
      due: r.due,
      severity: r.severity,
      sortOrder: i,
    });
  }
  console.log(`Seeded ${employees.length} employees, ${reminders.length} reminders.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
