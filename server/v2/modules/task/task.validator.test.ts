import { describe, it, expect } from "vitest";
import { createTaskSchema, updateTaskSchema } from "./task.validator";

describe.each([
  ["create", createTaskSchema],
  ["update", updateTaskSchema],
])("task %s validator priority", (_name, schema) => {
  it.each(["low", "medium", "high", "urgent"])("accepts %s", (priority) => {
    expect(schema.safeParse({ body: { title: "x", priority } }).success).toBe(true);
  });

  it("accepts a body without priority", () => {
    expect(schema.safeParse({ body: { title: "x" } }).success).toBe(true);
  });

  it("rejects an unknown priority", () => {
    const r = schema.safeParse({ body: { priority: "critical" } });
    expect(r.success).toBe(false);
  });

  it("rejects a null priority", () => {
    expect(schema.safeParse({ body: { title: "x", priority: null } }).success).toBe(false);
  });

  it("rejects a numeric priority", () => {
    expect(schema.safeParse({ body: { title: "x", priority: 1 } }).success).toBe(false);
  });
});

describe("listForClientSchema", () => {
  it("accepts a uuid and rejects anything else", async () => {
    const { listForClientSchema } = await import("./task.validator");
    expect(listForClientSchema.safeParse({ params: { clientId: "0b0f7a52-3c1e-4f55-9d0e-7a3a1d2b9c10" } }).success).toBe(true);
    expect(listForClientSchema.safeParse({ params: { clientId: "nope" } }).success).toBe(false);
  });
});

describe("updateTaskSchema strict body", () => {
  it("rejects unknown keys", () => {
    expect(updateTaskSchema.safeParse({ body: { title: "x", orgId: "o" } }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ body: { entityId: "e" } }).success).toBe(false);
  });

  it("rejects a bad priority and an over-long title", () => {
    expect(updateTaskSchema.safeParse({ body: { priority: "critical" } }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ body: { title: "x".repeat(201) } }).success).toBe(false);
  });

  it("accepts the editable fields", () => {
    expect(
      updateTaskSchema.safeParse({
        body: { title: "x", description: null, dueDate: "2026-10-28T10:00:00.000Z", userId: "u1", completed: true, priority: "high" },
      }).success,
    ).toBe(true);
  });
});
