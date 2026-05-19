import { db } from "../../config/database";
import {
  hrRecordsTable,
  hrDocumentsTable,
  hrLeavesTable,
  hrNotesTable,
  user,
  branchMembers,
  branches,
  userProfiles,
  type HrDocument,
  type InsertHrDocument,
  type HrLeave,
  type InsertHrLeave,
  type InsertHrNote,
} from "@shared/schema";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, inArray, type SQL } from "drizzle-orm";

type Filter = { orgId: string; branchId: string | null };

const managerUser = alias(user, "manager_user");
const noteAuthor = alias(user, "note_author");

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
  };
}

function whereForList(filter: Filter): SQL {
  const conditions: SQL[] = [eq(user.orgId, filter.orgId)];
  if (filter.branchId) conditions.push(eq(branchMembers.branchId, filter.branchId));
  return and(...conditions) as SQL;
}

export interface HrNoteRow extends Omit<typeof hrNotesTable.$inferSelect, never> {
  authorName: string | null;
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

  // ─── Documents ────────────────────────────────────────────────────────

  async listDocumentsForRecords(hrRecordIds: string[]): Promise<Map<string, HrDocument[]>> {
    const out = new Map<string, HrDocument[]>();
    if (hrRecordIds.length === 0) return out;
    const rows = await db
      .select()
      .from(hrDocumentsTable)
      .where(inArray(hrDocumentsTable.hrRecordId, hrRecordIds))
      .orderBy(desc(hrDocumentsTable.uploadedAt));
    for (const row of rows) {
      const bucket = out.get(row.hrRecordId) ?? [];
      bucket.push(row);
      out.set(row.hrRecordId, bucket);
    }
    return out;
  },

  async listDocumentsForRecord(hrRecordId: string): Promise<HrDocument[]> {
    return db
      .select()
      .from(hrDocumentsTable)
      .where(eq(hrDocumentsTable.hrRecordId, hrRecordId))
      .orderBy(desc(hrDocumentsTable.uploadedAt));
  },

  async findDocument(documentId: string, hrRecordId: string): Promise<HrDocument | undefined> {
    const [row] = await db
      .select()
      .from(hrDocumentsTable)
      .where(and(eq(hrDocumentsTable.id, documentId), eq(hrDocumentsTable.hrRecordId, hrRecordId)))
      .limit(1);
    return row;
  },

  async createDocument(values: InsertHrDocument): Promise<HrDocument> {
    const [row] = await db.insert(hrDocumentsTable).values(values).returning();
    return row;
  },

  async deleteDocument(documentId: string, hrRecordId: string): Promise<boolean> {
    const result = await db
      .delete(hrDocumentsTable)
      .where(and(eq(hrDocumentsTable.id, documentId), eq(hrDocumentsTable.hrRecordId, hrRecordId)))
      .returning({ id: hrDocumentsTable.id });
    return result.length > 0;
  },

  // ─── Leaves ───────────────────────────────────────────────────────────

  async listLeavesForRecords(hrRecordIds: string[]): Promise<Map<string, HrLeave[]>> {
    const out = new Map<string, HrLeave[]>();
    if (hrRecordIds.length === 0) return out;
    const rows = await db
      .select()
      .from(hrLeavesTable)
      .where(inArray(hrLeavesTable.hrRecordId, hrRecordIds))
      .orderBy(desc(hrLeavesTable.fromDate));
    for (const row of rows) {
      const bucket = out.get(row.hrRecordId) ?? [];
      bucket.push(row);
      out.set(row.hrRecordId, bucket);
    }
    return out;
  },

  async listLeavesForRecord(hrRecordId: string): Promise<HrLeave[]> {
    return db
      .select()
      .from(hrLeavesTable)
      .where(eq(hrLeavesTable.hrRecordId, hrRecordId))
      .orderBy(desc(hrLeavesTable.fromDate));
  },

  async findLeave(leaveId: string, hrRecordId: string): Promise<HrLeave | undefined> {
    const [row] = await db
      .select()
      .from(hrLeavesTable)
      .where(and(eq(hrLeavesTable.id, leaveId), eq(hrLeavesTable.hrRecordId, hrRecordId)))
      .limit(1);
    return row;
  },

  async createLeave(values: InsertHrLeave): Promise<HrLeave> {
    const [row] = await db.insert(hrLeavesTable).values(values).returning();
    return row;
  },

  async updateLeaveDecision(
    leaveId: string,
    hrRecordId: string,
    decision: "Approved" | "Rejected",
    decidedBy: string | null,
  ): Promise<HrLeave | undefined> {
    const [row] = await db
      .update(hrLeavesTable)
      .set({
        status: decision,
        decidedBy,
        decidedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(hrLeavesTable.id, leaveId), eq(hrLeavesTable.hrRecordId, hrRecordId)))
      .returning();
    return row;
  },

  // ─── Notes ────────────────────────────────────────────────────────────

  async listNotesForRecords(hrRecordIds: string[]): Promise<Map<string, HrNoteRow[]>> {
    const out = new Map<string, HrNoteRow[]>();
    if (hrRecordIds.length === 0) return out;
    const rows = await db
      .select({
        id: hrNotesTable.id,
        hrRecordId: hrNotesTable.hrRecordId,
        body: hrNotesTable.body,
        authorId: hrNotesTable.authorId,
        authorName: noteAuthor.name,
        createdAt: hrNotesTable.createdAt,
      })
      .from(hrNotesTable)
      .leftJoin(noteAuthor, eq(noteAuthor.id, hrNotesTable.authorId))
      .where(inArray(hrNotesTable.hrRecordId, hrRecordIds))
      .orderBy(desc(hrNotesTable.createdAt));
    for (const row of rows) {
      const bucket = out.get(row.hrRecordId) ?? [];
      bucket.push(row);
      out.set(row.hrRecordId, bucket);
    }
    return out;
  },

  async listNotesForRecord(hrRecordId: string): Promise<HrNoteRow[]> {
    return db
      .select({
        id: hrNotesTable.id,
        hrRecordId: hrNotesTable.hrRecordId,
        body: hrNotesTable.body,
        authorId: hrNotesTable.authorId,
        authorName: noteAuthor.name,
        createdAt: hrNotesTable.createdAt,
      })
      .from(hrNotesTable)
      .leftJoin(noteAuthor, eq(noteAuthor.id, hrNotesTable.authorId))
      .where(eq(hrNotesTable.hrRecordId, hrRecordId))
      .orderBy(desc(hrNotesTable.createdAt));
  },

  async createNote(values: InsertHrNote): Promise<HrNoteRow> {
    const [inserted] = await db.insert(hrNotesTable).values(values).returning();
    const [row] = await db
      .select({
        id: hrNotesTable.id,
        hrRecordId: hrNotesTable.hrRecordId,
        body: hrNotesTable.body,
        authorId: hrNotesTable.authorId,
        authorName: noteAuthor.name,
        createdAt: hrNotesTable.createdAt,
      })
      .from(hrNotesTable)
      .leftJoin(noteAuthor, eq(noteAuthor.id, hrNotesTable.authorId))
      .where(eq(hrNotesTable.id, inserted.id))
      .limit(1);
    return row;
  },
};

export type HrRepositoryRow = Awaited<ReturnType<typeof hrRepository.list>>[number];
