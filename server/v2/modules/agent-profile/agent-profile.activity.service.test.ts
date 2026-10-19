import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../../utils/error-handler";

vi.mock("./agent-profile.repository", () => ({
  agentProfileRepository: { listMemberships: vi.fn(), listDepartures: vi.fn() },
}));
vi.mock("../task/task.service", () => ({ taskService: { listByUser: vi.fn() } }));
vi.mock("../homeworker/homeworker.repository", () => ({
  homeworkerRepository: { findByOwner: vi.fn(), listStatementsByBranch: vi.fn() },
}));
vi.mock("../homeworker/homeworker.service", () => ({ homeworkerService: { buildStatement: vi.fn() } }));
vi.mock("../training/training-progress.repository", () => ({
  trainingProgressRepository: { listEnrollmentDetailsByUser: vi.fn() },
}));

import { agentProfileActivityService as svc } from "./agent-profile.activity.service";
import { agentProfileRepository as repo } from "./agent-profile.repository";
import { taskService } from "../task/task.service";
import { homeworkerRepository } from "../homeworker/homeworker.repository";
import { homeworkerService } from "../homeworker/homeworker.service";
import { trainingProgressRepository } from "../training/training-progress.repository";

const NOW = new Date("2026-10-19T12:00:00Z");
const admin = { orgId: "o1", branchId: null, orgRole: "org_admin", orgRoles: ["org_admin"], userId: "viewer" } as never;
const manager = { orgId: "o1", branchId: "b1", orgRole: "branch_manager", orgRoles: ["branch_manager"], userId: "viewer" } as never;

const membership = (branchId = "b1") => ({
  branchId, branchName: "North", branchType: "shop", openingPattern: null, orgRole: "agent", isActive: true,
  joinedAt: new Date("2025-01-01T00:00:00Z"),
});
const task = (id: string, dueDate: Date, orgId: string | null) =>
  ({ id, title: id, dueDate, orgId, entityType: "quote", entityId: "q1", clientId: "c1", clientName: "Ann Lee", entityTitle: "Spain" }) as never;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.listMemberships).mockResolvedValue([membership()] as never);
  vi.mocked(repo.listDepartures).mockResolvedValue([]);
  vi.mocked(taskService.listByUser).mockResolvedValue([]);
});

