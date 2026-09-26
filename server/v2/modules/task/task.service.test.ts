import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./task.repository", () => ({
  taskRepository: {
    findAll: vi.fn(),
    findAllWithClientTasks: vi.fn(),
    findByEntity: vi.fn(),
    findByUserId: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    toggleComplete: vi.fn(),
    remove: vi.fn(),
    completeByEntity: vi.fn(),
    reassignByEntity: vi.fn(),
  },
  entityLink: (entityType: string, entityId: string) => `/${entityType}s/${entityId}`,
}));

vi.mock("../notification/notification.repository", () => ({
  notificationRepository: {
    create: vi.fn(),
  },
}));

import { taskService } from "./task.service";
import { taskRepository } from "./task.repository";
import { notificationRepository } from "../notification/notification.repository";
import type { Scope } from "../../utils/scope";

const SCOPE: Scope = {
  orgId: "org1",
  branchId: null,
  orgRole: "agent",
  orgRoles: ["agent"],
  userId: "u1",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("taskService.create", () => {
  it("notifies the assignee when a task is created assigned to someone else", async () => {
    vi.mocked(taskRepository.create).mockResolvedValue({
      id: "task1",
      userId: "u2",
      title: "Do the thing",
      entityType: "client",
      entityId: "c1",
    } as never);

    await taskService.create({ userId: "u2", title: "Do the thing" } as never, SCOPE);

    expect(notificationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u2", type: "task_assigned" })
    );
  });

  it("does not notify when the creator assigns the task to themselves", async () => {
    vi.mocked(taskRepository.create).mockResolvedValue({
      id: "task1",
      userId: "u1",
      title: "Do the thing",
      entityType: "client",
      entityId: "c1",
    } as never);

    await taskService.create({ userId: "u1", title: "Do the thing" } as never, SCOPE);

    expect(notificationRepository.create).not.toHaveBeenCalled();
  });

  it("notifies even on self-assignment when the task is attached to an enquiry", async () => {
    vi.mocked(taskRepository.create).mockResolvedValue({
      id: "task1",
      userId: "u1",
      title: "Follow up",
      entityType: "enquiry",
      entityId: "e1",
    } as never);

    await taskService.create({ userId: "u1", title: "Follow up", entityType: "enquiry", entityId: "e1" } as never, SCOPE);

    expect(notificationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", type: "task_assigned" })
    );
  });

  it("notifies even on self-assignment when the task is attached to a quote", async () => {
    vi.mocked(taskRepository.create).mockResolvedValue({
      id: "task1",
      userId: "u1",
      title: "Follow up",
      entityType: "quote",
      entityId: "q1",
    } as never);

    await taskService.create({ userId: "u1", title: "Follow up", entityType: "quote", entityId: "q1" } as never, SCOPE);

    expect(notificationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", type: "task_assigned" })
    );
  });

  it("passes the description through to the repository and returns it unchanged", async () => {
    vi.mocked(taskRepository.create).mockResolvedValue({
      id: "task1",
      userId: "u1",
      title: "Do the thing",
      description: "Call the supplier to confirm the cabin upgrade",
      entityType: "client",
      entityId: "c1",
    } as never);

    const result = await taskService.create(
      { userId: "u1", title: "Do the thing", description: "Call the supplier to confirm the cabin upgrade" } as never,
      SCOPE,
    );

    expect(taskRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Call the supplier to confirm the cabin upgrade" }),
      SCOPE,
    );
    expect(result.description).toBe("Call the supplier to confirm the cabin upgrade");
  });
});

describe("taskService.update", () => {
  it("does not notify when updating an unrelated field", async () => {
    vi.mocked(taskRepository.update).mockResolvedValue({
      id: "task1",
      userId: "u2",
      title: "New title",
      entityType: "client",
      entityId: "c1",
    } as never);

    await taskService.update("task1", { title: "New title" } as never, SCOPE);

    expect(taskRepository.findById).not.toHaveBeenCalled();
    expect(notificationRepository.create).not.toHaveBeenCalled();
  });

  it("notifies the new assignee on reassignment to a different user", async () => {
    vi.mocked(taskRepository.findById).mockResolvedValue({ id: "task1", userId: "u2" } as never);
    vi.mocked(taskRepository.update).mockResolvedValue({
      id: "task1",
      userId: "u3",
      title: "Do the thing",
      entityType: "client",
      entityId: "c1",
    } as never);

    await taskService.update("task1", { userId: "u3" } as never, SCOPE);

    expect(notificationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u3", type: "task_assigned" })
    );
  });

  it("does not notify when reassigning to the same person already assigned", async () => {
    vi.mocked(taskRepository.findById).mockResolvedValue({ id: "task1", userId: "u2" } as never);
    vi.mocked(taskRepository.update).mockResolvedValue({
      id: "task1",
      userId: "u2",
      title: "Do the thing",
      entityType: "client",
      entityId: "c1",
    } as never);

    await taskService.update("task1", { userId: "u2" } as never, SCOPE);

    expect(notificationRepository.create).not.toHaveBeenCalled();
  });

  it("does not notify when unassigning a task", async () => {
    vi.mocked(taskRepository.findById).mockResolvedValue({ id: "task1", userId: "u2" } as never);
    vi.mocked(taskRepository.update).mockResolvedValue({
      id: "task1",
      userId: null,
      title: "Do the thing",
      entityType: "client",
      entityId: "c1",
    } as never);

    await taskService.update("task1", { userId: null } as never, SCOPE);

    expect(notificationRepository.create).not.toHaveBeenCalled();
  });

  it("passes an updated description through to the repository and returns it unchanged", async () => {
    vi.mocked(taskRepository.update).mockResolvedValue({
      id: "task1",
      userId: "u2",
      title: "Do the thing",
      description: "Updated details for the client",
      entityType: "client",
      entityId: "c1",
    } as never);

    const result = await taskService.update(
      "task1",
      { description: "Updated details for the client" } as never,
      SCOPE,
    );

    expect(taskRepository.update).toHaveBeenCalledWith(
      "task1",
      expect.objectContaining({ description: "Updated details for the client" }),
      SCOPE,
    );
    expect(result.description).toBe("Updated details for the client");
  });
});
