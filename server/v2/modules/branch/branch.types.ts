export interface Branch {
  id:             string;
  organizationId: string;
  name:           string;
  code:           string | null;
  address:        string | null;
  phone:          string | null;
  isDefault:      boolean;
  createdAt:      Date;
}
