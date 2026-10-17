import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./user-session.repository", () => ({ userSessionRepository: { deleteByUserId: vi.fn() } }));
vi.mock("../../realtime/realtime.service", () => ({ realtimeService: { closeUserConnections: vi.fn() } }));

import { userAccessService } from "./user-access.service";
import { userSessionRepository } from "./user-session.repository";
import { realtimeService } from "../../realtime/realtime.service";

beforeEach(() => vi.clearAllMocks());

describe("userAccessService.revokeAccess", () => {
  it("deletes sessions, closes realtime streams and returns the deleted count", async () => {
    vi.mocked(userSessionRepository.deleteByUserId).mockResolvedValue(4);
    await expect(userAccessService.revokeAccess("u1")).resolves.toBe(4);
    expect(userSessionRepository.deleteByUserId).toHaveBeenCalledWith("u1");
    expect(realtimeService.closeUserConnections).toHaveBeenCalledWith("u1");
  });
});
