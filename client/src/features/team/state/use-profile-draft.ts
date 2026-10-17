import { useCallback, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { OrgMember } from "@/features/organization/api/organization.api";
import { useUpdateMemberProfile } from "../api/use-team-mutations";
import { teamErrorMessage } from "../lib/error-message";
import {
  draftFromMember,
  isProfileDirty,
  profilePatch,
  validateChanges,
  type ProfileDraft,
  type ProfileErrors,
} from "../lib/profile-fields";

export interface SaveResult {
  ok: boolean;
  /** True when validation failed (the Details tab must be shown). */
  invalid: boolean;
}

/** Editable first name, last name and phone for the drawer, saved through PATCH /members/:id/profile. */
export function useProfileDraft(member: OrgMember) {
  const { toast } = useToast();
  const update = useUpdateMemberProfile();
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromMember(member));
  const [errors, setErrors] = useState<ProfileErrors>({});

  const dirty = useMemo(() => isProfileDirty(member, draft), [member, draft]);

  const setField = useCallback(<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }, []);

  const save = useCallback(async (): Promise<SaveResult> => {
    const found = validateChanges(member, draft);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return { ok: false, invalid: true };
    }
    const patch = profilePatch(member, draft);
    if (Object.keys(patch).length === 0) return { ok: true, invalid: false };
    try {
      await update.mutateAsync({ userId: member.user.id, ...patch });
      toast({ title: "Changes saved", description: `${draft.first.trim()} ${draft.last.trim()}`.trim() });
      return { ok: true, invalid: false };
    } catch (err) {
      toast({ title: "Couldn't save", description: teamErrorMessage(err, "Something went wrong"), variant: "destructive" });
      return { ok: false, invalid: false };
    }
  }, [draft, member, update, toast]);

  return { draft, errors, dirty, setField, save, saving: update.isPending };
}

export type ProfileDraftApi = ReturnType<typeof useProfileDraft>;
