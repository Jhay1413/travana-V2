import { describe, it, expect, vi } from "vitest";
import { successResponse, errorResponse } from "./response";

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("successResponse", () => {
  it("wraps data in the success envelope with a default 200", () => {
    const res = mockRes();

    successResponse(res, { id: "b1" }, "Booking retrieved");

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: "Booking retrieved", data: { id: "b1" } });
  });

  it("honours an explicit status code (e.g. 201 on create)", () => {
    const res = mockRes();

    successResponse(res, { id: "b1" }, "Created", 201);

    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("errorResponse", () => {
  it("emits the failure envelope with the given status", () => {
    const res = mockRes();

    errorResponse(res, "Nope", 403);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Nope" });
  });
});
