import type { User } from '@shared/schema';

declare global {
  namespace Express {
    interface Request {
      orgId:    string;
      branchId: string | null;
      orgRole:  string;          // primary role (highest-ranked from orgRoles) — back-compat
      orgRoles: string[];        // full union of the user's roles for this org
      user?: User & { authType?: string; userId?: string; claims?: { sub?: string } };
    }
  }
}

export {};
