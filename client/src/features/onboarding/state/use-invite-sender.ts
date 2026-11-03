import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { inviteApi } from "@/features/invite";
import { organizationKeys } from "@/features/organization";
import { onboardingKeys } from "../api/use-onboarding-queries";
import { sendInvitesSequentially, sentEmailsOf, type PlannedInvite } from "../lib/invite-plan";
import type { InviteResult } from "../types";

export interface SendOutcome {
  sent: number;
  failed: number;
  /** Lower-cased emails that were sent in this call. */
  sentEmails: string[];
}

/** Sends planned invites one by one through the existing invite endpoint, tracking each row's result. */
export function useInviteSender() {
  const qc = useQueryClient();
  const [results, setResults] = useState<Record<string, InviteResult>>({});
  const [sending, setSending] = useState(false);

  const send = useCallback(
    async (planned: PlannedInvite[]): Promise<SendOutcome> => {
      setSending(true);
      // Rows being retried drop their old error straight away.
      setResults((prev) => {
        const next = { ...prev };
        for (const p of planned) delete next[p.rowId];
        return next;
      });
      try {
        const done = await sendInvitesSequentially(
          planned,
          (body) => inviteApi.send(body),
          (rowId, result) => setResults((prev) => ({ ...prev, [rowId]: result })),
        );
        const sentEmails = sentEmailsOf(planned, done);
        if (sentEmails.length > 0) {
          qc.invalidateQueries({ queryKey: organizationKeys.members() });
          qc.invalidateQueries({ queryKey: onboardingKeys.state() });
        }
        return { sent: sentEmails.length, failed: planned.length - sentEmails.length, sentEmails };
      } finally {
        setSending(false);
      }
    },
    [qc],
  );

  return { results, sending, send };
}
