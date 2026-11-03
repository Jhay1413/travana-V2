import { describe, expect, it, vi } from "vitest";
import { noResponseLog } from "./no-response-log";

describe("noResponseLog", () => {
  it("sets the skip flag on res.locals and continues", () => {
    const res = { locals: {} as Record<string, unknown> };
    const next = vi.fn();
    noResponseLog({} as never, res as never, next);
    expect(res.locals.skipResponseLog).toBe(true);
    expect(next).toHaveBeenCalledOnce();
  });
});
