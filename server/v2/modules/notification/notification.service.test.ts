import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./notification.repository", () => ({
  notificationRepository: {
    findByUserId: vi.fn(),
    findUnreadByUserId: vi.fn(),
    removeAllByUserId: vi.fn(),
  },
}));

import { notificationService } from "./notification.service";
import { notificationRepository } from "./notification.repository";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(notificationRepository.findByUserId).mockResolvedValue([]);
  vi.mocked(notificationRepository.findUnreadByUserId).mockResolvedValue([]);
});

describe("notificationService.clearAll", () => {
  it("deletes all notifications scoped to the given user", async () => {
    await notificationService.clearAll("clear-all-user-1");

    expect(notificationRepository.removeAllByUserId).toHaveBeenCalledWith("clear-all-user-1");
    expect(notificationRepository.removeAllByUserId).toHaveBeenCalledTimes(1);
  });
});
