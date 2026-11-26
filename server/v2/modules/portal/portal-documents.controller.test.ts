import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextFunction, Request, RequestHandler, Response } from "express";

vi.mock("./portal-auth.service", () => ({ portalAuthService: { verifySession: vi.fn() } }));
vi.mock("./portal-documents.service", () => ({ portalDocumentsService: { list: vi.fn(), getDownload: vi.fn() } }));

import { portalDocumentsController } from "./portal-documents.controller";
import { portalDocumentDownloadValidator, portalDocumentListValidator } from "./portal-documents.validator";
import { portalAuth, portalErrorHandler } from "./portal.middleware";
import { portalAuthService } from "./portal-auth.service";
import { portalDocumentsService } from "./portal-documents.service";
import { validate } from "../../middlewares/validation.middleware";
import { AppError } from "../../utils/error-handler";

interface Captured {
  status: number;
  body: unknown;
  headers: Record<string, string>;
  sentFile?: string;
}

/** Runs a route's handler chain the way Express would, formatting errors with the portal error handler. */
async function call(handlers: RequestHandler[], reqInit: Partial<Request>): Promise<Captured> {
  const req = { headers: { authorization: "Bearer t" }, body: {}, query: {}, params: {}, socket: {}, ...reqInit } as unknown as Request;
  const out: Captured = { status: 200, body: undefined, headers: {} };
  const res = {
    headersSent: false,
    status(code: number) {
      out.status = code;
      return res;
    },
    setHeader(name: string, value: string) {
      out.headers[name.toLowerCase()] = value;
    },
    json(body: unknown) {
      out.body = body;
      res.headersSent = true;
      return res;
    },
    sendFile(path: string, _opts: unknown, cb: (err?: Error) => void) {
      out.sentFile = path;
      res.headersSent = true;
      cb();
    },
  } as unknown as Response;
  for (const handler of handlers) {
    let nextErr: unknown;
    let advanced = false;
    const next: NextFunction = (err?: unknown) => {
      advanced = true;
      nextErr = err;
    };
    await handler(req, res, next);
    if (nextErr) {
      portalErrorHandler(nextErr as Error, req, res, vi.fn());
      return out;
    }
    if (!advanced) return out;
  }
  return out;
}

const listHandlers = [portalAuth, validate(portalDocumentListValidator), portalDocumentsController.list];
const downloadHandlers = [portalAuth, validate(portalDocumentDownloadValidator), portalDocumentsController.download];
const ID = "3f2b8c1e-5d4a-4b7e-9c0d-1a2b3c4d5e6f";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(portalAuthService.verifySession).mockResolvedValue({ clientId: "c1", email: "a@b.com" });
});

describe("GET /documents", () => {
  it("200 with the list, asked for as the signed-in customer, never cached", async () => {
    vi.mocked(portalDocumentsService.list).mockResolvedValue([]);
    const r = await call(listHandlers, {});
    expect(r.status).toBe(200);
    expect(r.body).toEqual([]);
    expect(portalDocumentsService.list).toHaveBeenCalledWith("c1", undefined);
    expect(r.headers["cache-control"]).toBe("private, no-store");
  });

  it("passes a valid booking filter through", async () => {
    vi.mocked(portalDocumentsService.list).mockResolvedValue([]);
    await call(listHandlers, { query: { bookingId: ID } as never });
    expect(portalDocumentsService.list).toHaveBeenCalledWith("c1", ID);
  });

  it("400 {error} for a filter that is not a uuid", async () => {
    const r = await call(listHandlers, { query: { bookingId: "nope" } as never });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: expect.any(String) });
    expect(portalDocumentsService.list).not.toHaveBeenCalled();
  });

  it("401 {error} without a session", async () => {
    vi.mocked(portalAuthService.verifySession).mockRejectedValue(new AppError("Unauthorized", 401));
    const r = await call(listHandlers, { headers: {} });
    expect(r).toMatchObject({ status: 401, body: { error: "Unauthorized" } });
    expect(portalDocumentsService.list).not.toHaveBeenCalled();
  });

  it("500 with the endpoint's own message when something unexpected fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(portalDocumentsService.list).mockRejectedValue(new Error("db down"));
    expect(await call(listHandlers, {})).toMatchObject({ status: 500, body: { error: "Failed to load your documents" } });
  });
});

describe("GET /documents/:id/download", () => {
  it("cloud file: JSON link, private, no-store, nosniff, asked for as the signed-in customer", async () => {
    vi.mocked(portalDocumentsService.getDownload).mockResolvedValue({ kind: "link", url: "https://signed", fileName: "a.pdf", expiresInSeconds: 300 });
    const r = await call(downloadHandlers, { params: { id: ID } });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ url: "https://signed", fileName: "a.pdf", expiresInSeconds: 300 });
    expect(r.headers["cache-control"]).toBe("private, no-store");
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expect(portalDocumentsService.getDownload).toHaveBeenCalledWith("c1", ID);
  });

  it("never logs the signed URL", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    vi.mocked(portalDocumentsService.getDownload).mockResolvedValue({ kind: "link", url: "https://signed.example/x?X-Amz-Signature=secret", fileName: "a.pdf", expiresInSeconds: 300 });
    await call(downloadHandlers, { params: { id: ID } });
    const logged = spies.flatMap((s) => s.mock.calls).map((c) => c.join(" ")).join("\n");
    expect(logged).not.toContain("signed.example");
    expect(logged).not.toContain("X-Amz-Signature");
  });

  it("legacy disk file: streamed with the attachment disposition, the safe type, nosniff and no-store", async () => {
    vi.mocked(portalDocumentsService.getDownload).mockResolvedValue({
      kind: "stream",
      filePath: "/disk/x",
      fileName: "x.bin",
      contentType: "application/octet-stream",
      contentDisposition: `attachment; filename="x.bin"; filename*=UTF-8''x.bin`,
    });
    const r = await call(downloadHandlers, { params: { id: ID } });
    expect(r.sentFile).toBe("/disk/x");
    expect(r.headers["content-disposition"]).toMatch(/^attachment;/);
    expect(r.headers["content-type"]).toBe("application/octet-stream");
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expect(r.headers["cache-control"]).toBe("private, no-store");
  });

  it("404 {error} for another customer's file, an unknown id or a malformed id: all the same answer", async () => {
    vi.mocked(portalDocumentsService.getDownload).mockRejectedValue(new AppError("Document not found", 404));
    for (const id of [ID, "garbage"]) {
      expect(await call(downloadHandlers, { params: { id } })).toMatchObject({ status: 404, body: { error: "Document not found" } });
    }
  });

  it("401 {error} without a session, never reaching the service", async () => {
    vi.mocked(portalAuthService.verifySession).mockRejectedValue(new AppError("Unauthorized", 401));
    const r = await call(downloadHandlers, { headers: {}, params: { id: ID } });
    expect(r).toMatchObject({ status: 401, body: { error: "Unauthorized" } });
    expect(portalDocumentsService.getDownload).not.toHaveBeenCalled();
  });

  it("500 with the endpoint's own message when something unexpected fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(portalDocumentsService.getDownload).mockRejectedValue(new Error("s3 down"));
    expect(await call(downloadHandlers, { params: { id: ID } })).toMatchObject({ status: 500, body: { error: "Failed to prepare your download" } });
  });
});
