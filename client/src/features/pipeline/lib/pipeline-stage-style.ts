import type { PipelineStage } from "./pipeline-helpers";

export interface StageStyle {
  /** Short label used in pills and the stepper. */
  pill: string;
  /** Pill / count-chip colours (design tokens). */
  chipClass: string;
  /** 3px top bar of the column. */
  barClass: string;
}

export const STAGE_STYLE: Record<PipelineStage, StageStyle> = {
  Enquiry: { pill: "Enquiry", chipClass: "bg-stage-enquiry-bg text-stage-enquiry-fg", barClass: "bg-stage-enquiry-dot" },
  Quoted: { pill: "Quoted", chipClass: "bg-stage-quoted-bg text-stage-quoted-fg", barClass: "bg-stage-quoted-dot" },
  "In Play": { pill: "In-Play", chipClass: "bg-stage-inplay-bg text-stage-inplay-fg", barClass: "bg-stage-inplay-dot" },
  Booked: { pill: "Booked", chipClass: "bg-stage-booked-bg text-stage-booked-fg", barClass: "bg-stage-booked-dot" },
  Future: { pill: "Future", chipClass: "bg-stage-future-bg text-stage-future-fg", barClass: "bg-stage-future-dot" },
  Lost: { pill: "Lost", chipClass: "bg-stage-lost-bg text-stage-lost-fg", barClass: "bg-stage-lost-dot" },
};

/** The four steps of the drawer's stage stepper. */
export const STEPPER_STAGES: PipelineStage[] = ["Enquiry", "Quoted", "In Play", "Booked"];

const NEXT_STAGE: Partial<Record<PipelineStage, PipelineStage>> = {
  Enquiry: "Quoted",
  Quoted: "In Play",
  "In Play": "Booked",
};

/** The stage a deal advances to with the primary "Move to …" action, or null. */
export function nextStage(stage: PipelineStage): PipelineStage | null {
  return NEXT_STAGE[stage] ?? null;
}

/** Index of the stage in the stepper, or -1 for Future / Lost (not on the stepper). */
export function stepperIndex(stage: PipelineStage): number {
  return STEPPER_STAGES.indexOf(stage);
}

/** Enquiry / Quoted / In Play — the columns that make up "open deals". */
export function isOpenStage(stage: PipelineStage): boolean {
  return stage === "Enquiry" || stage === "Quoted" || stage === "In Play";
}
