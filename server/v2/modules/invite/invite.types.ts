export interface Invite {
  id:        string;
  orgId:     string;
  branchId:  string;
  email:     string;
  orgRole:   string;
  token:     string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}
