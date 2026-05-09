import type { User } from '@shared/schema';

declare global {
  namespace Express {
    interface Request {
      orgId:    string;
      branchId: string | null;
      orgRole:  string;
      user?: User & { authType?: string; userId?: string; claims?: { sub?: string } };
    }
  }
}

export {};
