import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./task.service", () => ({
  taskService: { update: vi.fn() },
}));

import { taskController } from "./task.controller";
import { taskService } from "./task.service";

function req(body: unknown) {
  return {
    query: {},
    params: { id: "t1" },
    body,
    orgId: "o1",
    branchId: "b1",
    orgRole: "agent",
    orgRoles: ["agent"],
    user: { authType: "password", userId: "u1" },
  } as never;
}

function mockRes() {
  const res: Record<string, ReturnType<typeof vi.fn>> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

// asyncHandler does not return its promise, so let it settle before asserting.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => vi.clearAllMocks());

describe("taskController.update priority", () => {
  it("forwards a valid priority to the service", async () => {
    vi.mocked(taskService.update).mockResolvedValue({ id: "t1" } as never);
    const next = vi.fn();
    taskController.update(req({ priority: "high", title: "x" }), mockRes() as never, next);
    await settle();
    expect(next).not.toHaveBeenCalled();
    expect(taskService.update).toHaveBeenCalledWith("t1", { priority: "high", title: "x" }, expect.objectContaining({ orgId: "o1" }));
  });

  it("does not send a priority key when the body has none", async () => {
    vi.mocked(taskService.update).mockResolvedValue({ id: "t1" } as never);
    const next = vi.fn();
    taskController.update(req({ title: "x" }), mockRes() as never, next);
    await settle();
    const patch = vi.mocked(taskService.update).mock.calls[0][1] as Record<string, unknown>;
    expect(patch).not.toHaveProperty("priority");
    expect(patch.priority).not.toBeNull();
  });

  it("rejects a null priority through next without calling the service", async () => {
    const next = vi.fn();
    taskController.update(req({ priority: null }), mockRes() as never, next);
    await settle();
    expect(next).toHaveBeenCalledTimes(1);
    expect(taskService.update).not.toHaveBeenCalled();
  });
});
