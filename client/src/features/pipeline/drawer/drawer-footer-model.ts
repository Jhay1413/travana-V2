import type { PipelineStage } from "@/features/pipeline/lib/pipeline-helpers";

export interface DrawerFooterModel {
  /** The primary button always opens the full deal; moves happen on the board or the deal page. */
  primaryLabel: "Open full deal";
  /** Lost and Booked deals cannot be marked as lost. */
  canMarkLost: boolean;
  /** True when the deal's client was soft-deleted and the viewer may not open it. */
  openDisabled: boolean;
  /** Shown as the button label and tooltip when open is disabled. */
  disabledLabel: "Client deleted" | null;
}

export interface DrawerFooterViewer {
  clientDeleted?: boolean;
  /** Admins (same rule as canDeleteClient) may still open a deleted client's deal, read-only. */
  canOpenDeletedClient?: boolean;
}

export function drawerFooterModel(stage: PipelineStage, viewer: DrawerFooterViewer = {}): DrawerFooterModel {
  const openDisabled = !!viewer.clientDeleted && !viewer.canOpenDeletedClient;
  return {
    primaryLabel: "Open full deal",
    canMarkLost: stage !== "Lost" && stage !== "Booked",
    openDisabled,
    disabledLabel: openDisabled ? "Client deleted" : null,
  };
}
