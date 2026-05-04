import { db } from "../server/config/database";
import { hrEmployeesTable, hrRemindersTable } from "../shared/schema";
import { sql } from "drizzle-orm";
import { employees, reminders } from "../artifacts/mockup-sandbox/src/components/mockups/travana-hr/_data";

async function main() {
  await db.execute(sql`TRUNCATE TABLE hr_employees, hr_reminders`);

  for (let i = 0; i < employees.length; i++) {
    const e = employees[i];
    await db.insert(hrEmployeesTable).values({
      id: e.id,
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
