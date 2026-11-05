import { describe, expect, it } from "vitest";
import { buildScheduleForm, toFormData } from "./build-schedule-form";

const base = { utcIso: "2026-10-21T08:00:00.000Z", local: "2026-10-21T09:00" };

describe("buildScheduleForm", () => {
  it("sends postContent only on reschedule", () => {
    const re = buildScheduleForm({ ...base, kind: "reschedule", postContent: "<p>Hi</p>", existingImageIds: ["a", "b"] });
    expect(re.fields.postContent).toBe("<p>Hi</p>");
    expect(re.fields.existingImageIds).toBe('["a","b"]');
    expect(re.fields.imageUrls).toBe("[]");

    const first = buildScheduleForm({ ...base, kind: "schedule", imageUrls: ["u1"] });
    expect("postContent" in first.fields).toBe(false);
    expect(first.fields.existingImageIds).toBe("[]");
    expect(first.fields.imageUrls).toBe('["u1"]');
  });

  it("always carries both schedule times", () => {
    const form = buildScheduleForm({ ...base, kind: "schedule", imageUrls: [] });
    expect(form.fields.postSchedule).toBe(base.utcIso);
    expect(form.fields.postScheduleLocal).toBe(base.local);
    expect(form.files).toEqual([]);
  });

  it("turns the plain object into FormData", () => {
    const fd = toFormData(buildScheduleForm({ ...base, kind: "reschedule", postContent: "x", existingImageIds: [] }));
    expect(fd.get("postContent")).toBe("x");
    expect(fd.get("postSchedule")).toBe(base.utcIso);
  });

  it("sends accountIds as a JSON array when given, on schedule and reschedule", () => {
    const first = buildScheduleForm({ ...base, kind: "schedule", imageUrls: [], accountIds: [81085, 7] });
    expect(first.fields.accountIds).toBe("[81085,7]");
    const re = buildScheduleForm({ ...base, kind: "reschedule", postContent: "x", existingImageIds: [], accountIds: [5] });
    expect(re.fields.accountIds).toBe("[5]");
    expect(toFormData(re).get("accountIds")).toBe("[5]");
  });

  it("omits accountIds when not given so the server keeps the saved accounts", () => {
    const form = buildScheduleForm({ ...base, kind: "reschedule", postContent: "x", existingImageIds: [] });
    expect("accountIds" in form.fields).toBe(false);
  });
});
