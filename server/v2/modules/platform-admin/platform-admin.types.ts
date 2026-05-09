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
