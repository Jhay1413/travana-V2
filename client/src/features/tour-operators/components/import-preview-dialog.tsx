import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";
import { STATUS_LABEL, STATUS_TONE, importButtonLabel, importableCount, previewCommission, previewSubtitle } from "../lib/import-preview";
import type { PendingImport } from "../state/use-operator-import";
import { TD, TH } from "./classes";

interface ImportPreviewDialogProps {
  pending: PendingImport | null;
  importing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** "Check the import": every row and what will happen to it, before anything is saved. */
export function ImportPreviewDialog({ pending, importing, onConfirm, onCancel }: ImportPreviewDialogProps) {
  const count = pending ? importableCount(pending.preview.rows) : 0;
  return (
    <Dialog open={!!pending} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-[760px]" data-testid="dialog-import-preview">
        <DialogHeader>
          <DialogTitle className="text-[20px]">Check the import</DialogTitle>
          <DialogDescription>{pending ? previewSubtitle(pending.fileName, pending.preview) : ""}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[380px] overflow-auto">
          <table className="w-full min-w-[600px] border-collapse">
            <caption className="sr-only">Rows in the file and what will happen to each</caption>
            <thead>
              <tr>
                <th scope="col" className={TH}>Row</th>
                <th scope="col" className={TH}>Tour Operator</th>
                <th scope="col" className={`${TH} text-right`}>Commission</th>
                <th scope="col" className={TH}>What happens</th>
              </tr>
            </thead>
            <tbody>
              {pending?.preview.rows.map((r) => (
                <tr key={r.line} className="border-t border-social-border">
                  <td className={`${TD} tabular-nums`}>{r.line}</td>
                  <td className={`${TD} whitespace-normal`}>
                    <b className="font-semibold">{r.name || "(no name)"}</b>
                    {r.message && <div className="text-[12px] text-status-failed-fg">{r.message}</div>}
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>{previewCommission(r.commission)}</td>
                  <td className={TD}>
                    <StatusPill tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" className={PRIMARY_ACTION} disabled={count === 0 || importing} onClick={onConfirm} data-testid="button-confirm-import">
            {importButtonLabel(count)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
