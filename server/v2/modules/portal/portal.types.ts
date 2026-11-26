import type { PortalBookingListItem } from '@shared/portal-bookings';
import type { Request } from 'express';
import type { PortalTokenPayload } from './portal-auth';

/** An Express request that has passed the portal session middleware. */
export interface PortalRequest extends Request {
  portalClient: PortalTokenPayload;
}

export interface LoginInput {
  email: string;
  pin: string;
  /** Optional agency slug; when present only that agency's clients are candidates. */
  orgSlug?: string;
  /**
   * Remembered agency from the device. Never filters candidates: it only breaks a
   * tie between accounts whose PIN matches. Stale or unknown values change nothing.
   */
  preferOrgSlug?: string;
}

export interface LoginResult {
  token: string;
  clientId: string;
  firstName: string | null;
  hasBiometric: boolean;
  /** True when the server could not check for existing Face ID credentials; the page must not offer set-up then. */
  biometricCheckFailed: boolean;
  mustChangePin: boolean;
}

export interface MagicLoginResult {
  token: string;
  clientId: string;
  firstName: string | null;
  mustChangePin: boolean;
}

export interface BiometricLoginResult {
  token: string;
  clientId: string;
  firstName: string | null;
  mustChangePin: boolean;
}

export interface WebauthnCredentialRow {
  id: string;
  clientId: string;
  credentialId: string;
  /** base64url COSE public key (only meaningful when verifiedAt is set). */
  publicKey: string;
  counter: number;
  /** JSON array of transports, or null. */
  transports: string | null;
  verifiedAt: Date | null;
}

/** Options + the signed challenge token the browser must send back with its response. */
export interface WebauthnOptionsResult<TOptions> {
  options: TOptions;
  challengeToken: string;
}

export interface WebauthnCheckResult {
  hasBiometric: boolean;
  devices?: Array<{ id: string; deviceName: string | null }>;
}

export interface LoginCandidate {
  id: string;
  email: string | null;
  firstName: string | null;
  portalPin: string | null;
  mustChangePin: boolean;
  orgId: string | null;
}

export interface PortalDealDto {
  id: string;
  token: string | null;
  title: string;
  destination: string;
  country: string | null;
  hotel: string;
  price: number;
  travel_date: string | Date | null;
  num_nights: number | null;
  image_url: string;
  quote_url: string | null;
  tags: string[];
  portal_added_at: string | null;
}

export interface PortalDealFiltersDto {
  countries: string[];
  popularTags: Array<{ tag: string; count: number }>;
}

/** One booking in the portal list (the shape is shared with the client, see shared/portal-bookings.ts). */
export type PortalBookingDto = PortalBookingListItem;

export interface PortalMessageDto {
  id: string;
  sender: 'agent' | 'client';
  agent_name?: string;
  text: string;
  timestamp: string;
}

export interface ListDealsInput {
  country?: string;
  tag?: string;
  recent: boolean;
  interests: boolean;
  authorizationHeader: string | undefined;
  orgSlug?: string;
}

export interface DealFiltersInput {
  authorizationHeader: string | undefined;
  orgSlug?: string;
}

export interface QuoteViewMeta {
  userAgent: string;
  ipAddress: string;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
