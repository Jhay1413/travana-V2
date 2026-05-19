import axiosClient from "../client/axios-client";

export type HrStatus = "Active" | "Probation" | "On Leave" | "Terminated";
export type EmploymentType = "Full-time" | "Part-time" | "Contractor";
export type ContractType = "Permanent" | "Fixed-term" | "Casual";
export type LeaveStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";
export type LeaveType = "Annual" | "Sick" | "Unpaid" | "Other";
export type ReminderKind = "probation_end" | "contract_end" | "work_anniversary";
export type InvitableRole = "agent" | "branch_manager" | "homeworker" | "referral_agent";
export type DocumentCategory = "Contract" | "NDA" | "Right to Work" | "Policies" | "Training" | "Other";
export type DocStatus = "Uploaded" | "Missing" | "Expiring Soon";

export interface LeaveEntry {
  id:        string;
  type:      LeaveType;
  from:      string;
  to:        string;
  status:    LeaveStatus;
  reason?:   string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  createdAt: string;
}

export interface DocumentEntry {
  id:          string;
  name:        string;
  category:    DocumentCategory;
  status:      DocStatus;
  /** Present when uploaded as a file; download via the download endpoint. */
  s3Key?:      string | null;
  mimeType?:   string | null;
  size?:       number | null;
  /** External URL when added as a link. */
  url?:        string | null;
  /** YYYY-MM-DD when this credential / certificate expires. */
  expiresAt?:  string | null;
  uploadedAt:  string;
  uploadedBy?: string | null;
}

export interface NoteEntry {
  id:        string;
  body:      string;
  author:    string;
  authorId?: string | null;
  createdAt: string;
}

export interface EmployeeRow {
  userId:                       string;
  name:                         string;
  email:                        string;
  phone:                        string;
  orgRole:                      string;
  branchId:                     string | null;
  branchName:                   string | null;
  address:                      string | null;
  emergencyContactName:         string | null;
  emergencyContactRelationship: string | null;
  emergencyContactPhone:        string | null;
  status:                       HrStatus;
  employmentType:               EmploymentType;
  startDate:                    string | null;
  probationEnd:                 string | null;
  managerUserId:                string | null;
  managerName:                  string | null;
  contractType:                 ContractType | null;
  contractEndDate:              string | null;
  holidayAllowance:             number | null;
  holidayUsedDays:              number;
  holidays:                     LeaveEntry[];
  documents:                    DocumentEntry[];
  notes:                        NoteEntry[];
  salary?:                      string | null;
  salaryCurrency?:              string | null;
  taxId?:                       string | null;
}

export type EmployeeDetail = EmployeeRow;

export interface HrReminder {
  id:           string;
  kind:         ReminderKind;
  userId:       string;
  employeeName: string;
  dueDate:      string;
  daysUntil:    number;
  message:      string;
  severity:     "info" | "warning" | "urgent";
}

export interface UpdateEmployeeInput {
  status?:           HrStatus;
  employmentType?:   EmploymentType;
  startDate?:        string | null;
  probationEnd?:     string | null;
  managerUserId?:    string | null;
  salary?:           string | null;
  salaryCurrency?:   string | null;
  contractType?:     ContractType | null;
  contractEndDate?:  string | null;
  holidayAllowance?: number | null;
  taxId?:            string | null;
}

export interface InviteEmployeeInput {
  email:    string;
  branchId: string;
  orgRole:  InvitableRole;
}

export interface RequestLeaveInput {
  type:    LeaveType;
  from:    string;
  to:      string;
  reason?: string;
}

export const hrApi = {
  listEmployees: async (): Promise<EmployeeRow[]> => {
    const { data } = await axiosClient.get<EmployeeRow[]>("/api/v2/hr/employees");
    return data;
  },
  getEmployee: async (userId: string): Promise<EmployeeDetail> => {
    const { data } = await axiosClient.get<EmployeeDetail>(`/api/v2/hr/employees/${userId}`);
    return data;
  },
  listReminders: async (): Promise<HrReminder[]> => {
    const { data } = await axiosClient.get<HrReminder[]>("/api/v2/hr/reminders");
    return data;
  },
  invite: async (input: InviteEmployeeInput): Promise<{ userId: string; email: string }> => {
    const { data } = await axiosClient.post("/api/v2/hr/employees", input);
    return data;
  },
  update: async (userId: string, input: UpdateEmployeeInput): Promise<EmployeeDetail> => {
    const { data } = await axiosClient.patch<EmployeeDetail>(`/api/v2/hr/employees/${userId}`, input);
    return data;
  },
  requestLeave: async (userId: string, input: RequestLeaveInput): Promise<EmployeeDetail> => {
    const { data } = await axiosClient.post<EmployeeDetail>(`/api/v2/hr/employees/${userId}/leave`, input);
    return data;
  },
  approveLeave: async (userId: string, leaveId: string): Promise<EmployeeDetail> => {
    const { data } = await axiosClient.post<EmployeeDetail>(
      `/api/v2/hr/employees/${userId}/leave/${leaveId}/approve`,
    );
    return data;
  },
  rejectLeave: async (userId: string, leaveId: string): Promise<EmployeeDetail> => {
    const { data } = await axiosClient.post<EmployeeDetail>(
      `/api/v2/hr/employees/${userId}/leave/${leaveId}/reject`,
    );
    return data;
  },
  addNote: async (userId: string, body: string): Promise<EmployeeDetail> => {
    const { data } = await axiosClient.post<EmployeeDetail>(`/api/v2/hr/employees/${userId}/notes`, { body });
    return data;
  },
  addDocument: async (
    userId: string,
    input: {
      name: string;
      url?: string;
      category?: DocumentCategory;
      status?: DocStatus;
      expiresAt?: string | null;
    },
  ): Promise<EmployeeDetail> => {
    const { data } = await axiosClient.post<EmployeeDetail>(
      `/api/v2/hr/employees/${userId}/documents`,
      input,
    );
    return data;
  },
  uploadDocumentFile: async (
    userId: string,
    file: File,
    options: { name?: string; category?: DocumentCategory; expiresAt?: string | null } = {},
  ): Promise<EmployeeDetail> => {
    const fd = new FormData();
    fd.append("file", file);
    if (options.name) fd.append("name", options.name);
    if (options.category) fd.append("category", options.category);
    if (options.expiresAt) fd.append("expiresAt", options.expiresAt);
    const { data } = await axiosClient.post<EmployeeDetail>(
      `/api/v2/hr/employees/${userId}/documents/upload`,
      fd,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  },
  documentDownloadUrl: (userId: string, docId: string): string =>
    `/api/v2/hr/employees/${userId}/documents/${docId}/download`,
  deleteDocument: async (userId: string, docId: string): Promise<EmployeeDetail> => {
    const { data } = await axiosClient.delete<EmployeeDetail>(
      `/api/v2/hr/employees/${userId}/documents/${docId}`,
    );
    return data;
  },

  // ── Self-service: any authenticated user
  getMyRecord: async (): Promise<EmployeeDetail> => {
    const { data } = await axiosClient.get<EmployeeDetail>("/api/v2/hr/me");
    return data;
  },
  requestMyLeave: async (input: RequestLeaveInput): Promise<EmployeeDetail> => {
    const { data } = await axiosClient.post<EmployeeDetail>("/api/v2/hr/me/leave", input);
    return data;
  },
};
