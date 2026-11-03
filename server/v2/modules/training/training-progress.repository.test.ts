import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { trainingProgressRepository } from "./training-progress.repository";
import { renderWhere, resetCapture, setRows } from "../../test/capture-db";

beforeEach(() => resetCapture());

describe("trainingProgressRepository.listEnrollmentDetailsByUser", () => {
  it("filters by user and only global or same-org courses", async () => {
    await trainingProgressRepository.listEnrollmentDetailsByUser("u1", "o1");

    const { text, params } = renderWhere(0);
    expect(text).toContain('"training_enrollment"."user_id" = ');
    expect(text).toContain('"training_course"."org_id" is null');
    expect(text).toContain('"training_course"."org_id" = ');
    expect(params).toEqual(expect.arrayContaining(["u1", "o1"]));
  });

  it("maps counts to numbers and attaches the certificate only when issued", async () => {
    const issued = new Date("2026-05-01T10:00:00Z");
    setRows([
      {
        enrollmentId: "e1", courseId: "c1", title: "Sales 101", category: "Sales", status: "completed",
        enrolledAt: new Date("2026-04-01T10:00:00Z"), completedAt: issued, lessonsTotal: "4", lessonsCompleted: "4",
        certificateId: "k1", certificateIssuedAt: issued, certificateNo: "TRV-1",
      },
      {
        enrollmentId: "e2", courseId: "c2", title: "Resorts", category: "Resort", status: "in_progress",
        enrolledAt: new Date("2026-04-02T10:00:00Z"), completedAt: null, lessonsTotal: "6", lessonsCompleted: "2",
        certificateId: null, certificateIssuedAt: null, certificateNo: null,
      },
    ]);

    const rows = await trainingProgressRepository.listEnrollmentDetailsByUser("u1", "o1");

    expect(rows[0]).toMatchObject({ lessonsTotal: 4, lessonsCompleted: 4, certificate: { issuedAt: issued, certificateNo: "TRV-1" } });
    expect(rows[1]).toMatchObject({ lessonsTotal: 6, lessonsCompleted: 2, certificate: null });
  });
});
