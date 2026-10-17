import type { HomeworkerYear } from "../types";
import { sum, twelve } from "./months";

/** What the homeworker set for themselves, with months they left empty counted as 0. */
export const ownMonths = (h: Pick<HomeworkerYear, "selfMonths">): number[] => twelve(h.selfMonths.map((m) => m ?? 0));

/** The homeworker's own yearly target (kept even while an admin override replaces it). */
export const ownTarget = (h: Pick<HomeworkerYear, "selfMonths">): number => sum(ownMonths(h));

/** The target that counts for the business: the admin override when there is one, else their own. */
export const effectiveTarget = (h: Pick<HomeworkerYear, "months">): number => sum(h.months);
