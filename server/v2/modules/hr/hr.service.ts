import path from "path";
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";
import { s3Client, S3_BUCKET } from "../../config/s3";
import { hrRepository, type HrRepositoryRow, type HrNoteRow } from "./hr.repository";
import { inviteService } from "../invite/invite.service";
import type { HrDocument, HrLeave } from "@shared/schema";
import type {
  AddDocumentPayload,
  AddNotePayload,
  DocumentCategory,
  DocStatus,
  DocumentEntry,
  EmployeeDetail,
  EmployeeRow,
  HrReminder,
  InviteEmployeePayload,
  LeaveEntry,
  LeaveStatus,
  LeaveType,
  NoteEntry,
  RequestLeavePayload,
  UpdateEmployeePayload,
  UploadDocumentFileOptions,
} from "./hr.types";

const SENSITIVE_ROLES = new Set(["org_admin", "platform_admin"]);
const REMINDER_WINDOW_DAYS = 30;
const HR_DOC_S3_PREFIX = "hr-documents";
const DOWNLOAD_URL_TTL_SECONDS = 60 * 5;

function canSeeSensitive(scope: Scope): boolean {
  return SENSITIVE_ROLES.has(scope.orgRole);
}

function filterForScope(scope: Scope): { orgId: string; branchId: string | null } {
  if (scope.orgRole === "platform_admin") {
    if (!scope.orgId) throw new AppError("orgId required for HR query", 400);
    return { orgId: scope.orgId, branchId: null };
  }
  if (scope.orgRole === "org_admin") {
    return { orgId: scope.orgId, branchId: null };
  }
  // branch_manager: hard-scope to their branch.
  if (!scope.branchId) {
    throw new AppError("No branch context for HR", 403);
  }
  return { orgId: scope.orgId, branchId: scope.branchId };
}

function mapHrDocument(row: HrDocument): DocumentEntry {
  return {
    id: row.id,
    name: row.name,
    category: row.category as DocumentCategory,
    status: row.status as DocStatus,
    s3Key: row.s3Key ?? null,
    mimeType: row.mimeType ?? null,
    size: row.size ?? null,
    url: row.url ?? null,
    expiresAt: row.expiresAt ?? null,
    uploadedAt: row.uploadedAt.toISOString(),
    uploadedBy: row.uploadedBy ?? null,
  };
}

