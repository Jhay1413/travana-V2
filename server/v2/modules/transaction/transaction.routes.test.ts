import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import express, { type NextFunction, type Request, type Response } from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// Real router, real multer and real validator; only the controller and the role guard are faked.
const created = vi.fn();
vi.mock("./transaction.controller", () => ({
  transactionController: new Proxy({}, {
    get: (_t, prop) =>
      prop === "createTransaction"
        ? (req: Request, res: Response) => {
            created(req.body);
            res.status(201).json({ ok: true });
          }
        : (_req: Request, res: Response) => res.json({}),
  }),
}));
vi.mock("../../middlewares/auth/block-read-only-roles", () => ({
  blockReadOnlyClientWrites: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

import router from "./transaction.routes";

const CLIENT = "22222222-2222-4222-8222-222222222222";
const TYPE = "123e4567-e89b-42d3-a456-426614174000";
let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/v2/transactions", router);
  app.use((err: { statusCode?: number; message: string }, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode ?? 500).json({ message: err.message });
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v2/transactions`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => created.mockClear());

function multipart(payload: unknown): FormData {
  const form = new FormData();
  form.append("data", JSON.stringify(payload));
  form.append("images", new Blob(["x"], { type: "image/png" }), "a.png");
  return form;
}

describe("POST /api/v2/transactions - multer runs before validation", () => {
  it("multipart: the JSON in `data` is validated, so an enquiry with no holiday type is 400 and the controller is not reached", async () => {
    const res = await fetch(base, { method: "POST", body: multipart({ client_id: CLIENT, enquiry: { title: "x" } }) });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe("Enquiry requires a holiday_type_id");
    expect(created).not.toHaveBeenCalled();
  });

  it("multipart: a valid enquiry, and a quote with an image, reach the controller with multer's parsed body", async () => {
    const ok = await fetch(base, { method: "POST", body: multipart({ enquiry: { holiday_type_id: TYPE } }) });
    expect(ok.status).toBe(201);
    const quote = await fetch(base, { method: "POST", body: multipart({ quote: { travel_date: "2027-01-01" } }) });
    expect(quote.status).toBe(201);
    expect(created).toHaveBeenCalledTimes(2);
    expect(JSON.parse(created.mock.calls[0][0].data)).toEqual({ enquiry: { holiday_type_id: TYPE } });
  });

  it("JSON: an enquiry with no holiday type is 400, a valid one passes", async () => {
    const send = (body: unknown) =>
      fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    expect((await send({ client_id: CLIENT, enquiry: { title: "x", status: "ACTIVE" } })).status).toBe(400);
    expect(created).not.toHaveBeenCalled();
    expect((await send({ client_id: CLIENT, enquiry: { holiday_type_id: TYPE } })).status).toBe(201);
    expect(created).toHaveBeenCalledOnce();
  });
});
