import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./social-post.service", () => ({
  socialPostService: { schedulePost: vi.fn(), reschedulePost: vi.fn() },
}));

import { socialPostController } from "./social-post.controller";
import { socialPostService } from "./social-post.service";
import { buildImageProxyUrl } from "../../utils/image-storage";

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
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const done = { deal: { id: "d1" }, failedImageUrls: [], autoUpscale: { upscaled: 0, skipped: 0 } };
const next = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(socialPostService.schedulePost).mockResolvedValue(done as never);
  vi.mocked(socialPostService.reschedulePost).mockResolvedValue(done as never);
});

describe("socialPostController image urls: unacceptable entries are dropped and reported, never a 400", () => {
  const privateProxy = buildImageProxyUrl("client-files/1.pdf");
  const gallery = ["https://cdn.test/a.jpg", null, "//cdn.test/b.jpg", "www.cdn.test/c.jpg", privateProxy, "https://cdn.test/d.jpg"];

  it("schedulePost sends only the good urls to the service and reports the dropped ones in failedImageUrls", async () => {
    const res = mockRes();
    await socialPostController.schedulePost(req({ imageUrls: JSON.stringify(gallery) }), res, next);

    expect(next).not.toHaveBeenCalled();
    const args = vi.mocked(socialPostService.schedulePost).mock.calls[0];
    expect(args[5]).toEqual(["https://cdn.test/a.jpg", "https://cdn.test/d.jpg"]);
    const body = res.json.mock.calls[0][0];
    expect(body.data.failedImageUrls).toEqual(["(not an image link)", "//cdn.test/b.jpg", "www.cdn.test/c.jpg", privateProxy]);
    expect(body.message).toMatch(/4 image\(s\) failed/);
  });

  it("reschedulePost behaves the same", async () => {
    const res = mockRes();
    await socialPostController.reschedulePost(req({ imageUrls: JSON.stringify(gallery) }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(vi.mocked(socialPostService.reschedulePost).mock.calls[0][6]).toEqual(["https://cdn.test/a.jpg", "https://cdn.test/d.jpg"]);
    expect(res.json.mock.calls[0][0].data.failedImageUrls).toHaveLength(4);
  });

  it("re-points imageOrder url tokens at the kept urls and merges upload failures after the dropped ones", async () => {
    vi.mocked(socialPostService.schedulePost).mockResolvedValue({ ...done, failedImageUrls: ["https://cdn.test/d.jpg"] } as never);
    const res = mockRes();
    await socialPostController.schedulePost(
      req({ imageUrls: JSON.stringify(["//x", "https://cdn.test/a.jpg"]), imageOrder: JSON.stringify(["url:1", "url:0"]) }),
      res,
      next,
    );

    expect(vi.mocked(socialPostService.schedulePost).mock.calls[0][7]).toEqual(["url:0"]);
    expect(res.json.mock.calls[0][0].data.failedImageUrls).toEqual(["//x", "https://cdn.test/d.jpg"]);
  });

  it("a clean gallery reports nothing", async () => {
    const res = mockRes();
    await socialPostController.schedulePost(req({ imageUrls: JSON.stringify(["https://cdn.test/a.jpg"]) }), res, next);
    expect(res.json.mock.calls[0][0].data.failedImageUrls).toEqual([]);
    expect(res.json.mock.calls[0][0].message).toBe("Post scheduled successfully");
  });
});