describe("getWeek", () => {
  it("asks for London Monday 00:00 to the next Monday minus 1ms, incomplete tasks only, with the viewer's scope", async () => {
    await svc.getWeek(admin, "u1", "2026-10-19");

    expect(taskService.listByUser).toHaveBeenCalledWith("u1", admin, {
      dueFrom: new Date("2026-10-18T23:00:00.000Z"), // BST midnight
      dueTo: new Date("2026-10-25T23:59:59.999Z"), // clocks go back on the 25th: next Monday 00:00 London is 00:00Z
      incomplete: true,
    });
    expect(repo.listDepartures).toHaveBeenCalledWith({ orgId: "o1", branchId: undefined, userId: "u1" }, "2026-10-19", "2026-10-26");
  });

  it("buckets items into seven days across the BST end, and drops other organisations' and org-less tasks", async () => {
    vi.mocked(taskService.listByUser).mockResolvedValue([
      task("mine", new Date("2026-10-25T10:00:00Z"), "o1"),
      task("legacy", new Date("2026-10-25T11:00:00Z"), null),
      task("foreign", new Date("2026-10-25T12:00:00Z"), "o2"),
    ]);
    vi.mocked(repo.listDepartures).mockResolvedValue([
      { bookingId: "b1", transactionId: "t1", clientId: "c1", clientFirstName: "Ann", clientSurname: "Lee", travelDate: "2026-10-20", title: "Rome" },
    ]);

    const week = await svc.getWeek(admin, "u1", "2026-10-19");

    expect(week.days).toHaveLength(7);
    expect(week.days[1].items).toEqual([expect.objectContaining({ kind: "departure", title: "Rome", clientName: "Ann Lee" })]);
    expect(week.days[6].items.map((i) => i.id)).toEqual(["mine"]);
  });

  it("scopes a manager's departures to their branch and 404s other branches' agents", async () => {
    await svc.getWeek(manager, "u1", "2026-10-19");
    expect(repo.listDepartures).toHaveBeenCalledWith({ orgId: "o1", branchId: "b1", userId: "u1" }, "2026-10-19", "2026-10-26");

    vi.mocked(repo.listMemberships).mockResolvedValue([membership("b9")] as never);
    await expect(svc.getWeek(manager, "u1", "2026-10-19")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("getTraining", () => {
  it("lists the user's courses within the organisation and maps progress", async () => {
    vi.mocked(trainingProgressRepository.listEnrollmentDetailsByUser).mockResolvedValue([
      {
        enrollmentId: "e1", courseId: "c1", title: "Sales", category: "Sales", status: "in_progress",
        enrolledAt: new Date("2026-04-01T00:00:00Z"), completedAt: null, lessonsTotal: 5, lessonsCompleted: 2, certificate: null,
      },
    ]);

    const out = await svc.getTraining(admin, "u1");

    expect(trainingProgressRepository.listEnrollmentDetailsByUser).toHaveBeenCalledWith("u1", "o1");
    expect(out.courses[0]).toMatchObject({ title: "Sales", status: "in_progress", progressPct: 40, lessonsCompleted: 2 });
  });

  it("404s a manager for an agent of another branch before reading enrolments", async () => {
    vi.mocked(repo.listMemberships).mockResolvedValue([membership("b9")] as never);
    await expect(svc.getTraining(manager, "u1")).rejects.toMatchObject({ statusCode: 404 });
    expect(trainingProgressRepository.listEnrollmentDetailsByUser).not.toHaveBeenCalled();
  });
});

describe("getPayouts", () => {
  const branch = { id: "hb1", name: "Ann HW", profitSharePercent: "70.00" };
  const stored = (periodStart: string, periodEnd: string, status: "draft" | "final") =>
    ({
      periodStart, periodEnd, grossProfit: "1000.00", sharePercent: "70.00", homeworkerShare: "700.00", status,
      finalisedAt: status === "final" ? new Date("2026-10-02T00:00:00Z") : null,
    }) as never;
  const live = (finalised: unknown = null) =>
    ({
      period: { from: "2026-10-01", to: "2026-11-01" }, gross: "400.00", sharePercent: "70.00", homeworkerShare: "280.00", finalised,
    }) as never;

  beforeEach(() => {
    vi.mocked(homeworkerRepository.findByOwner).mockResolvedValue(branch as never);
    vi.mocked(homeworkerRepository.listStatementsByBranch).mockResolvedValue([]);
  });

  it("refuses a branch manager even if the route gate were bypassed", async () => {
    await expect(svc.getPayouts(manager, "u1", NOW)).rejects.toMatchObject({ statusCode: 403 });
    expect(homeworkerRepository.listStatementsByBranch).not.toHaveBeenCalled();
  });

  it("404s a user who owns no homeworker branch", async () => {
    vi.mocked(homeworkerRepository.findByOwner).mockResolvedValue(null);
    await expect(svc.getPayouts(admin, "u1", NOW)).rejects.toMatchObject({ statusCode: 404, message: "Not a homeworker" });
  });

  it("puts a live due row first when the current month is not stored, then stored rows (final = paid)", async () => {
    vi.mocked(homeworkerRepository.listStatementsByBranch).mockResolvedValue([stored("2026-09-01", "2026-10-01", "final")]);
    vi.mocked(homeworkerService.buildStatement).mockResolvedValue(live());

    const out = await svc.getPayouts(admin, "u1", NOW);

    expect(homeworkerRepository.listStatementsByBranch).toHaveBeenCalledWith("o1", "hb1");
    expect(homeworkerService.buildStatement).toHaveBeenCalledWith("o1", "hb1");
    expect(out.rows.map((r) => [r.periodStart, r.status, r.live])).toEqual([
      ["2026-10-01", "due", true],
      ["2026-09-01", "paid", false],
    ]);
  });

  it("does not build a live row when the current month is already stored", async () => {
    vi.mocked(homeworkerRepository.listStatementsByBranch).mockResolvedValue([stored("2026-10-01", "2026-11-01", "draft")]);

    const out = await svc.getPayouts(admin, "u1", NOW);

    expect(homeworkerService.buildStatement).not.toHaveBeenCalled();
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ status: "draft", live: false });
  });

  it("treats 'Profit share not set' as no live row but rethrows other errors", async () => {
    vi.mocked(homeworkerService.buildStatement).mockRejectedValueOnce(new AppError("Profit share not set", 400));
    expect((await svc.getPayouts(admin, "u1", NOW)).rows).toEqual([]);

    vi.mocked(homeworkerService.buildStatement).mockRejectedValueOnce(new AppError("Homeworker not found", 404));
    await expect(svc.getPayouts(admin, "u1", NOW)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("a live statement that is already finalised shows as paid", async () => {
    vi.mocked(homeworkerService.buildStatement).mockResolvedValue(live({ status: "final" }));
    expect((await svc.getPayouts(admin, "u1", NOW)).rows[0].status).toBe("paid");
  });
});
