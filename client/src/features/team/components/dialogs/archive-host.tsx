import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArchiveConfirm, useHomeworkers } from "@/features/homeworkers";
import { useToast } from "@/hooks/use-toast";
import { organizationKeys } from "@/features/organization/api/use-organization-queries";

/**
 * Homeworkers are archived, not removed. Mounted only while an archive is requested, so the
 * homeworker list (admin only) is not fetched for everyone who opens Teams & Roles.
 */
export function ArchiveHost({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isSuccess } = useHomeworkers(false);
  const item = data?.find((h) => h.owner.userId === userId) ?? null;
  const checked = useRef(false);

  // Only the first lookup counts: once archived they drop out of this list, which is not an error.
  useEffect(() => {
    if (!isSuccess || checked.current) return;
    checked.current = true;
    if (!item) {
      toast({ title: "Nothing to archive", description: "That homeworker is already archived or still has a pending invite." });
      onClose();
    }
  }, [isSuccess, item, onClose, toast]);

  return (
    <ArchiveConfirm
      homeworker={item}
      onClose={() => {
        // Archiving deactivates their branch membership, which the roster shows as Suspended.
        qc.invalidateQueries({ queryKey: organizationKeys.members() });
        onClose();
      }}
    />
  );
}
