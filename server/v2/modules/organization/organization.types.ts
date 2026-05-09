export interface Organization {
  id:           string;
  name:         string;
  slug:         string;
  plan:         'starter' | 'growth' | 'enterprise' | null;
  isActive:     boolean;
  seatLimit:    number | null;
  brandColor:   string | null;
  logoUrl:      string | null;
  settings:     Record<string, unknown>;
  createdAt:    Date;
  trialEndsAt:  Date | null;
}
