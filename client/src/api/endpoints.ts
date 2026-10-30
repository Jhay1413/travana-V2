/**
 * Centralized API path constants.
 *
 * Feature API modules (`features/<feature>/api/`) should build their request
 * URLs from these constants instead of hardcoding path strings. This file is
 * populated incrementally as features are migrated to the feature-based
 * structure — start with the shared base prefix.
 */
export const API_V2 = "/api/v2";

export const ORGANIZATION_OVERVIEW_ENDPOINTS = {
  stats: `${API_V2}/organization-overview/stats`,
  agentsPerformance: `${API_V2}/organization-overview/agents-performance`,
  branchesPerformance: `${API_V2}/organization-overview/branches-performance`,
  compare: `${API_V2}/organization-overview/compare`,
  profitSources: `${API_V2}/organization-overview/profit-sources`,
} as const;

export const DEPARTURES_ENDPOINTS = {
  list: `${API_V2}/departures`,
  summary: `${API_V2}/departures/summary`,
  checks: (bookingId: string) => `${API_V2}/departures/${encodeURIComponent(bookingId)}/checks`,
} as const;

export const TOUR_OPERATOR_ENDPOINTS = {
  list: `${API_V2}/tour-operators`,
  manage: `${API_V2}/tour-operators/manage`,
  catalogue: `${API_V2}/tour-operators/catalogue`,
  export: `${API_V2}/tour-operators/export`,
  importPreview: `${API_V2}/tour-operators/import/preview`,
  import: `${API_V2}/tour-operators/import`,
  link: (id: string) => `${API_V2}/tour-operators/${encodeURIComponent(id)}`,
  password: (id: string) => `${API_V2}/tour-operators/${encodeURIComponent(id)}/password`,
} as const;

export const BRANCH_ENDPOINTS = {
  base: `${API_V2}/branches`,
  byId: (id: string) => `${API_V2}/branches/${id}`,
} as const;

export const HOMEWORKER_ENDPOINTS = {
  base: `${API_V2}/homeworkers`,
  me: `${API_V2}/homeworkers/me`,
  meStatement: `${API_V2}/homeworkers/me/statement`,
  statement: (branchId: string) => `${API_V2}/homeworkers/${branchId}/statement`,
  finalise: (branchId: string) => `${API_V2}/homeworkers/${branchId}/statement/finalise`,
  byId: (branchId: string) => `${API_V2}/homeworkers/${branchId}`,
  archive: (branchId: string) => `${API_V2}/homeworkers/${branchId}/archive`,
} as const;

export const ONBOARDING_ENDPOINTS = {
  signup: `${API_V2}/onboarding/signup`,
  state: `${API_V2}/onboarding/state`,
  business: `${API_V2}/onboarding/business`,
  shops: `${API_V2}/onboarding/shops`,
  homeworkerCommission: `${API_V2}/onboarding/homeworker-commission`,
  complete: `${API_V2}/onboarding/complete`,
} as const;

export const TARGETS_ENDPOINTS = {
  year: `${API_V2}/targets/year`,
  business: `${API_V2}/targets/business`,
  mine: `${API_V2}/targets/mine`,
  allocation: `${API_V2}/targets/allocation`,
  homeworkerOverride: (userId: string) => `${API_V2}/targets/homeworkers/${encodeURIComponent(userId)}/override`,
} as const;

export const NEON_CLIENT_ENDPOINTS = {
  portalPin: (clientId: string) => `${API_V2}/neon-clients/${clientId}/portal-pin`,
  passengers: (clientId: string) => `${API_V2}/neon-clients/${clientId}/passengers`,
  passengerLead: (clientId: string) => `${API_V2}/neon-clients/${clientId}/passengers/lead`,
  passenger: (clientId: string, passengerId: string) => `${API_V2}/neon-clients/${clientId}/passengers/${passengerId}`,
} as const;

export const CLIENT_FILE_ENDPOINTS = {
  byClient: (clientId: string) => `${API_V2}/client-files/client/${clientId}`,
  byId: (id: string) => `${API_V2}/client-files/${id}`,
  download: (id: string) => `${API_V2}/client-files/${id}/download`,
  preview: (id: string) => `${API_V2}/client-files/${id}/download?inline=1`,
} as const;

export const AGENT_PROFILE_ENDPOINTS = {
  header: (userId: string) => `${API_V2}/agent-profile/${encodeURIComponent(userId)}`,
  performance: (userId: string) => `${API_V2}/agent-profile/${encodeURIComponent(userId)}/performance`,
  week: (userId: string) => `${API_V2}/agent-profile/${encodeURIComponent(userId)}/week`,
  monthly: (userId: string) => `${API_V2}/agent-profile/${encodeURIComponent(userId)}/monthly`,
  biggestDeals: (userId: string) => `${API_V2}/agent-profile/${encodeURIComponent(userId)}/biggest-deals`,
  training: (userId: string) => `${API_V2}/agent-profile/${encodeURIComponent(userId)}/training`,
  payouts: (userId: string) => `${API_V2}/agent-profile/${encodeURIComponent(userId)}/payouts`,
} as const;

export const QUOTE_ENDPOINTS = {
  accepted: (quoteId: string) => `${API_V2}/quotes/${quoteId}/accepted`,
} as const;

export const QUOTE_SHARE_ENDPOINTS = {
  generateToken: (quoteId: string) => `${API_V2}/quote-share/${quoteId}/generate-token`,
  views: (quoteId: string) => `${API_V2}/quote-share/${quoteId}/views`,
  clientViews: (clientId: string) => `${API_V2}/quote-share/client/${clientId}/views`,
  customerActions: (quoteId: string) => `${API_V2}/quote-share/${quoteId}/customer-actions`,
  sent: (quoteId: string) => `${API_V2}/quote-share/${quoteId}/sent`,
  sendWhatsapp: (quoteId: string) => `${API_V2}/quote-share/${quoteId}/send-whatsapp`,
} as const;
