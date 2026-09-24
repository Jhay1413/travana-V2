import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./notification.repository", () => ({
  notificationRepository: {
    findByUserId: vi.fn(),
    findUnreadByUserId: vi.fn(),
    removeAllByUserId: vi.fn(),
  },
}));

vi.mock("../task/task.repository", () => ({
  taskRepository: {
    checkAndNotifyDueTasks: vi.fn(),
  },
}));

vi.mock("../ticket/ticket-notification.service", () => ({
  checkStaleTickets: vi.fn(),
}));

import { notificationService } from "./notification.service";
import { notificationRepository } from "./notification.repository";
import { taskRepository } from "../task/task.repository";
import { checkStaleTickets } from "../ticket/ticket-notification.service";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(notificationRepository.findByUserId).mockResolvedValue([]);
  vi.mocked(notificationRepository.findUnreadByUserId).mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

// The throttle map is module-level (per user, per process), so each test
// below uses its own userId to avoid bleeding state between assertions.
describe("notificationService due-check throttle", () => {
  it("runs the due-task and stale-ticket checks on the first fetch for a user", async () => {
    await notificationService.listByUserId("throttle-user-1");

    expect(taskRepository.checkAndNotifyDueTasks).toHaveBeenCalledWith("throttle-user-1");
    expect(checkStaleTickets).toHaveBeenCalledWith("throttle-user-1");
    expect(notificationRepository.findByUserId).toHaveBeenCalledWith("throttle-user-1");
  });

  it("skips the checks on a second fetch for the same user within the throttle window", async () => {
    await notificationService.listByUserId("throttle-user-2");
    vi.mocked(taskRepository.checkAndNotifyDueTasks).mockClear();
    vi.mocked(checkStaleTickets).mockClear();

    await notificationService.listByUserId("throttle-user-2");

    expect(taskRepository.checkAndNotifyDueTasks).not.toHaveBeenCalled();
    expect(checkStaleTickets).not.toHaveBeenCalled();
    // The read itself always happens, throttled or not.
    expect(notificationRepository.findByUserId).toHaveBeenCalledTimes(2);
  });

  it("re-runs the checks once the throttle window has elapsed", async () => {
    vi.useFakeTimers();
    try {
      await notificationService.listByUserId("throttle-user-3");
      vi.mocked(taskRepository.checkAndNotifyDueTasks).mockClear();
      vi.mocked(checkStaleTickets).mockClear();

      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      await notificationService.listByUserId("throttle-user-3");

      expect(taskRepository.checkAndNotifyDueTasks).toHaveBeenCalledWith("throttle-user-3");
      expect(checkStaleTickets).toHaveBeenCalledWith("throttle-user-3");
    } finally {
      vi.useRealTimers();
    }
  });

  it("throttles listUnreadByUserId and listByUserId together, per user", async () => {
    await notificationService.listByUserId("throttle-user-4");
    vi.mocked(taskRepository.checkAndNotifyDueTasks).mockClear();
    vi.mocked(checkStaleTickets).mockClear();

    await notificationService.listUnreadByUserId("throttle-user-4");

    expect(taskRepository.checkAndNotifyDueTasks).not.toHaveBeenCalled();
    expect(checkStaleTickets).not.toHaveBeenCalled();
  });
});

describe("notificationService.clearAll", () => {
  it("deletes all notifications scoped to the given user", async () => {
    await notificationService.clearAll("clear-all-user-1");

    expect(notificationRepository.removeAllByUserId).toHaveBeenCalledWith("clear-all-user-1");
    expect(notificationRepository.removeAllByUserId).toHaveBeenCalledTimes(1);
  });
});
