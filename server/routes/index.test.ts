import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import routes from "./index";

// The legacy router must not serve anything: every prefix answers 404.
let server: Server;
let base: string;

beforeAll(() => {
  const app = express();
  app.use("/api", routes);
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

afterAll(() => {
  server.close();
});

describe("legacy v1 route mounts", () => {
  it.each([
    "/users", "/users/u1", "/clients", "/quotes", "/tour-operators", "/airports", "/notifications",
    "/dashboard", "/facebook/pages", "/tickets", "/attachments", "/replies", "/admin/x", "/settings/x",
    "/user-profiles/x", "/quote-share/x", "/audit/x", "/ai/x", "/wallet", "/wallet/client/c1/transactions",
  ])("does not serve %s", async (path) => {
    expect((await fetch(`${base}${path}`)).status).toBe(404);
  });
});
