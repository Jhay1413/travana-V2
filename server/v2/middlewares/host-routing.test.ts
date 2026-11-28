import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";

// The page head looks a quote token up in the database; these tests never touch one.
vi.mock("../modules/page-meta/page-meta.repository", () => ({ pageMetaRepository: { findAccessByToken: vi.fn(async () => null) } }));
import express from "express";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { serveStatic } from "../../static";
import { hostApiGate, isPortalHostApiPath } from "./host-routing";

const KEYS = ["PORTAL_BASE_URL", "BASE_URL", "PUBLIC_BASE_URL", "APP_URL", "REPLIT_URL", "REPLIT_DOMAINS", "REPLIT_DEV_DOMAIN", "REPLIT_DEPLOYMENT", "REPLIT_DEPLOYMENT_ID", "NODE_ENV"] as const;
const saved: Record<string, string | undefined> = {};

const STAFF = "https://travana.app";
const PORTAL = "https://portal.travana.app";
const STAFF_HOST = "travana.app";
const PORTAL_HOST = "portal.travana.app";
const INDEX = "<!doctype html><html><head><title>t</title></head><body><div id=\"root\"></div></body></html>";

let server: http.Server;
let port: number;
let dist: string;

beforeAll(async () => {
  dist = fs.mkdtempSync(path.join(os.tmpdir(), "host-routing-"));
  fs.mkdirSync(path.join(dist, "assets"));
  fs.writeFileSync(path.join(dist, "index.html"), INDEX);
  fs.writeFileSync(path.join(dist, "assets", "app.js"), "console.log('app')");
  fs.writeFileSync(path.join(dist, "manifest.json"), "{\"name\":\"m\"}");
  fs.writeFileSync(path.join(dist, "portal-sw.js"), "self.skip = 1");

  const app = express();
  app.set("trust proxy", 1);
  app.use(hostApiGate);
  // Stand-ins for the real routers: the gate decides before any of them runs.
  app.use("/api", (req, res) => res.json({ reached: req.baseUrl + req.path }));
  serveStatic(app, dist);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(dist, { recursive: true, force: true });
});

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.BASE_URL = STAFF;
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

interface Answer {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

function send(host: string, urlPath: string, method = "GET"): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: urlPath, method, headers: { host } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    req.end();
  });
}

const staff = (p: string, method?: string) => send(STAFF_HOST, p, method);
const portal = (p: string, method?: string) => send(PORTAL_HOST, p, method);

function hostsMeta(html: string): { portal: string; staff: string; kind: string } {
  const match = /<meta name="travana-hosts" content='([^']*)'/.exec(html);
  if (!match) throw new Error("no travana-hosts tag");
  return JSON.parse((match[1] ?? "").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));
}

describe("single host (PORTAL_BASE_URL unset): nothing changes", () => {
  it.each([STAFF_HOST, PORTAL_HOST, "anything.example"])("serves every page and API as before on %s", async (host) => {
    for (const p of ["/", "/portal", "/portal/login?mt=ABC", "/view-quote/TOK", "/view-quote/TOK?preview=1", "/clients", "//evil.com"]) {
      const res = await send(host, p);
      expect(res.status, `${host}${p}`).toBe(200);
      expect(res.headers.location).toBeUndefined();
      expect(res.headers["x-frame-options"]).toBeUndefined();
      expect(res.headers["content-security-policy"]).toBeUndefined();
      expect(hostsMeta(res.body)).toEqual({ portal: "", staff: "", kind: "single" });
    }
    for (const p of ["/api/v2/users", "/api/auth/user", "/api/portal/messages", "/api/v2/portal/summary", "/api/public/quote/TOK"]) {
      const res = await send(host, p);
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ reached: p.split("?")[0] });
    }
    expect((await send(host, "/api/v2/users", "POST")).status).toBe(200);
  });

  it("an invalid PORTAL_BASE_URL behaves as unset", async () => {
    process.env.PORTAL_BASE_URL = "https://travana.app/portal";
    const res = await portal("/clients");
    expect(res.status).toBe(200);
    expect(hostsMeta(res.body).kind).toBe("single");
  });
});

