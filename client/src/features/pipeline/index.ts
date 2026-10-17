export { PipelineBoard } from "./components/pipeline-board";

// Shared primitives and stage-aware money helpers (used by the agent dashboard).
export { StagePill } from "./shared/stage-pill";
export { OperatorTile } from "./shared/operator-tile";
export { FilterChip } from "./shared/filter-chip";
export {
  formatCurrency,
  formatDueDateTime,
  getClientPhone,
  getEnquiryBudget,
  getStageForTransaction,
  getTransactionProfit,
  getTransactionTitle,
  getTransactionValue,
  getTourOperator,
  hasQuoteOrBooking,
} from "./lib/pipeline-helpers";
export type { PipelineStage } from "./lib/pipeline-helpers";

// Button looks shared with other redesigned pages.
export { PRIMARY_ACTION, OUTLINE_ACTION, DANGER_GHOST, AMBER_LINK, ICON_BUTTON } from "./shared/button-styles";
