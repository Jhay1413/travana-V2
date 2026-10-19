import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";
import { londonMidnight } from "../../utils/uk-time";
import { taskService } from "../task/task.service";
import { homeworkerRepository } from "../homeworker/homeworker.repository";
import { homeworkerService } from "../homeworker/homeworker.service";
import { trainingProgressRepository } from "../training/training-progress.repository";
import { agentProfileRepository } from "./agent-profile.repository";
import { loadSubjectContext } from "./agent-profile.context";
import { addDaysYmd, bucketWeek, buildPayoutRows, toCourse, type LiveStatement } from "./agent-profile.math";
import type { AgentProfilePayouts, AgentProfileTraining, AgentProfileWeek } from "./agent-profile.types";

const PROFIT_SHARE_NOT_SET = "Profit share not set";

/** First day of the current UTC month, the period the statement builder defaults to. */
function currentStatementStart(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export const agentProfileActivityService = {
  /**
   * Departures (bookings travelling that day, not lost) and incomplete tasks due that day for the
   * Monday-Sunday London week starting `start`. Tasks inherit the task module's own filters (viewer
   * scope, no booking-type tasks, no tasks on lost or booked deals); other-organisation tasks drop out.
   */
  async getWeek(scope: Scope, userId: string, start: string): Promise<AgentProfileWeek> {
    const ctx = await loadSubjectContext(scope, userId);
    const nextMonday = addDaysYmd(start, 7);
    const dueFrom = londonMidnight(start);
    const dueTo = new Date(londonMidnight(nextMonday).getTime() - 1);

    const [departures, tasks] = await Promise.all([
      agentProfileRepository.listDepartures(ctx.subjectFilter, start, nextMonday),
      taskService.listByUser(userId, scope, { dueFrom, dueTo, incomplete: true }),
    ]);
    const inOrg = tasks.filter((t) => t.orgId === ctx.access.orgId);
    return bucketWeek(start, departures, inOrg);
  },

  /** Courses the subject is enrolled in (global courses and this organisation's own). */
  async getTraining(scope: Scope, userId: string): Promise<AgentProfileTraining> {
    const ctx = await loadSubjectContext(scope, userId);
    const rows = await trainingProgressRepository.listEnrollmentDetailsByUser(userId, ctx.access.orgId);
    return { courses: rows.map(toCourse) };
  },

  /**
   * Homeworker payouts, owners and admins only. Stored statements plus a live row for the current
   * month when that month has not been stored yet. A branch without a profit share has no live row.
   */
  async getPayouts(scope: Scope, userId: string, now: Date = new Date()): Promise<AgentProfilePayouts> {
    const ctx = await loadSubjectContext(scope, userId);
    if (!ctx.access.canSeePay) throw new AppError("Only owners and admins can see pay", 403);

    const branch = await homeworkerRepository.findByOwner(ctx.access.orgId, userId);
    if (!branch) throw new AppError("Not a homeworker", 404);

    const stored = await homeworkerRepository.listStatementsByBranch(ctx.access.orgId, branch.id);
    const currentStart = currentStatementStart(now);

    let live: LiveStatement | null = null;
    if (!stored.some((s) => s.periodStart === currentStart)) {
      try {
        const result = await homeworkerService.buildStatement(ctx.access.orgId, branch.id);
        live = {
          periodStart: result.period.from,
          periodEnd: result.period.to,
          gross: result.gross,
          sharePercent: result.sharePercent,
          homeworkerShare: result.homeworkerShare,
          finalised: result.finalised !== null && result.finalised.status === "final",
        };
      } catch (err) {
        if (!(err instanceof AppError && err.statusCode === 400 && err.message === PROFIT_SHARE_NOT_SET)) throw err;
      }
    }

    return {
      branchId: branch.id,
      branchName: branch.name,
      sharePercent: branch.profitSharePercent,
      rows: buildPayoutRows(stored, live, currentStart),
    };
  },
};