describe("the page: index.html with the hosts tag", () => {
  it("says staff on the staff host and portal on the portal host, origins only", async () => {
    process.env.PORTAL_BASE_URL = PORTAL;
    expect(hostsMeta((await staff("/clients")).body)).toEqual({ portal: PORTAL, staff: STAFF, kind: "staff" });
    expect(hostsMeta((await portal("/portal")).body)).toEqual({ portal: PORTAL, staff: STAFF, kind: "portal" });
  });

  it("is injected on / and /index.html too (static serving never bypasses it) and keeps the HTML otherwise intact", async () => {
    process.env.PORTAL_BASE_URL = PORTAL;
    for (const p of ["/index.html"]) {
      const res = await staff(p);
      expect(res.status).toBe(200);
      expect(hostsMeta(res.body).kind).toBe("staff");
      expect(res.body.replace(/\s*<meta name="travana-hosts"[^>]*>\s*(?=<\/head>)/, "")).toBe(INDEX);
    }
    expect(hostsMeta((await staff("/")).body).kind).toBe("staff");
  });

  it("keeps index.html's caching headers", async () => {
    const res = await staff("/clients");
    expect(res.headers["cache-control"]).toBe("public, max-age=0");
    expect(res.headers["last-modified"]).toBeTruthy();
    expect(res.headers["content-type"]).toContain("text/html");
  });
});

describe("static files are served on both hosts, never redirected", () => {
  it.each(["/assets/app.js", "/manifest.json", "/portal-sw.js"])("%s", async (file) => {
    for (const mode of ["single", "two"]) {
      if (mode === "two") process.env.PORTAL_BASE_URL = PORTAL;
      const [a, b] = [await staff(file), await portal(file)];
      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      expect(a.body).toBe(b.body);
      expect(b.headers.location).toBeUndefined();
    }
  });
});

