import 'express-session';

declare module 'express-session' {
  interface SessionData {
    // Platform-admin impersonation shadow flags. Set by POST /platform-admin/.../impersonate
    // and cleared by DELETE /platform-admin/impersonate. Honored by orgBranchScope +
    // resolveOrgAndBranchForUser ONLY when the requesting user is a platform_admin.
    impersonateOrgId?:    string;
    impersonateActorId?:  string;
  }
}