function mapHrLeave(row: HrLeave): LeaveEntry {
  return {
    id: row.id,
    type: row.type as LeaveType,
    from: row.fromDate,
    to: row.toDate,
    status: row.status as LeaveStatus,
    reason: row.reason ?? null,
    decidedBy: row.decidedBy ?? null,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapHrNote(row: HrNoteRow): NoteEntry {
  return {
    id: row.id,
    body: row.body,
    author: row.authorName ?? "HR",
    authorId: row.authorId ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function countHolidayDays(holidays: LeaveEntry[]): number {
  return holidays
    .filter((h) => h.status === "Approved" && h.type === "Annual")
    .reduce((total, h) => {
      const start = new Date(h.from);
      const end = new Date(h.to);
      const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
      return total + days;
    }, 0);
}

function toEmployeeRow(
  row: HrRepositoryRow,
  documents: DocumentEntry[],
  holidays: LeaveEntry[],
  notes: NoteEntry[],
  scope: Scope,
): EmployeeRow {
  const base: EmployeeRow = {
    userId: row.userId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    orgRole: row.orgRole,
    branchId: row.branchId ?? null,
    branchName: row.branchName ?? null,
    address: row.address ?? null,
    emergencyContactName: row.emergencyContactName ?? null,
    emergencyContactRelationship: row.emergencyContactRelationship ?? null,
    emergencyContactPhone: row.emergencyContactPhone ?? null,
    status: (row.status ?? "Active") as EmployeeRow["status"],
    employmentType: (row.employmentType ?? "Full-time") as EmployeeRow["employmentType"],
    startDate: row.startDate ?? null,
    probationEnd: row.probationEnd ?? null,
    managerUserId: row.managerUserId ?? null,
    managerName: row.managerName ?? null,
    contractType: (row.contractType as EmployeeRow["contractType"]) ?? null,
    contractEndDate: row.contractEndDate ?? null,
    holidayAllowance: row.holidayAllowance ?? null,
    holidayUsedDays: countHolidayDays(holidays),
    holidays,
    documents,
    notes,
  };
  if (canSeeSensitive(scope)) {
    base.salary = row.salary ?? null;
    base.salaryCurrency = row.salaryCurrency ?? null;
    base.taxId = row.taxId ?? null;
  }
  return base;
}

async function loadChildrenForRow(
  row: HrRepositoryRow,
): Promise<{ documents: DocumentEntry[]; holidays: LeaveEntry[]; notes: NoteEntry[] }> {
  if (!row.hrId) {
    return { documents: [], holidays: [], notes: [] };
  }
  const [docs, leaves, notes] = await Promise.all([
    hrRepository.listDocumentsForRecord(row.hrId),
    hrRepository.listLeavesForRecord(row.hrId),
    hrRepository.listNotesForRecord(row.hrId),
  ]);
  return {
    documents: docs.map(mapHrDocument),
    holidays: leaves.map(mapHrLeave),
    notes: notes.map(mapHrNote),
  };
}

async function ensureRecordId(userId: string, orgId: string): Promise<string> {
  const record = await hrRepository.ensureRecord(userId, orgId);
  return record.id;
}

function daysBetween(today: Date, target: Date): number {
  const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((startOfDay(target) - startOfDay(today)) / 86_400_000);
}

function nextAnniversary(startDate: Date, today: Date): Date {
  const next = new Date(Date.UTC(today.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  if (next.getTime() < Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  }
  return next;
}

function severity(daysUntil: number): HrReminder["severity"] {
  if (daysUntil <= 7) return "urgent";
  if (daysUntil <= 14) return "warning";
  return "info";
}

function buildReminders(rows: HrRepositoryRow[], today = new Date()): HrReminder[] {
  const reminders: HrReminder[] = [];
  for (const row of rows) {
    if (row.probationEnd) {
      const due = new Date(row.probationEnd);
      const days = daysBetween(today, due);
      if (days >= 0 && days <= REMINDER_WINDOW_DAYS) {
        reminders.push({
          id: `prob-${row.userId}`,
          kind: "probation_end",
          userId: row.userId,
          employeeName: row.name,
          dueDate: row.probationEnd,
          daysUntil: days,
          message: `Probation ends in ${days} day${days === 1 ? "" : "s"}`,
          severity: severity(days),
        });
      }
    }
    if (row.contractEndDate) {
      const due = new Date(row.contractEndDate);
      const days = daysBetween(today, due);
      if (days >= 0 && days <= REMINDER_WINDOW_DAYS) {
        reminders.push({
          id: `contract-${row.userId}`,
          kind: "contract_end",
          userId: row.userId,
          employeeName: row.name,
          dueDate: row.contractEndDate,
          daysUntil: days,
          message: `Contract ends in ${days} day${days === 1 ? "" : "s"}`,
          severity: severity(days),
        });
      }
    }
    if (row.startDate) {
      const start = new Date(row.startDate);
      const anniv = nextAnniversary(start, today);
      const days = daysBetween(today, anniv);
      if (days >= 0 && days <= REMINDER_WINDOW_DAYS) {
        const years = anniv.getUTCFullYear() - start.getUTCFullYear();
        if (years > 0) {
          reminders.push({
            id: `anniv-${row.userId}-${anniv.getUTCFullYear()}`,
            kind: "work_anniversary",
            userId: row.userId,
            employeeName: row.name,
            dueDate: anniv.toISOString().slice(0, 10),
            daysUntil: days,
            message: `${years}-year work anniversary in ${days} day${days === 1 ? "" : "s"}`,
            severity: "info",
          });
        }
      }
    }
  }
  return reminders.sort((a, b) => a.daysUntil - b.daysUntil);
}

export const hrService = {
  async list(scope: Scope): Promise<EmployeeRow[]> {
    const filter = filterForScope(scope);
    const rows = await hrRepository.list(filter);
    const hrIds = rows.map((r) => r.hrId).filter((id): id is string => !!id);

    const [docsMap, leavesMap, notesMap] = await Promise.all([
      hrRepository.listDocumentsForRecords(hrIds),
      hrRepository.listLeavesForRecords(hrIds),
      hrRepository.listNotesForRecords(hrIds),
    ]);

    return rows.map((row) => {
      const documents = (row.hrId ? docsMap.get(row.hrId) ?? [] : []).map(mapHrDocument);
      const holidays = (row.hrId ? leavesMap.get(row.hrId) ?? [] : []).map(mapHrLeave);
      const notes = (row.hrId ? notesMap.get(row.hrId) ?? [] : []).map(mapHrNote);
      return toEmployeeRow(row, documents, holidays, notes, scope);
    });
  },

  async get(userId: string, scope: Scope): Promise<EmployeeDetail> {
    const filter = filterForScope(scope);
    const row = await hrRepository.getOne(userId, filter);
    if (!row) throw new AppError("Employee not found", 404);
    const children = await loadChildrenForRow(row);
    return toEmployeeRow(row, children.documents, children.holidays, children.notes, scope);
  },

  async reminders(scope: Scope): Promise<HrReminder[]> {
    const filter = filterForScope(scope);
    const rows = await hrRepository.list(filter);
    return buildReminders(rows);
  },

  async invite(payload: InviteEmployeePayload, scope: Scope) {
    if (scope.orgRole === "branch_manager" && payload.branchId !== scope.branchId) {
      throw new AppError("Branch managers can only invite onto their own branch", 403);
    }
    if (!scope.orgId || !scope.userId) throw new AppError("Missing scope context", 400);
    return inviteService.send(
      { email: payload.email, branchId: payload.branchId, orgRole: payload.orgRole },
      {
        orgId: scope.orgId,
        userId: scope.userId,
        orgRole: scope.orgRole,
        branchId: scope.branchId,
      } as any,
    );
  },

  async update(userId: string, patch: UpdateEmployeePayload, scope: Scope): Promise<EmployeeDetail> {
    const filter = filterForScope(scope);
    const target = await hrRepository.getOne(userId, filter);
    if (!target) throw new AppError("Employee not found", 404);

    if (("taxId" in patch || "salary" in patch || "salaryCurrency" in patch) && !canSeeSensitive(scope)) {
      throw new AppError("Only org admins can edit salary or tax ID", 403);
    }

    await hrRepository.ensureRecord(userId, scope.orgId);
    await hrRepository.update(userId, scope.orgId, patch as Record<string, unknown>);

    return this.get(userId, scope);
  },

  async requestLeave(userId: string, payload: RequestLeavePayload, scope: Scope): Promise<EmployeeDetail> {
    const filter = filterForScope(scope);
    const target = await hrRepository.getOne(userId, filter);
    if (!target) throw new AppError("Employee not found", 404);

    const hrId = await ensureRecordId(userId, scope.orgId);
    await hrRepository.createLeave({
      hrRecordId: hrId,
      type: payload.type,
      fromDate: payload.from,
      toDate: payload.to,
      reason: payload.reason ?? null,
      status: "Pending",
    });
    return this.get(userId, scope);
  },

  async getMyRecord(scope: Scope): Promise<EmployeeDetail> {
    if (!scope.userId || !scope.orgId) throw new AppError("Not authenticated", 401);
    const filter = { orgId: scope.orgId, branchId: null };
    const row = await hrRepository.getOne(scope.userId, filter);
    if (!row) throw new AppError("No HR record found for this user", 404);
    const children = await loadChildrenForRow(row);
    return toEmployeeRow(row, children.documents, children.holidays, children.notes, scope);
  },

  async uploadDocumentFile(
    userId: string,
    file: Express.Multer.File,
    scope: Scope,
    options: UploadDocumentFileOptions = {},
  ): Promise<EmployeeDetail> {
    const filter = filterForScope(scope);
    const target = await hrRepository.getOne(userId, filter);
    if (!target) throw new AppError("Employee not found", 404);

    const ext = path.extname(file.originalname);
    const s3Key = `${HR_DOC_S3_PREFIX}/${userId}/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.originalname)}`,
      }),
    );

    try {
      const hrId = await ensureRecordId(userId, scope.orgId);
      await hrRepository.createDocument({
        hrRecordId: hrId,
        name: options.displayName?.trim() || file.originalname,
        category: options.category ?? "Other",
        status: "Uploaded",
        s3Key,
        mimeType: file.mimetype,
        size: file.size,
        expiresAt: options.expiresAt ?? null,
        uploadedBy: scope.userId ?? null,
      });
      return this.get(userId, scope);
    } catch (err) {
      // Roll back the S3 upload if the DB write fails.
      await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: s3Key })).catch(() => {});
      throw err;
    }
  },

  async getDocumentDownloadUrl(userId: string, docId: string, scope: Scope): Promise<string> {
    const filter = filterForScope(scope);
    const target = await hrRepository.getOne(userId, filter);
    if (!target) throw new AppError("Employee not found", 404);
    if (!target.hrId) throw new AppError("Document not found", 404);

    const doc = await hrRepository.findDocument(docId, target.hrId);
    if (!doc) throw new AppError("Document not found", 404);

    if (doc.s3Key) {
      return getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: doc.s3Key,
          ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
        }),
        { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
      );
    }

    if (doc.url) return doc.url;

    throw new AppError("This document has no downloadable content", 400);
  },

  async deleteDocument(userId: string, docId: string, scope: Scope): Promise<EmployeeDetail> {
    const filter = filterForScope(scope);
    const target = await hrRepository.getOne(userId, filter);
    if (!target) throw new AppError("Employee not found", 404);
    if (!target.hrId) throw new AppError("Document not found", 404);

    const doc = await hrRepository.findDocument(docId, target.hrId);
    if (!doc) throw new AppError("Document not found", 404);

    if (doc.s3Key) {
      await s3Client
        .send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: doc.s3Key }))
        .catch(() => {}); // tolerate already-deleted S3 object
    }

    await hrRepository.deleteDocument(docId, target.hrId);
    return this.get(userId, scope);
  },

  async requestMyLeave(payload: RequestLeavePayload, scope: Scope): Promise<EmployeeDetail> {
    if (!scope.userId || !scope.orgId) throw new AppError("Not authenticated", 401);
    const filter = { orgId: scope.orgId, branchId: null };
    const target = await hrRepository.getOne(scope.userId, filter);
    if (!target) throw new AppError("No HR record found for this user", 404);

    const hrId = await ensureRecordId(scope.userId, scope.orgId);
    await hrRepository.createLeave({
      hrRecordId: hrId,
      type: payload.type,
      fromDate: payload.from,
      toDate: payload.to,
      reason: payload.reason ?? null,
      status: "Pending",
    });
    return this.getMyRecord(scope);
  },

  async decideLeave(
    userId: string,
    leaveId: string,
    decision: "Approved" | "Rejected",
    scope: Scope,
  ): Promise<EmployeeDetail> {
    const filter = filterForScope(scope);
    const target = await hrRepository.getOne(userId, filter);
    if (!target) throw new AppError("Employee not found", 404);
    if (!target.hrId) throw new AppError("Leave entry not found", 404);

    const updated = await hrRepository.updateLeaveDecision(
      leaveId,
      target.hrId,
      decision,
      scope.userId ?? null,
    );
    if (!updated) throw new AppError("Leave entry not found", 404);

    return this.get(userId, scope);
  },

  async addNote(userId: string, payload: AddNotePayload, scope: Scope): Promise<EmployeeDetail> {
    const filter = filterForScope(scope);
    const target = await hrRepository.getOne(userId, filter);
    if (!target) throw new AppError("Employee not found", 404);

    const hrId = await ensureRecordId(userId, scope.orgId);
    await hrRepository.createNote({
      hrRecordId: hrId,
      body: payload.body,
      authorId: scope.userId ?? null,
    });
    return this.get(userId, scope);
  },

  async addDocument(userId: string, payload: AddDocumentPayload, scope: Scope): Promise<EmployeeDetail> {
    const filter = filterForScope(scope);
    const target = await hrRepository.getOne(userId, filter);
    if (!target) throw new AppError("Employee not found", 404);

    const hrId = await ensureRecordId(userId, scope.orgId);
    await hrRepository.createDocument({
      hrRecordId: hrId,
      name: payload.name,
      category: payload.category ?? "Other",
      status: payload.status ?? "Uploaded",
      url: payload.url ?? null,
      expiresAt: payload.expiresAt ?? null,
      uploadedBy: scope.userId ?? null,
    });
    return this.get(userId, scope);
  },
};
