export interface SignupPayload {
  businessName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface SignupResult {
  orgId: string;
  userId: string;
  branchIds: string[];
  message: string;
  /** True only when the owner verification email was handed to a real (non-console) provider without error. */
  emailSent: boolean;
}
