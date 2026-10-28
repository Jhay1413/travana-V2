import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./task.repository", () => ({
  taskRepository: {
    findAll: vi.fn(),
    findAllWithClientTasks: vi.fn(),
    findByEntity: vi.fn(),
    findByClient: vi.fn(),
    findByUserId: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    toggleComplete: vi.fn(),
    remove: vi.fn(),
    completeByEntity: vi.fn(),
    reassignByEntity: vi.fn(),
    findEntityBranchId: vi.fn(),
    entityInScope: vi.fn(),
  },
  entityLink: (entityType: string, entityId: string) => `/${entityType}s/${entityId}`,
}));

vi.mock("../notification/notification.repository", () => ({
  notificationRepository: {
    create: vi.fn(),
  },
}));

vi.mock("../branch/branch.repository", () => ({ branchRepository: { findById: vi.fn() } }));
vi.mock("../branch-member/branch-member.repository", () => ({
  branchMemberRepository: { findActiveContextByUserIdInOrg: vi.fn() },
}));

vi.mock("../user/user.repository", () => ({ userRepository: { findAll: vi.fn() } }));

import { userRepository } from "../user/user.repository";
import { taskService } from "./task.service";
import { branchRepository } from "../branch/branch.repository";
import { branchMemberRepository } from "../branch-member/branch-member.repository";
import { taskRepository } from "./task.repository";
import { notificationRepository } from "../notification/notification.repository";
import type { Scope } from "../../utils/scope";

