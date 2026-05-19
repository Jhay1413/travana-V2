export type HrStatus = "Active" | "Probation" | "On Leave" | "Terminated";
export type EmploymentType = "Full-time" | "Part-time" | "Contractor";
export type ContractType = "Permanent" | "Fixed-term" | "Casual";
export type LeaveStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";
export type LeaveType = "Annual" | "Sick" | "Unpaid" | "Other";
export type ReminderKind = "probation_end" | "contract_end" | "work_anniversary";
export type DocumentCategory = "Contract" | "NDA" | "Right to Work" | "Policies" | "Training" | "Other";
export type DocStatus = "Uploaded" | "Missing" | "Expiring Soon";

export interface LeaveEntry {
  id: string;
  type: LeaveType;
  from: string;        // YYYY-MM-DD
  to: string;          // YYYY-MM-DD
  status: LeaveStatus;
  reason?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  createdAt: string;
}

export interface DocumentEntry {
  id: string;
  name: string;
  category: DocumentCategory;
  status: DocStatus;
  /** S3 object key when the doc was uploaded as a file. */
  s3Key?: string | null;
  mimeType?: string | null;
  size?: number | null;
  /** External URL when the doc was added as a link (legacy / non-file). */
  url?: string | null;
  /** YYYY-MM-DD when this credential / certificate expires. */
  expiresAt?: string | null;
  uploadedAt: string;
  uploadedBy?: string | null;
}

export interface NoteEntry {
  id: string;
  body: string;
  author: string;
  authorId?: string | null;
  createdAt: string;
}

export interface EmployeeRow {
  userId: string;
  name: string;
  email: string;
  phone: string;
  orgRole: string;
  branchId: string | null;
  branchName: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactPhone: string | null;
  status: HrStatus;
  employmentType: EmploymentType;
  startDate: string | null;
  probationEnd: string | null;
  managerUserId: string | null;
  managerName: string | null;
  contractType: ContractType | null;
  contractEndDate: string | null;
  holidayAllowance: number | null;
  holidayUsedDays: number;
  holidays: LeaveEntry[];
  documents: DocumentEntry[];
  notes: NoteEntry[];
  // Sensitive — only org_admin / platform_admin see these:
  salary?: string | null;
  salaryCurrency?: string | null;
  taxId?: string | null;
}

export type EmployeeDetail = EmployeeRow;

export interface HrReminder {
  id: string;
  kind: ReminderKind;
  userId: string;
  employeeName: string;
  dueDate: string;       // YYYY-MM-DD
  daysUntil: number;
  message: string;
  severity: "info" | "warning" | "urgent";
}

export type InvitableRole = "agent" | "branch_manager" | "homeworker" | "referral_agent";

export interface InviteEmployeePayload {
  email: string;
  branchId: string;
  orgRole: InvitableRole;
}

export interface UpdateEmployeePayload {
  status?: HrStatus;
  employmentType?: EmploymentType;
  startDate?: string | null;
  probationEnd?: string | null;
  managerUserId?: string | null;
  salary?: string | null;
  salaryCurrency?: string | null;
  contractType?: ContractType | null;
  contractEndDate?: string | null;
  holidayAllowance?: number | null;
  taxId?: string | null;
}

export interface RequestLeavePayload {
  type: LeaveType;
  from: string;
  to: string;
  reason?: string;
}

export interface AddNotePayload {
  body: string;
}

export interface AddDocumentPayload {
  name: string;
  url?: string;
  category?: DocumentCategory;
  status?: DocStatus;
  expiresAt?: string | null;
}

export interface UploadDocumentFileOptions {
  displayName?: string;
  category?: DocumentCategory;
  expiresAt?: string | null;
}
