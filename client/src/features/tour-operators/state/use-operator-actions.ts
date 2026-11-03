import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { requestErrorMessage } from "@/lib/request-error";
import { useCreateOperator, useRemoveOperator, useUpdateOperator } from "../api/use-tour-operators-manage";
import { toCreatePayload, toPatchPayload } from "../lib/form-validation";
import type { OperatorFormValues, OrgOperatorRow } from "../types";

/** Add, save and delete with the design's toasts. Each resolves true when it worked. */
export function useOperatorActions() {
  const { toast } = useToast();
  const create = useCreateOperator();
  const update = useUpdateOperator();
  const remove = useRemoveOperator();

  const failed = useCallback(
    (title: string, err: unknown) => toast({ title, description: requestErrorMessage(err, "Please try again."), variant: "destructive" }),
    [toast],
  );

  const add = useCallback(
    async (values: OperatorFormValues, catalogueId: string | null): Promise<boolean> => {
      try {
        const created = await create.mutateAsync(toCreatePayload(values, catalogueId));
        toast({ title: `${created?.name ?? values.name.trim()} added` });
        return true;
      } catch (err) {
        failed("Couldn't add that tour operator", err);
        return false;
      }
    },
    [create, failed, toast],
  );

  const save = useCallback(
    async (row: OrgOperatorRow, values: OperatorFormValues): Promise<boolean> => {
      try {
        const payload = toPatchPayload(values, row);
        // Nothing changed: the server rejects an empty patch, and there is nothing to save.
        if (Object.keys(payload).length > 0) await update.mutateAsync({ linkId: row.linkId, payload });
        toast({ title: `${values.name.trim()} saved` });
        return true;
      } catch (err) {
        failed("Couldn't save your changes", err);
        return false;
      }
    },
    [update, failed, toast],
  );

  const del = useCallback(
    async (row: OrgOperatorRow): Promise<boolean> => {
      try {
        await remove.mutateAsync(row.linkId);
        toast({ title: `${row.name} deleted` });
        return true;
      } catch (err) {
        failed("Couldn't delete that tour operator", err);
        return false;
      }
    },
    [remove, failed, toast],
  );

  return { add, save, del, busy: create.isPending || update.isPending || remove.isPending };
}