describe("two hosts: the staff host", () => {
  beforeEach(() => {
    process.env.PORTAL_BASE_URL = PORTAL;
  });

  it("sends portal pages and public quote pages to the portal host, path and query intact", async () => {
    const login = "/portal/login?mt=AB12CD34EF56&next=%2Fportal%2Fquote%2FTOK";
    for (const p of [login, "/portal", "/portal/", "/view-quote/TOK", "/view-quote/TOK?foo=1&preview=0"]) {
      const res = await staff(p);
      expect(res.status, p).toBe(302);
      expect(res.headers.location).toBe(`${PORTAL}${p}`);
    }
    expect((await staff(login)).headers.location).toBe(`${PORTAL}${login}`);
  });

  it("sets no-referrer and no-store on every redirect", async () => {
    const res = await staff("/portal/login?mt=SECRET");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("keeps the staff preview of a quote page on the staff host", async () => {
    const res = await staff("/view-quote/TOK?preview=1");
    expect(res.status).toBe(200);
    expect(res.headers.location).toBeUndefined();
    expect(hostsMeta(res.body).kind).toBe("staff");
  });

  it("serves staff pages normally and with no frame restrictions", async () => {
    const res = await staff("/clients");
    expect(res.status).toBe(200);
    expect(res.headers["x-frame-options"]).toBeUndefined();
  });

  it("leaves every API reachable (old installed portal copies still call /api/portal)", async () => {
    for (const p of ["/api/v2/users", "/api/auth/user", "/api/portal/messages", "/api/v2/portal/summary", "/api/public/quote/TOK"]) {
      expect((await staff(p)).status, p).toBe(200);
    }
  });

  it("does not touch non-GET page requests", async () => {
    expect((await staff("/portal/login", "POST")).status).toBe(200);
  });

  it("HEAD is redirected like GET", async () => {
    const res = await staff("/portal", "HEAD");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${PORTAL}/portal`);
  });
});

describe("two hosts: the portal host", () => {
  beforeEach(() => {
    process.env.PORTAL_BASE_URL = PORTAL;
  });

  it("/ goes to /portal", async () => {
    const res = await portal("/");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${PORTAL}/portal`);
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("serves portal and public quote pages, with anti-framing headers", async () => {
    for (const p of ["/portal", "/portal/login?mt=ABC", "/portal/quote/TOK", "/view-quote/TOK"]) {
      const res = await portal(p);
      expect(res.status, p).toBe(200);
      expect(res.headers["x-frame-options"]).toBe("DENY");
      expect(res.headers["content-security-policy"]).toBe("frame-ancestors 'none'");
      expect(hostsMeta(res.body).kind).toBe("portal");
    }
  });

  it("sends the staff preview of a quote and every staff page to the staff host", async () => {
    expect((await portal("/view-quote/TOK?preview=1")).headers.location).toBe(`${STAFF}/view-quote/TOK?preview=1`);
    for (const p of ["/clients", "/agent-overview?tab=2", "/login", "/travana/x", "/view-quote", "/index.html"]) {
      const res = await portal(p);
      expect(res.status, p).toBe(302);
      expect(res.headers.location).toBe(`${STAFF}${p}`);
      expect(res.headers["cache-control"]).toBe("no-store");
    }
  });

  it("answers the portal and public quote APIs", async () => {
    for (const p of ["/api/portal/messages", "/api/portal", "/api/v2/portal/summary", "/api/v2/portal/webauthn/login/options", "/api/public/quote/TOK", "/api/public/quote/TOK/share"]) {
      expect((await portal(p)).status, p).toBe(200);
    }
    expect((await portal("/api/v2/portal/login", "POST")).status).toBe(200);
  });

  it("answers every other API with 404 { error: 'Not found' }, for any method and any letter case", async () => {
    for (const p of ["/api/v2/users", "/api/auth/user", "/api/auth/login", "/api/facebook/webhook", "/api/public/website/x", "/api", "/api/portalx", "/api/v2/portals", "/API/V2/USERS", "/api/v2/clients?x=1", "/api/v2/portal/../users", "/api/portal/%2e%2e/v2/users", "/api/portal/..%5cx"]) {
      for (const method of ["GET", "POST", "DELETE"]) {
        const res = await portal(p, method);
        expect(res.status, `${method} ${p}`).toBe(404);
        expect(JSON.parse(res.body)).toEqual({ error: "Not found" });
      }
    }
  });

  it("answers open-redirect attempts with 404, never a redirect", async () => {
    for (const p of ["//evil.com", "//evil.com/portal", "/\\evil.com", "/\\\\evil.com/x", `/${"a".repeat(9000)}`]) {
      const res = await portal(p);
      expect(res.status, p).toBe(404);
      expect(res.headers.location).toBeUndefined();
    }
  });

  it("keeps encoded tricks on the staff origin", async () => {
    for (const p of ["/@evil.com", "/%2F%2Fevil.com", "/x%0d%0aSet-Cookie:a=b"]) {
      const res = await portal(p);
      expect(res.status, p).toBe(302);
      expect(res.headers.location).toBe(`${STAFF}${p}`);
      expect(String(res.headers["set-cookie"])).not.toMatch(/Set-Cookie:a/i);
      expect((res.headers["set-cookie"] ?? []).every((c) => c.startsWith("hr_mark="))).toBe(true);
    }
  });
});

describe("isPortalHostApiPath", () => {
  it("allows exactly the three prefixes and what is below them", () => {
    expect(isPortalHostApiPath("/api/portal")).toBe(true);
    expect(isPortalHostApiPath("/api/portal/push/vapid-key")).toBe(true);
    expect(isPortalHostApiPath("/api/v2/portal/documents/1/download")).toBe(true);
    expect(isPortalHostApiPath("/api/public/quote/TOK/view")).toBe(true);
    expect(isPortalHostApiPath("/api/public")).toBe(false);
    expect(isPortalHostApiPath("/api/public/quotes")).toBe(false);
    expect(isPortalHostApiPath("/api/v2")).toBe(false);
  });
});
