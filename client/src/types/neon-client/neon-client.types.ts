export interface NeonClient {
  id: string;
  title: string | null;
  firstName: string;
  surename: string;
  DOB: string | null;
  phoneNumber: string;
  email: string | null;
  emailIsAllowed: boolean | null;
  VMB: string | null;
  VMBfirstAccess: string | null;
  whatsAppVerified: boolean;
  mailAllowed: boolean | null;
  houseNumber: string | null;
  city: string | null;
  street: string | null;
  country: string | null;
  post_code: string | null;
  avatarUrl: string | null;
  badge: string | null;
  createdAt: string;
  referrerId: string | null;
}

export interface NeonClientImportRow {
  id: string;
  title?: string;
  firstName: string;
  surename: string;
  DOB?: string;
  phoneNumber: string;
  email?: string;
  emailIsAllowed?: boolean;
  VMB?: string;
  VMBfirstAccess?: string;
  whatsAppVerified?: boolean;
  mailAllowed?: boolean;
  houseNumber?: string;
  city?: string;
  street?: string;
  country?: string;
  post_code?: string;
  avatarUrl?: string;
  badge?: string;
  referrerId?: string;
}

export interface ImportResult {
  imported: number;
  errors: Array<{ row: number; id: string; error: string }>;
}
