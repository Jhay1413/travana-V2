import { useCallback, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useShareInput } from "@/features/homeworkers";
import { useSendInvite } from "@/features/invite/api/use-invite-mutations";
import type { InviteOrgRole } from "@/features/invite/api/invite.api";
import { teamErrorMessage } from "../lib/error-message";
import { blankRow, firstError, rowToInviteBody, validateRow, type RowErrors, type ValidationContext } from "../lib/invite-rows";

function defaultRole(allowed: readonly InviteOrgRole[]): InviteOrgRole {
  return allowed.includes("agent") ? "agent" : (allowed[0] ?? "agent");
}

function defaultBranch(ctx: ValidationContext): string {
  return ctx.lockedBranchId ?? ctx.branches.find((b) => b.isDefault)?.id ?? ctx.branches[0]?.id ?? "";
}

/** One-person invite used by the quick card and the Add user dialog. */
export function useSingleInvite(ctx: ValidationContext, opts: { withNames: boolean; onSent?: () => void }) {
  const { toast } = useToast();
  const send = useSendInvite();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteOrgRole>(() => defaultRole(ctx.allowedRoles));
  const [branchPick, setBranchPick] = useState("");
  const [displayName, setDisplayName] = useState("");
  const share = useShareInput();
  const [errors, setErrors] = useState<RowErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Until the person picks one, follow the default/locked branch (the lists may load after first paint).
  const branchId = branchPick || defaultBranch(ctx);
  const homeworker = role === "homeworker";

  const reset = useCallback(() => {
    setFirst("");
    setLast("");
    setEmail("");
    setDisplayName("");
    setBranchPick("");
    setErrors({});
    setFormError(null);
    share.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const row = useMemo(
    () => ({ ...blankRow(), first, last, email, role, branchId: homeworker ? "" : branchId }),
    [first, last, email, role, branchId, homeworker],
  );

  const submit = useCallback(() => {
    setFormError(null);
    const found = validateRow(row, ctx, { requireNames: opts.withNames });
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setFormError(firstError(found));
      return;
    }
    if (homeworker && share.error) {
      setFormError(share.error);
      return;
    }
    setErrors({});
    send.mutate(rowToInviteBody(row, { profitSharePercent: share.value, displayName }), {
      onSuccess: () => {
        toast({ title: "Invite sent", description: `${email.trim()} will receive an email shortly.` });
        reset();
        opts.onSent?.();
      },
      onError: (err: unknown) => setFormError(teamErrorMessage(err, "Couldn't send the invite")),
    });
  }, [row, ctx, opts, send, toast, email, reset, homeworker, share.error, share.value, displayName]);

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setErrors({});
    setFormError(null);
  };

  return {
    values: { first, last, email, role, branchId },
    errors,
    formError,
    homeworker,
    pending: send.isPending,
    setFirst: touch(setFirst),
    setLast: touch(setLast),
    setEmail: touch(setEmail),
    setRole: touch(setRole),
    setBranchId: touch(setBranchPick),
    share,
    displayName,
    setDisplayName: touch(setDisplayName),
    reset,
    submit,
  };
}
