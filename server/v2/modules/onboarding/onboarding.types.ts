export interface SignupPayload {
  agencyName: string;
  slug:       string;
  brandColor?: string;
  logoUrl?:   string;
  firstName:  string;
  lastName:   string;
  email:      string;
  password:   string;
}

export interface SignupResult {
  orgId:   string;
  userId:  string;
  message: string;
}
