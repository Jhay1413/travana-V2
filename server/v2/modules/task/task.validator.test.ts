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
