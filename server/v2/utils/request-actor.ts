import type { Request } from 'express';
import { AppError } from './error-handler';
import { getUserId } from '../../utils/get-user-id';

/** Who performed an action, for audit rows and ownership checks. */
export interface RequestActor {
  userId:        string;
  ipAddress:     string | null;
  userAgent:     string | null;
  /** True when a platform admin is acting inside a tenant through impersonation. */
  impersonating: boolean;
}

/** Builds the acting user from an authenticated request; 401 when there is none. */
export function getRequestActor(req: Request): RequestActor {
  const userId = getUserId(req);
  if (!userId) throw new AppError('Unauthorized', 401);
  return {
    userId,
    // req.ip honours the app's "trust proxy" setting; the raw header is client-controlled.
    ipAddress:     req.ip || req.socket?.remoteAddress || null,
    userAgent:     (req.headers?.['user-agent'] as string | undefined) ?? null,
    impersonating: Boolean(req.session?.impersonateOrgId),
  };
}
