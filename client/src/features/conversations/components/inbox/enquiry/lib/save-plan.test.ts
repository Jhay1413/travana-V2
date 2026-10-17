import { describe, expect, it } from "vitest";
import { DEFAULT_FORM } from "./enquiry-form";
import { planSaveSteps } from "./save-plan";

const form = { ...DEFAULT_FORM, title: "  Lanzarote week " };
const ctx = { conversationId: "conv1", firstName: "Sam", now: new Date(2026, 0, 31, 15, 30) };
const response = { transaction: { id: "t1" }, enquiry: { id: "e1" } };
const opts = { form, assigneeId: "u1", followUp: true, keepLinked: true };

describe("planSaveSteps", () => {
  it("is unreadable when the response has no ids", () => {
    expect(planSaveSteps({ id: "t1" }, opts, ctx)).toEqual({ kind: "unreadable" });
    expect(planSaveSteps(undefined, opts, ctx)).toEqual({ kind: "unreadable" });
  });

  it("plans the follow-up task against the new enquiry, owned by the assignee, due tomorrow 10:00", () => {
    const plan = planSaveSteps(response, opts, ctx);
    if (plan.kind !== "created") throw new Error("expected created");
    expect(plan.task).toMatchObject({
      title: "Call Sam to confirm the details",
      entityType: "enquiry",
      entityId: "e1",
      userId: "u1",
      completed: false,
    });
    const d = plan.task?.dueDate;
    expect([d?.getFullYear(), d?.getMonth(), d?.getDate(), d?.getHours()]).toEqual([2026, 1, 1, 10]);
  });

  it("plans the chat note with the trimmed title", () => {
    const plan = planSaveSteps(response, opts, ctx);
    if (plan.kind !== "created") throw new Error("expected created");
    expect(plan.title).toBe("Lanzarote week");
    expect(plan.note).toEqual({ conversation_id: "conv1", text: "Created an enquiry from this chat: Lanzarote week" });
  });

  it("skips what is switched off", () => {
    const plan = planSaveSteps(response, { ...opts, followUp: false, keepLinked: false }, ctx);
    expect(plan).toMatchObject({ kind: "created", task: null, note: null });
  });
});
