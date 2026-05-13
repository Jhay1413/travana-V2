import { db } from "../../config/database";
import {
  hrRecordsTable,
  user,
  branchMembers,
  branches,
  userProfiles,
} from "@shared/schema";
import { alias } from "drizzle-orm/pg-core";
import { and, eq, sql, type SQL } from "drizzle-orm";

type Filter = { orgId: string; branchId: string | null };

const managerUser = alias(user, "manager_user");

function rowSelector() {
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    phone: user.phoneNumber,
    orgRole: branchMembers.orgRole,
    branchId: branchMembers.branchId,
    branchName: branches.name,
    isActive: branchMembers.isActive,
    address: userProfiles.address,
    emergencyContactName: userProfiles.emergencyContactName,
    emergencyContactRelationship: userProfiles.emergencyContactRelationship,
    emergencyContactPhone: userProfiles.emergencyContactPhone,
    hrId: hrRecordsTable.id,
    status: hrRecordsTable.status,
    employmentType: hrRecordsTable.employmentType,
    startDate: hrRecordsTable.startDate,
    probationEnd: hrRecordsTable.probationEnd,
    managerUserId: hrRecordsTable.managerUserId,
    managerName: managerUser.name,
    salary: hrRecordsTable.salary,
    salaryCurrency: hrRecordsTable.salaryCurrency,
    contractType: hrRecordsTable.contractType,
    contractEndDate: hrRecordsTable.contractEndDate,
    holidayAllowance: hrRecordsTable.holidayAllowance,
    taxId: hrRecordsTable.taxId,
    holidays: hrRecordsTable.holidays,
    documents: hrRecordsTable.documents,
    notes: hrRecordsTable.notes,
  };
}

function whereForList(filter: Filter): SQL {
  const conditions: SQL[] = [eq(user.orgId, filter.orgId)];
  if (filter.branchId) conditions.push(eq(branchMembers.branchId, filter.branchId));
  return and(...conditions) as SQL;
}

export const hrRepository = {
  async list(filter: Filter) {
    return db
      .select(rowSelector())
      .from(user)
      .innerJoin(branchMembers, eq(branchMembers.userId, user.id))
      .leftJoin(branches, eq(branches.id, branchMembers.branchId))
      .leftJoin(userProfiles, eq(userProfiles.userId, user.id))
      .leftJoin(hrRecordsTable, eq(hrRecordsTable.userId, user.id))
      .leftJoin(managerUser, eq(managerUser.id, hrRecordsTable.managerUserId))
      .where(whereForList(filter))
      .orderBy(user.name);
  },

  async getOne(userId: string, filter: Filter) {
    const conditions: SQL[] = [eq(user.id, userId), eq(user.orgId, filter.orgId)];
    if (filter.branchId) conditions.push(eq(branchMembers.branchId, filter.branchId));
    const [row] = await db
      .select(rowSelector())
      .from(user)
      .innerJoin(branchMembers, eq(branchMembers.userId, user.id))
      .leftJoin(branches, eq(branches.id, branchMembers.branchId))
      .leftJoin(userProfiles, eq(userProfiles.userId, user.id))
      .leftJoin(hrRecordsTable, eq(hrRecordsTable.userId, user.id))
      .leftJoin(managerUser, eq(managerUser.id, hrRecordsTable.managerUserId))
      .where(and(...conditions))
      .limit(1);
    return row;
  },

  /** Ensure an hr_records row exists for this user, return it. */
  async ensureRecord(userId: string, orgId: string) {
    const existing = await db
      .select()
      .from(hrRecordsTable)
      .where(eq(hrRecordsTable.userId, userId))
      .limit(1);
    if (existing[0]) return existing[0];
    const [created] = await db
      .insert(hrRecordsTable)
      .values({ userId, orgId })
      .returning();
    return created;
  },

  async update(userId: string, orgId: string, patch: Record<string, unknown>) {
    const [row] = await db
      .update(hrRecordsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(hrRecordsTable.userId, userId), eq(hrRecordsTable.orgId, orgId)))
      .returning();
    return row;
  },

  async setHolidays(userId: string, orgId: string, holidays: unknown[]) {
    const [row] = await db
      .update(hrRecordsTable)
      .set({ holidays: sql`${JSON.stringify(holidays)}::jsonb`, updatedAt: new Date() })
      .where(and(eq(hrRecordsTable.userId, userId), eq(hrRecordsTable.orgId, orgId)))
      .returning();
    return row;
  },

  async setNotes(userId: string, orgId: string, notes: unknown[]) {
    const [row] = await db
      .update(hrRecordsTable)
      .set({ notes: sql`${JSON.stringify(notes)}::jsonb`, updatedAt: new Date() })
      .where(and(eq(hrRecordsTable.userId, userId), eq(hrRecordsTable.orgId, orgId)))
      .returning();
    return row;
  },

  async setDocuments(userId: string, orgId: string, documents: unknown[]) {
    const [row] = await db
      .update(hrRecordsTable)
      .set({ documents: sql`${JSON.stringify(documents)}::jsonb`, updatedAt: new Date() })
      .where(and(eq(hrRecordsTable.userId, userId), eq(hrRecordsTable.orgId, orgId)))
      .returning();
    return row;
  },
};

export type HrRepositoryRow = Awaited<ReturnType<typeof hrRepository.list>>[number];
