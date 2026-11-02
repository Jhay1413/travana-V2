/**
 * Referral agents (an exclusive role: it never combines with internal roles) only use the Affiliate Hub.
 * They get NO access to deals, clients, notes, tasks, tickets, messaging, search, AI or reports, so the
 * gate is default-deny: a referral agent may only reach the mounts listed here, which are the ones the
 * hub and the app shell need (their own profile and settings, notifications, the live feed, HR self
 * service, announcements and hub posts, training, feedback). The /referrals endpoints are for org admins and
 * branch managers only (the Affiliate Hub page keeps its sample referrals in local state), so they are not listed.
 * Everything else under /api/v2 answers 403, including any mount added later.
 */
export const REFERRAL_AGENT_ALLOWED_MOUNTS: readonly string[] = [
  "notifications",
  "settings",
  "hr",
  "realtime",
  "usage",
  "announcements",
  "hub-posts",
  "training",
  "feedback",
  "user-org-roles",
];


/**
 * Single endpoints a referral agent may call inside a mount that is otherwise closed to them: their own
 * profile only (the /users mount also lists the team, which they must not see). Matched on the request path
 * after /api/v2, exactly or followed by a slash.
 */
export const REFERRAL_AGENT_ALLOWED_PATHS: readonly string[] = ["/users/profiles/me"];
