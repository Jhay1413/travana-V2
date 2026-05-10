import type { Request } from "express";
import { getUserId } from "./get-user-id";

export type OrgRole =
  | "platform_admin"
  | "org_admin"
  | "branch_manager"
  | "agent"
  | "homeworker"
  | "referral_agent";

export interface Scope {
  orgId: string;
  branchId: string | null;
  orgRole: OrgRole;
  userId: string | null;
}

export function getScope(req: Request): Scope {
  return {
    orgId: req.orgId,
    branchId: req.branchId,
    orgRole: (req.orgRole || "agent") as OrgRole,
    userId: getUserId(req),
  };
}
