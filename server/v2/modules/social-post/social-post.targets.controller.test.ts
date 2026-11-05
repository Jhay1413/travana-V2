import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./social-post.service", () => ({
  socialPostService: { schedulePost: vi.fn(), reschedulePost: vi.fn(), updateTravelDeal: vi.fn() },
}));

import { socialPostController } from "./social-post.controller";
import { socialPostService } from "./social-post.service";
import { AppError } from "../../utils/error-handler";
import { errorHandler } from "../../middlewares/error.middleware";

function req(body: Record<string, unknown>) {
  return {
    params: { id: "d1" },
    body: { postSchedule: "2026-12-01T10:00:00.000Z", ...body },
    files: [],
    orgId: "o1",
    branchId: "br1",
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

const done = { deal: { id: "d1" }, failedImageUrls: [], autoUpscale: { upscaled: [], skipped: [] } };
const next = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(socialPostService.schedulePost).mockResolvedValue(done as never);
  vi.mocked(socialPostService.reschedulePost).mockResolvedValue(done as never);
});

describe("socialPostController accountIds", () => {
  it("schedulePost parses the multipart accountIds JSON string and passes it as the last argument", async () => {
    await socialPostController.schedulePost(req({ accountIds: "[81085,7]" }), mockRes() as never, next);
    const args = vi.mocked(socialPostService.schedulePost).mock.calls[0];
    expect(args[args.length - 1]).toEqual([81085, 7]);
  });

  it("reschedulePost parses accountIds too", async () => {
    await socialPostController.reschedulePost(req({ accountIds: "[5]" }), mockRes() as never, next);
    const args = vi.mocked(socialPostService.reschedulePost).mock.calls[0];
    expect(args[args.length - 1]).toEqual([5]);
  });

  it("passes undefined when the field is absent so the service can fall back to stored targets", async () => {
    await socialPostController.reschedulePost(req({}), mockRes() as never, next);
    const args = vi.mocked(socialPostService.reschedulePost).mock.calls[0];
    expect(args[args.length - 1]).toBeUndefined();
  });

  it("forwards the service's 422 to the error middleware, which answers with the message", async () => {
    const msg = "Dead Page is disconnected or not available — reconnect it in OnlySocials or untick it";
    vi.mocked(socialPostService.schedulePost).mockRejectedValue(new AppError(msg, 422));
    const localNext = vi.fn();
    await socialPostController.schedulePost(req({ accountIds: "[9]" }), mockRes() as never, localNext);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const err = localNext.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    const res = mockRes();
    errorHandler(err, {} as never, res as never, vi.fn());
    expect(res.status).toHaveBeenCalledWith(422);
    expect(JSON.stringify(res.json.mock.calls[0][0])).toContain(msg);
  });
});

describe("socialPostController.update (PATCH)", () => {
  it("hands only the request body to the service", async () => {
    vi.mocked(socialPostService.updateTravelDeal).mockResolvedValue({ id: "d1" } as never);
    await socialPostController.update(req({ post: "text", accountIds: [1] }), mockRes() as never, next);
    expect(socialPostService.updateTravelDeal).toHaveBeenCalledWith("d1", expect.objectContaining({ post: "text", accountIds: [1] }), expect.anything());
  });
});
