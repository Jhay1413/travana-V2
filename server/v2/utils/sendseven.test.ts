import { afterEach, describe, expect, it, vi } from "vitest";
import { runWithSendSevenConfigAsync, sendSevenRequest } from "./sendseven";

const CONFIG = { baseUrl: "https://ss.test/api/v1", token: "tok" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function requestWith(status: number, body: unknown): Promise<unknown> {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(status, body)));
  return runWithSendSevenConfigAsync(CONFIG, () => sendSevenRequest("POST", "/x", { body: {} }));
}

describe("sendSevenRequest error messages", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses a string detail verbatim", async () => {
    await expect(requestWith(400, { detail: "Template not approved" })).rejects.toMatchObject({
      statusCode: 400,
      message: "Template not approved",
    });
  });

  it("flattens an object detail with message and error_code", async () => {
    await expect(
      requestWith(400, {
        detail: { error_code: "missing_template_parameters", message: "Missing value for template parameter(s): 1, 3" },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Missing value for template parameter(s): 1, 3 (missing_template_parameters)",
    });
  });

  it("falls back to top-level error text when there is no detail", async () => {
    await expect(requestWith(400, { error: "Unknown template" })).rejects.toMatchObject({ message: "Unknown template" });
  });

  it("joins FastAPI validation errors", async () => {
    await expect(
      requestWith(422, { detail: [{ loc: ["body", "channel_id"], msg: "field required", type: "value_error" }] }),
    ).rejects.toMatchObject({ statusCode: 422, message: "channel_id: field required" });
  });

  it("keeps the generic message for a non-JSON body and maps 5xx to 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 503 })));
    await expect(runWithSendSevenConfigAsync(CONFIG, () => sendSevenRequest("GET", "/x"))).rejects.toMatchObject({
      statusCode: 502,
      message: "SendSeven service returned 503",
    });
  });
});
