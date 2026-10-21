import type { CopyApi } from "../state/use-copy-toast";
import type { OperatorFormValues, OrgOperatorRow } from "../types";

/** Everything a row (table) or card needs, so the two layouts stay in step. */
export interface RowContext extends CopyApi {
  canWrite: boolean;
  canSeePasswords: boolean;
  busy: boolean;
  existing: Array<{ linkId: string; name: string }>;
  editLinkId: string | null;
  confirmLinkId: string | null;
  onEdit: (linkId: string | null) => void;
  onAskDelete: (linkId: string | null) => void;
  onSave: (row: OrgOperatorRow, values: OperatorFormValues) => void;
  onDelete: (row: OrgOperatorRow) => void;
}