const SCOPE: Scope = {
  orgId: "org1",
  branchId: null,
  orgRole: "agent",
  orgRoles: ["agent"],
  userId: "u1",
  branchType: "shop",
  ownsHomeworkerBranch: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(userRepository.findAll).mockResolvedValue([{ id: "u2" }, { id: "u3" }] as never);
  vi.mocked(taskRepository.findEntityBranchId).mockResolvedValue(null);
  vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue(undefined as never);
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
  it("forwards priority to the repository on create", async () => {
    vi.mocked(taskRepository.create).mockResolvedValue({ id: "task1", userId: "u1", priority: "urgent" } as never);
    await taskService.create({ userId: "u1", title: "Call", priority: "urgent" } as never, SCOPE);
    expect(taskRepository.create).toHaveBeenCalledWith(expect.objectContaining({ priority: "urgent" }), SCOPE);
  });

  it("leaves priority undefined on create when omitted so the DB default applies", async () => {
    vi.mocked(taskRepository.create).mockResolvedValue({ id: "task1", userId: "u1", priority: "medium" } as never);
    await taskService.create({ userId: "u1", title: "Call" } as never, SCOPE);
    const values = vi.mocked(taskRepository.create).mock.calls[0][0] as { priority?: string };
    expect(values.priority).toBeUndefined();
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
  it("forwards priority to the repository on update", async () => {
    vi.mocked(taskRepository.update).mockResolvedValue({ id: "task1", userId: "u1", priority: "high" } as never);
    await taskService.update("task1", { priority: "high" } as never, SCOPE);
    expect(taskRepository.update).toHaveBeenCalledWith("task1", expect.objectContaining({ priority: "high" }), SCOPE);
  });
});

describe("taskService.update assignee roster", () => {
  it("rejects an assignee outside the caller's roster with 400 and does not update", async () => {
    vi.mocked(taskRepository.findById).mockResolvedValue({ id: "task1", userId: "u2" } as never);
    await expect(taskService.update("task1", { userId: "outsider" } as never, SCOPE)).rejects.toMatchObject({
      statusCode: 400,
      message: "That person is not on your team",
    });
    expect(userRepository.findAll).toHaveBeenCalledWith(SCOPE, { salesAgentsOnly: true });
    expect(taskRepository.update).not.toHaveBeenCalled();
  });

  it("allows self-assignment without a roster lookup, and stays silent", async () => {
    vi.mocked(taskRepository.findById).mockResolvedValue({ id: "task1", userId: "u2" } as never);
    vi.mocked(taskRepository.update).mockResolvedValue({ id: "task1", userId: "u1", entityType: "client", entityId: "c1" } as never);
    await taskService.update("task1", { userId: "u1" } as never, SCOPE);
    expect(userRepository.findAll).not.toHaveBeenCalled();
    expect(notificationRepository.create).not.toHaveBeenCalled();
  });

  it("does not re-check an unchanged assignee", async () => {
    vi.mocked(taskRepository.findById).mockResolvedValue({ id: "task1", userId: "legacy" } as never);
    vi.mocked(taskRepository.update).mockResolvedValue({ id: "task1", userId: "legacy" } as never);
    await taskService.update("task1", { userId: "legacy" } as never, SCOPE);
    expect(userRepository.findAll).not.toHaveBeenCalled();
  });

  it("an agent can update a colleague's task: the repository receives the caller scope", async () => {
    vi.mocked(taskRepository.update).mockResolvedValue({ id: "task1", userId: "u2", title: "x" } as never);
    await taskService.update("task1", { title: "x" } as never, SCOPE);
    expect(taskRepository.update).toHaveBeenCalledWith("task1", expect.objectContaining({ title: "x" }), SCOPE);
  });
});

describe("task branch derivation (S4)", () => {
  const ADMIN: Scope = { ...SCOPE, orgRole: "org_admin", orgRoles: ["org_admin"], branchId: "shop1" };
  const createdWith = () => vi.mocked(taskRepository.create).mock.calls[0][0] as Record<string, unknown>;

  beforeEach(() => {
    vi.mocked(taskRepository.create).mockResolvedValue({ id: "t1", userId: "u1" } as never);
  });

  it("create: takes the branch from the linked entity's transaction", async () => {
    vi.mocked(taskRepository.findEntityBranchId).mockResolvedValue("deal-branch");
    await taskService.create({ entityType: "quote", entityId: "q1", userId: "u1", title: "T" } as never, SCOPE);
    expect(taskRepository.findEntityBranchId).toHaveBeenCalledWith("quote", "q1");
    expect(createdWith()).toMatchObject({ branchId: "deal-branch" });
  });

  it("create: without an entity, uses the assignee's active membership in the org", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue({ branchId: "assignee-branch" } as never);
    await taskService.create({ userId: "hw", title: "T" } as never, ADMIN);
    expect(branchMemberRepository.findActiveContextByUserIdInOrg).toHaveBeenCalledWith("hw", "org1");
    expect(createdWith()).toMatchObject({ branchId: "assignee-branch" });
  });

  it("create: falls back to the caller's branch", async () => {
    await taskService.create({ userId: "u2", title: "T" } as never, { ...SCOPE, branchId: "my-branch" });
    expect(createdWith()).toMatchObject({ branchId: "my-branch" });
  });

  it("create: strips body orgId and branchId for non-admins", async () => {
    await taskService.create({ userId: "u2", title: "T", orgId: "evil", branchId: "evil-branch" } as never, { ...SCOPE, branchId: "my-branch" });
    expect(createdWith()).not.toHaveProperty("orgId");
    expect(createdWith()).toMatchObject({ branchId: "my-branch" });
    expect(branchRepository.findById).not.toHaveBeenCalled();
  });

  it("create: an admin's body branchId must be inside their org", async () => {
    vi.mocked(branchRepository.findById).mockResolvedValueOnce({ id: "b2" } as never);
    await taskService.create({ userId: "u2", title: "T", branchId: "b2" } as never, ADMIN);
    expect(createdWith()).toMatchObject({ branchId: "b2" });

    vi.mocked(branchRepository.findById).mockResolvedValueOnce(null);
    await expect(taskService.create({ userId: "u2", title: "T", branchId: "foreign" } as never, ADMIN)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("create: a system-scope (webhook) task gets the enquiry's branch instead of NULL", async () => {
    vi.mocked(taskRepository.findEntityBranchId).mockResolvedValue("deal-branch");
    const system: Scope = { ...SCOPE, orgRole: "org_admin", orgRoles: ["org_admin"], branchId: null, userId: null };
    await taskService.create({ entityType: "enquiry", entityId: "e1", userId: "owner", title: "Call back" } as never, system);
    expect(createdWith()).toMatchObject({ branchId: "deal-branch" });
  });

  it("update: reassignment re-homes via the task's entity, else the new assignee", async () => {
    vi.mocked(taskRepository.findById).mockResolvedValue({ id: "t1", userId: "u1", entityType: "booking", entityId: "b1" } as never);
    vi.mocked(taskRepository.findEntityBranchId).mockResolvedValue("deal-branch");
    vi.mocked(taskRepository.update).mockResolvedValue({ id: "t1", userId: "u2" } as never);
    await taskService.update("t1", { userId: "u2" }, ADMIN);
    expect(vi.mocked(taskRepository.update).mock.calls[0][1]).toMatchObject({ branchId: "deal-branch" });

    vi.mocked(taskRepository.findById).mockResolvedValue({ id: "t1", userId: "u1", entityType: null, entityId: null } as never);
    vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue({ branchId: "assignee-branch" } as never);
    await taskService.update("t1", { userId: "u2" }, ADMIN);
    expect(vi.mocked(taskRepository.update).mock.calls[1][1]).toMatchObject({ branchId: "assignee-branch" });
  });

  it("update: a resave with the same assignee does not re-home, and body branchId is stripped for non-admins", async () => {
    vi.mocked(taskRepository.findById).mockResolvedValue({ id: "t1", userId: "u1", entityType: null, entityId: null } as never);
    vi.mocked(taskRepository.update).mockResolvedValue({ id: "t1", userId: "u1" } as never);
    await taskService.update("t1", { userId: "u1", branchId: "evil" } as never, SCOPE);
    expect(vi.mocked(taskRepository.update).mock.calls[0][1]).not.toHaveProperty("branchId");
  });

  it("reassignByEntity carries the deal's branch to the repository", async () => {
    vi.mocked(taskRepository.findEntityBranchId).mockResolvedValue("deal-branch");
    await taskService.reassignByEntity("quote", "q1", "u9");
    expect(taskRepository.reassignByEntity).toHaveBeenCalledWith("quote", "q1", "u9", "deal-branch");
  });
});

describe("taskService.listByEntity verifies the entity first (Q1)", () => {
  it("404s without listing when the entity is outside the caller's partition", async () => {
    vi.mocked(taskRepository.entityInScope).mockResolvedValue(false);
    await expect(taskService.listByEntity("enquiry", "e1", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(taskRepository.entityInScope).toHaveBeenCalledWith("enquiry", "e1", SCOPE);
    expect(taskRepository.findByEntity).not.toHaveBeenCalled();
  });

  it("lists the entity's tasks once access is verified", async () => {
    vi.mocked(taskRepository.entityInScope).mockResolvedValue(true);
    vi.mocked(taskRepository.findByEntity).mockResolvedValue([{ id: "t1" }] as never);
    await expect(taskService.listByEntity("quote", "q1", SCOPE)).resolves.toEqual([{ id: "t1" }]);
  });
});

describe("taskService.listByClient", () => {
  it("403s without any lookup when the caller has no organisation selected", async () => {
    await expect(taskService.listByClient("c1", { ...SCOPE, orgId: null } as never)).rejects.toMatchObject({ statusCode: 403 });
    expect(taskRepository.entityInScope).not.toHaveBeenCalled();
    expect(taskRepository.findByClient).not.toHaveBeenCalled();
  });

  it("404s without listing when the client is outside the caller's scope", async () => {
    vi.mocked(taskRepository.entityInScope).mockResolvedValue(false);
    await expect(taskService.listByClient("c1", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(taskRepository.entityInScope).toHaveBeenCalledWith("client", "c1", SCOPE);
    expect(taskRepository.findByClient).not.toHaveBeenCalled();
  });

  it("lists the client's and its deals' tasks once access is verified", async () => {
    vi.mocked(taskRepository.entityInScope).mockResolvedValue(true);
    vi.mocked(taskRepository.findByClient).mockResolvedValue([{ id: "t1" }] as never);
    await expect(taskService.listByClient("c1", SCOPE)).resolves.toEqual([{ id: "t1" }]);
    expect(taskRepository.findByClient).toHaveBeenCalledWith("c1", SCOPE);
  });
});
