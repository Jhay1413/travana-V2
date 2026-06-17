import { describe, it, expect, vi, beforeEach } from "vitest";
import multer from "multer";
import { errorHandler } from "./error.middleware";
import { AppError } from "../utils/error-handler";

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("errorHandler", () => {
  it("maps an AppError to its statusCode and message", () => {
    const res = mockRes();

    errorHandler(new AppError("Booking not found", 404), {} as never, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Booking not found" });
  });

  it("maps a Multer file-size error to a friendly 400", () => {
    const res = mockRes();

    errorHandler(new multer.MulterError("LIMIT_FILE_SIZE"), {} as never, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0]).toMatchObject({
      success: false,
      message: "One or more files exceed the maximum allowed size.",
    });
  });

  it("falls back to 500 for an unexpected error (and does not leak its message)", () => {
    const res = mockRes();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    errorHandler(new Error("ECONNREFUSED secret-host:5432"), {} as never, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Internal server error" });
    errSpy.mockRestore();
  });
});
