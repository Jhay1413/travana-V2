import { describe, it, expect, vi } from "vitest";
import { asyncHandler } from "./async-handler";

describe("asyncHandler", () => {
  it("does not call next when the wrapped handler resolves", async () => {
    const next = vi.fn();
    const handler = asyncHandler(async () => {});

    await handler({} as never, {} as never, next);

    expect(next).not.toHaveBeenCalled();
  });

  it("forwards a rejected handler's error to next (→ error middleware)", async () => {
    const next = vi.fn();
    const boom = new Error("boom");
    const handler = asyncHandler(async () => {
      throw boom;
    });

    await handler({} as never, {} as never, next);
    // let the rejected promise's .catch flush
    await Promise.resolve();

    expect(next).toHaveBeenCalledWith(boom);
  });
});
