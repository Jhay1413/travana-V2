import { useCallback } from "react";
import { useSaveHomeworkerCommission } from "../api/use-onboarding-mutations";
import { defaultBranch } from "../lib/branches";
import { planAgentInvites, planTeamInvites, type PlannedInvite, type ValidPerson } from "../lib/invite-plan";
import { addEmails, displayResults } from "../lib/sent";
import { commissionChange, commissionSchema, commissionValue } from "../lib/schemas";
import { validateObject } from "../lib/validation";
import { requestErrorMessage } from "@/lib/request-error";
import { useOnboarding } from "./onboarding-context";
import { useInviteSender } from "./use-invite-sender";

export interface SendPeopleOutcome {
  sent: number;
  failed: number;
  /** Set when nothing was sent because of a setup problem (no branch, commission not saved). */
  error?: string;
}

/**
 * Sends the validated people from the single-shop agents table or the multi-shop team table.
 * Sent emails are saved into the wizard draft so a reload or a step change never re-invites anyone.
 */
export function useSendPeople(kind: "agents" | "team") {
  const { state, server, patch } = useOnboarding();
  const sender = useInviteSender();
  const saveCommission = useSaveHomeworkerCommission();
  const { send } = sender;
  const { sentEmails, managerInvited, commission: commissionText } = state;
  const savedCommission = server.homeworkerCommission;
  const ownerEmail = server.owner.email;
  const defaultBranchId = defaultBranch(server.branches)?.id;
  const { mutateAsync: persistCommission } = saveCommission;

  /** Saves the typed commission when it differs from the saved one (including clearing it). Returns an error message or undefined. */
  const saveCommissionIfChanged = useCallback(async (): Promise<string | undefined> => {
    const check = validateObject(commissionSchema, commissionText);
    if (check.data === null) return check.errors[""] ?? "Enter a whole percentage from 0 to 100.";
    const change = commissionChange(commissionText, savedCommission);
    if (!change.save) return undefined;
    try {
      await persistCommission(change.value);
      return undefined;
    } catch (error) {
      return requestErrorMessage(error, "We couldn't save the homeworker commission. Try again.");
    }
  }, [commissionText, savedCommission, persistCommission]);

  const sendPeople = useCallback(
    async (people: ValidPerson[]): Promise<SendPeopleOutcome> => {
      let planned: PlannedInvite[];
      if (kind === "agents") {
        if (!defaultBranchId) {
          return { sent: 0, failed: 0, error: "We couldn't find your shop. Refresh the page and try again." };
        }
        planned = planAgentInvites(people, defaultBranchId, ownerEmail);
      } else {
        const error = await saveCommissionIfChanged();
        if (error) return { sent: 0, failed: 0, error };
        planned = planTeamInvites(people, commissionValue(commissionText), ownerEmail);
      }
      const outcome = await send(planned);
      if (outcome.sentEmails.length > 0) patch({ sentEmails: addEmails(sentEmails, outcome.sentEmails) });
      return { sent: outcome.sent, failed: outcome.failed };
    },
    [kind, defaultBranchId, ownerEmail, commissionText, saveCommissionIfChanged, send, patch, sentEmails],
  );

  /** Table results: persisted "Invited" standing plus this session's live results. */
  const resultsFor = useCallback(
    (rows: { id: string; email: string }[]) => displayResults(rows, sender.results, sentEmails, managerInvited),
    [sender.results, sentEmails, managerInvited],
  );

  return { sendPeople, saveCommissionIfChanged, resultsFor, sending: sender.sending || saveCommission.isPending };
}
