export interface OrgSummary {
  id:        string;
  name:      string;
  slug:      string;
  plan:      string | null;
  isActive:  boolean;
  seatLimit: number | null;
  createdAt: Date;
  userCount: number;
  branchCount: number;
}

export interface AdminUserRow {
  id:        string;
  name:      string;
  email:     string;
  firstName: string;
  lastName:  string;
  role:      string;
  orgRole:   string | null;
  orgId:     string | null;
  banned:    boolean | null;
  createdAt: Date;
}

export interface AdminBranchRow {
  id:          string;
  name:        string;
  code:        string | null;
  isDefault:   boolean;
  isActive:    boolean;
  branchType:  string;
  createdAt:   Date;
  memberCount: number;
}
