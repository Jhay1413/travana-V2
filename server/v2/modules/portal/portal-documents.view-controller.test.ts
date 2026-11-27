import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import { Readable, Writable } from "node:stream";
import type { NextFunction, Request, RequestHandler, Response } from "express";

vi.mock("./portal-auth.service", () => ({ portalAuthService: { verifySession: vi.fn() } }));
vi.mock("./portal-documents.service", () => ({ portalDocumentsService: { list: vi.fn(), getDownload: vi.fn(), getView: vi.fn() } }));

import { portalDocumentsController } from "./portal-documents.controller";
import { portalDocumentsRouter } from "./portal-documents.routes";
import { portalDocumentViewValidator } from "./portal-documents.validator";
import { portalAuth, portalErrorHandler } from "./portal.middleware";
import { portalAuthService } from "./portal-auth.service";
import { portalDocumentsService } from "./portal-documents.service";
import { validate } from "../../middlewares/validation.middleware";
import { AppError } from "../../utils/error-handler";

const ID = "3f2b8c1e-5d4a-4b7e-9c0d-1a2b3c4d5e6f";

interface Captured {
  status: number;
  body: unknown;
  headers: Record<string, string>;
  bytes: Buffer;
  destroyed: boolean;
}

/** A response that is a real Writable (so stream.pipeline works) and records headers like Express would. */
function makeRes(out: Captured) {
  const chunks: Buffer[] = [];
  const res = new Writable({
    write(chunk: Buffer, _enc, cb) {
      chunks.push(Buffer.from(chunk));
      cb();
    },
    final(cb) {
      out.bytes = Buffer.concat(chunks);
      cb();
    },
    destroy(err, cb) {
      out.destroyed = true;
      cb(err);
    },
  }) as Writable & Record<string, unknown>;
  res.headersSent = false;
  res.setHeader = (name: string, value: string) => {
    out.headers[name.toLowerCase()] = value;
  };
  res.status = (code: number) => {
    out.status = code;
    return res;
  };
  res.json = (body: unknown) => {
    out.body = body;
    res.headersSent = true;
    return res;
  };
  return res as unknown as Response;
}

async function call(handlers: RequestHandler[], params: Record<string, string>, headers: Record<string, string> = { authorization: "Bearer t" }): Promise<Captured> {
  const req = { headers, body: {}, query: {}, params, socket: {} } as unknown as Request;
  const out: Captured = { status: 200, body: undefined, headers: {}, bytes: Buffer.alloc(0), destroyed: false };
  const res = makeRes(out);
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

const viewHandlers = [portalAuth, validate(portalDocumentViewValidator), portalDocumentsController.view];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(portalAuthService.verifySession).mockResolvedValue({ clientId: "c1", email: "a@b.com" });
});

