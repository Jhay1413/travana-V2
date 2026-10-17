import { rowToInviteBody, type InviteRow } from "@/features/team";
import { requestErrorMessage } from "@/lib/request-error";
import type { SendInvitePayload } from "@/features/invite";
import { HOMEWORKER_SHOP } from "./roles";
import type { Agent, TeamMember } from "./schemas";
import type { InviteResult, RoleValue } from "../types";

/** A validated person, keyed by the table row it came from. */
export interface ValidPerson {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: RoleValue;
  /** Team step only: a branch id or the homeworker sentinel. */
  shop?: string;
}

export interface PlannedInvite {
  rowId: string;
  email: string;
  body: SendInvitePayload;
}

export function validPerson(id: string, data: Agent | TeamMember): ValidPerson {
  return { id, ...data };
}

const sameEmail = (a: string, b: string | null | undefined): boolean =>
  !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

function toInviteRow(p: ValidPerson, role: InviteRow["role"], branchId: string): InviteRow {
  return {
    id: p.id,
    first: p.firstName,
    last: p.lastName,
    email: p.email,
    role,
    branchId,
    branchText: "",
    roleIssue: "",
  };
}

/** Single shop: everyone joins the default branch. The owner is never invited. */
export function planAgentInvites(
  people: ValidPerson[],
  defaultBranchId: string,
  ownerEmail: string | null | undefined,
): PlannedInvite[] {
  return people
    .filter((p) => !sameEmail(p.email, ownerEmail))
    .map((p) => ({
      rowId: p.id,
      email: p.email,
      body: rowToInviteBody(toInviteRow(p, p.role, defaultBranchId)),
    }));
}

/**
 * Multi shop: each person joins their chosen shop. Homeworker rows ignore the role and
 * carry the homeworker commission as their profit share. The owner is never invited.
 */
export function planTeamInvites(
  people: ValidPerson[],
  homeworkerCommission: number | null,
  ownerEmail: string | null | undefined,
): PlannedInvite[] {
  return people
    .filter((p) => !sameEmail(p.email, ownerEmail))
    .map((p) => {
      if (p.shop === HOMEWORKER_SHOP) {
        const share = homeworkerCommission === null ? "" : String(homeworkerCommission);
        return {
          rowId: p.id,
          email: p.email,
          body: rowToInviteBody(toInviteRow(p, "homeworker", ""), { profitSharePercent: share }),
        };
      }
      return {
        rowId: p.id,
        email: p.email,
        body: rowToInviteBody(toInviteRow(p, p.role, p.shop ?? "")),
      };
    });
}

/**
 * Send invites one at a time (the server enforces seat limits per call), reporting each result
 * as it lands. A failed invite never stops the rest.
 */
export async function sendInvitesSequentially(
  planned: PlannedInvite[],
  send: (body: SendInvitePayload) => Promise<unknown>,
  onResult: (rowId: string, result: InviteResult) => void,
): Promise<Record<string, InviteResult>> {
  const results: Record<string, InviteResult> = {};
  for (const item of planned) {
    let result: InviteResult;
    try {
      await send(item.body);
      result = { status: "sent" };
    } catch (err) {
      result = { status: "error", message: requestErrorMessage(err, "We couldn't send this invite.") };
    }
    results[item.rowId] = result;
    onResult(item.rowId, result);
  }
  return results;
}

export function countSent(results: Record<string, InviteResult>): number {
  return Object.values(results).filter((r) => r.status === "sent").length;
}

/** Lower-cased emails of the planned invites that were sent. */
export function sentEmailsOf(planned: PlannedInvite[], results: Record<string, InviteResult>): string[] {
  return planned.filter((p) => results[p.rowId]?.status === "sent").map((p) => p.email.trim().toLowerCase());
}