describe("GET /documents/:id/view", () => {
  it("streams the bytes with exactly the locked-down headers, asked for as the signed-in customer", async () => {
    vi.mocked(portalDocumentsService.getView).mockResolvedValue({
      stream: Readable.from([Buffer.from("%PDF-1.7 hello")]),
      contentType: "application/pdf",
      fileName: "Ticket é.pdf",
      size: 14,
    });
    const r = await call(viewHandlers, { id: ID });
    expect(r.bytes.toString()).toBe("%PDF-1.7 hello");
    expect(r.headers).toEqual({
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="Ticket _.pdf"; filename*=UTF-8''Ticket%20%C3%A9.pdf`,
      "content-security-policy": "sandbox; default-src 'none'",
      "cross-origin-resource-policy": "same-origin",
      "content-length": "14",
    });
    expect(portalDocumentsService.getView).toHaveBeenCalledWith("c1", ID, expect.any(AbortSignal));
  });

  it("omits Content-Length when the size is not known", async () => {
    vi.mocked(portalDocumentsService.getView).mockResolvedValue({ stream: Readable.from([Buffer.from("x")]), contentType: "image/png", fileName: "a.png", size: null });
    const r = await call(viewHandlers, { id: ID });
    expect(r.headers["content-length"]).toBeUndefined();
    expect(r.headers["content-type"]).toBe("image/png");
  });

  it("answers 404 {error} for a hidden, unknown, other customer's or malformed id: all the same", async () => {
    vi.mocked(portalDocumentsService.getView).mockRejectedValue(new AppError("Document not found", 404));
    for (const id of [ID, "garbage"]) {
      expect(await call(viewHandlers, { id })).toMatchObject({ status: 404, body: { error: "Document not found" } });
    }
  });

  it("passes the service's 415 and 413 on as plain JSON messages, not cached", async () => {
    vi.mocked(portalDocumentsService.getView).mockRejectedValueOnce(new AppError("This document can't be previewed. Please download it.", 415));
    expect(await call(viewHandlers, { id: ID })).toMatchObject({
      status: 415,
      body: { error: "This document can't be previewed. Please download it." },
      headers: { "cache-control": "private, no-store" },
    });
    vi.mocked(portalDocumentsService.getView).mockRejectedValueOnce(new AppError("This file is too large to preview. Please download it.", 413));
    expect(await call(viewHandlers, { id: ID })).toMatchObject({ status: 413, body: { error: "This file is too large to preview. Please download it." } });
  });

  it("401 {error} without a session, never reaching the service", async () => {
    vi.mocked(portalAuthService.verifySession).mockRejectedValue(new AppError("Unauthorized", 401));
    const r = await call(viewHandlers, { id: ID }, {});
    expect(r).toMatchObject({ status: 401, body: { error: "Unauthorized" } });
    expect(portalDocumentsService.getView).not.toHaveBeenCalled();
  });

  it("500 with the endpoint's own message when something unexpected fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(portalDocumentsService.getView).mockRejectedValue(new Error("s3 down"));
    expect(await call(viewHandlers, { id: ID })).toMatchObject({ status: 500, body: { error: "Failed to open your document" } });
  });

  it("a failing upstream read cuts the response and releases the source", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const source = new Readable({
      read() {
        this.destroy(new Error("upstream broke"));
      },
    });
    vi.mocked(portalDocumentsService.getView).mockResolvedValue({ stream: source, contentType: "application/pdf", fileName: "a.pdf", size: null });
    const r = await call(viewHandlers, { id: ID });
    expect(r.destroyed).toBe(true);
    expect(source.destroyed).toBe(true);
  });

  it("never logs a URL or the file name", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    vi.mocked(portalDocumentsService.getView).mockResolvedValue({ stream: Readable.from([Buffer.from("x")]), contentType: "application/pdf", fileName: "Secret name.pdf", size: 1 });
    await call(viewHandlers, { id: ID });
    const logged = spies.flatMap((s) => s.mock.calls).map((c) => c.join(" ")).join("\n");
    expect(logged).not.toContain("Secret name");
    expect(logged).not.toMatch(/https?:\/\//);
  });
});

describe("the /documents/:id/view route", () => {
  interface RouteLayer {
    route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: RequestHandler }> };
  }
  const layer = (portalDocumentsRouter as unknown as { stack: RouteLayer[] }).stack.find((l) => l.route?.path === "/documents/:id/view");

  it("is a GET behind portalAuth, a per-customer limiter, the validator, then the controller", () => {
    expect(layer?.route?.methods.get).toBe(true);
    const handles = layer?.route?.stack.map((s) => s.handle) ?? [];
    expect(handles).toHaveLength(4);
    expect(handles[0]).toBe(portalAuth);
    expect(handles[3]).toBe(portalDocumentsController.view);
  });

  it("answers 429 with Retry-After on the 61st view inside the window, per customer", () => {
    const limiter = layer?.route?.stack[1].handle;
    expect(limiter).toBeDefined();
    const reqFor = (clientId: string) => ({ portalClient: { clientId, email: "a@b.com" }, headers: {}, socket: {} }) as unknown as Request;
    const emitter = new EventEmitter();
    const makeLimitRes = () => {
      const state = { status: 0, headers: {} as Record<string, string>, body: undefined as unknown };
      const res = {
        setHeader: (n: string, v: string) => {
          state.headers[n] = v;
        },
        status: (c: number) => {
          state.status = c;
          return res;
        },
        json: (b: unknown) => {
          state.body = b;
        },
        on: emitter.on.bind(emitter),
      } as unknown as Response;
      return { res, state };
    };
    // isPortalRequest decides on the request's shape; skip the test if it would not treat the stub as portal.
    let passed = 0;
    for (let i = 0; i < 60; i += 1) {
      const next = vi.fn();
      limiter?.(reqFor("limited"), makeLimitRes().res, next);
      if (next.mock.calls.length === 1) passed += 1;
    }
    expect(passed).toBe(60);
    const blocked = makeLimitRes();
    const nextBlocked = vi.fn();
    limiter?.(reqFor("limited"), blocked.res, nextBlocked);
    expect(nextBlocked).not.toHaveBeenCalled();
    expect(blocked.state.status).toBe(429);
    expect(Number(blocked.state.headers["Retry-After"])).toBeGreaterThan(0);

    const other = vi.fn();
    limiter?.(reqFor("someone-else"), makeLimitRes().res, other);
    expect(other).toHaveBeenCalledTimes(1);
  });
});
