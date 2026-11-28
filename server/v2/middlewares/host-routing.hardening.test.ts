import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";

// The page head looks a quote token up in the database; these tests never touch one.
vi.mock("../modules/page-meta/page-meta.repository", () => ({ pageMetaRepository: { findAccessByToken: vi.fn(async () => null) } }));
import express from "express";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import type { AddressInfo } from "node:net";
import { serveStatic } from "../../static";
import { HOST_LOOP_MESSAGE, hostApiGate, redirectsAlreadyIssued, resetHostLoopLog } from "./host-routing";
import { portalServiceWorker } from "./portal-sw";
import { publicQuoteHeaders } from "./public-quote-headers";
import { PORTAL_SW_RETIRE_SCRIPT } from "../utils/portal-sw-retire";

const KEYS = ["PORTAL_BASE_URL", "BASE_URL", "PUBLIC_BASE_URL", "APP_URL", "REPLIT_URL", "REPLIT_DOMAINS", "REPLIT_DEV_DOMAIN", "REPLIT_DEPLOYMENT", "REPLIT_DEPLOYMENT_ID", "NODE_ENV"] as const;
const saved: Record<string, string | undefined> = {};
const STAFF = "https://travana.app";
const PORTAL = "https://portal.travana.app";
const INDEX = "<!doctype html><html><head></head><body></body></html>";

let server: http.Server;
let port: number;
let dist: string;

beforeAll(async () => {
  dist = fs.mkdtempSync(path.join(os.tmpdir(), "host-hardening-"));
  fs.writeFileSync(path.join(dist, "index.html"), INDEX);
  fs.writeFileSync(path.join(dist, "portal-sw.js"), "// the normal worker");
  const app = express();
  app.set("trust proxy", 1);
  app.use(hostApiGate);
  // Mounted before the static serving exactly as server/index.ts does.
  app.use("/view-quote", publicQuoteHeaders);
  app.get("/portal-sw.js", portalServiceWorker);
  app.use("/api", (req, res) => res.json({ reached: req.baseUrl + req.path }));
  app.use("/mockup-previews", (_req, res) => res.send("mockup"));
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
  resetHostLoopLog();
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

interface Answer {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}
function send(host: string, urlPath: string, opts: { method?: string; headers?: Record<string, string> } = {}): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: urlPath, method: opts.method ?? "GET", headers: { host, ...opts.headers } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    req.end();
  });
}
const staff = (p: string, o?: { method?: string; headers?: Record<string, string> }) => send("travana.app", p, o);
const portal = (p: string, o?: { method?: string; headers?: Record<string, string> }) => send("portal.travana.app", p, o);

describe("single host: index.html headers are what they were (no regression to /view-quote's no-store)", () => {
  it("/view-quote/<token> keeps no-store, noindex and no-referrer from publicQuoteHeaders", async () => {
    const res = await staff("/view-quote/ABCD1234");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["last-modified"]).toBeTruthy();
  });

  it("/, /portal and a staff page keep 'public, max-age=0' with the file's Last-Modified and an ETag", async () => {
    for (const p of ["/", "/portal", "/clients"]) {
      const res = await staff(p);
      expect(res.headers["cache-control"], p).toBe("public, max-age=0");
      expect(res.headers["last-modified"], p).toBeTruthy();
      expect(res.headers["etag"], p).toBeTruthy();
      expect(res.headers["vary"], p).toBeUndefined();
      expect(res.headers["content-security-policy"], p).toBeUndefined();
      expect(res.headers["content-type"], p).toContain("text/html");
    }
  });

  it("the normal /portal-sw.js file is served on every host", async () => {
    for (const host of ["travana.app", "portal.travana.app"]) {
      expect((await send(host, "/portal-sw.js")).body).toBe("// the normal worker");
    }
  });
});

describe("two hosts: index.html is host-dependent and says so", () => {
  beforeEach(() => {
    process.env.PORTAL_BASE_URL = PORTAL;
  });

  it("is 'no-cache, private', varied on the host headers, with no Last-Modified", async () => {
    for (const res of [await staff("/clients"), await portal("/portal")]) {
      expect(res.headers["cache-control"]).toBe("no-cache, private");
      expect(String(res.headers["vary"])).toMatch(/Host/i);
      expect(String(res.headers["vary"])).toMatch(/X-Forwarded-Host/i);
      expect(res.headers["last-modified"]).toBeUndefined();
    }
  });

  it("a quote page keeps the stronger no-store", async () => {
    expect((await portal("/view-quote/ABCD1234")).headers["cache-control"]).toBe("no-store");
  });

  it("staff pages may only be framed by the staff site itself; the portal host forbids framing", async () => {
    expect((await staff("/clients")).headers["content-security-policy"]).toBe("frame-ancestors 'self'");
    expect((await portal("/portal")).headers["content-security-policy"]).toBe("frame-ancestors 'none'");
  });
});

describe("two hosts: the image proxy and the mock-ups on the portal host", () => {
  beforeEach(() => {
    process.env.PORTAL_BASE_URL = PORTAL;
  });

  it("serves exactly GET and HEAD /api/v2/files/img, nothing else beside it", async () => {
    expect((await portal("/api/v2/files/img?key=quote-images%2Fa.jpg")).status).toBe(200);
    expect((await portal("/api/v2/files/img?key=x", { method: "HEAD" })).status).toBe(200);
    expect((await portal("/API/V2/FILES/IMG?key=x")).status).toBe(200);
    expect((await portal("/api/v2/files/img?key=x", { method: "POST" })).status).toBe(404);
    expect((await portal("/api/v2/files/img/extra")).status).toBe(404);
    expect((await portal("/api/v2/files")).status).toBe(404);
    expect((await portal("/api/v2/files/imgx")).status).toBe(404);
  });

  it("sends /mockup-previews to the staff host like any staff page", async () => {
    const res = await portal("/mockup-previews/a.png");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${STAFF}/mockup-previews/a.png`);
    expect((await staff("/mockup-previews/a.png")).body).toBe("mockup");
  });

  it("keeps the query string when / goes to /portal", async () => {
    const res = await portal("/?org=sunny");
    expect(res.headers.location).toBe(`${PORTAL}/portal?org=sunny`);
  });
});

describe("two hosts: a portal-origin page cannot drive the staff API with the staff cookie", () => {
  beforeEach(() => {
    process.env.PORTAL_BASE_URL = PORTAL;
  });

  it("a state-changing staff API request from the portal origin is 403 on the staff host", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const res = await staff("/api/v2/clients", { method, headers: { origin: PORTAL } });
      expect(res.status, method).toBe(403);
    }
  });

  it("everything else is untouched", async () => {
    expect((await staff("/api/v2/clients", { method: "POST" })).status).toBe(200); // no Origin header
    expect((await staff("/api/v2/clients", { method: "POST", headers: { origin: STAFF } })).status).toBe(200);
    expect((await staff("/api/v2/clients", { method: "POST", headers: { origin: "https://other.example" } })).status).toBe(200);
    expect((await staff("/api/v2/clients", { headers: { origin: PORTAL } })).status).toBe(200); // GET
    expect((await staff("/api/v2/clients", { method: "OPTIONS", headers: { origin: PORTAL } })).status).toBe(200);
    // The portal and public quote APIs old installed copies call on the staff host.
    expect((await staff("/api/portal/message", { method: "POST", headers: { origin: PORTAL } })).status).toBe(200);
    expect((await staff("/api/v2/portal/push/retire", { method: "POST", headers: { origin: PORTAL } })).status).toBe(200);
    expect((await staff("/api/public/quote/T/view", { method: "POST", headers: { origin: PORTAL } })).status).toBe(200);
  });

  it("does nothing at all with one host", async () => {
    delete process.env.PORTAL_BASE_URL;
    expect((await staff("/api/v2/clients", { method: "POST", headers: { origin: PORTAL } })).status).toBe(200);
  });
});

describe("redirect-loop guard", () => {
  beforeEach(() => {
    process.env.PORTAL_BASE_URL = PORTAL;
  });

  const cookieFrom = (res: Answer): string => {
    const raw = res.headers["set-cookie"] ?? [];
    return raw.map((c) => c.split(";")[0]).join("; ");
  };

  it("marks a redirect with a short-lived, HttpOnly, host-scoped cookie and keeps mt= / next= out of it", async () => {
    const url = "/portal/login?mt=AB12CD34EF56&next=%2Fportal%2Fquote%2FTOK";
    const res = await staff(url);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${PORTAL}${url}`);
    const cookie = String((res.headers["set-cookie"] ?? [])[0]);
    expect(cookie).toMatch(/^hr_mark=1\./);
    expect(cookie).toMatch(/Max-Age=15/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).not.toMatch(/Domain=/i);
    expect(cookie).not.toContain("AB12CD34EF56");
  });

  it("a proxy that does not forward the host: the third identical request is served, single-host, instead of redirected", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    // The request always arrives as the "staff" host (the portal address was lost on the way), so it keeps redirecting to itself.
    let cookie = "";
    const answers: Answer[] = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await staff("/portal/bookings?x=1", { headers: cookie ? { cookie } : {} });
      answers.push(res);
      cookie = cookieFrom(res) || cookie;
    }
    expect(answers.map((a) => a.status)).toEqual([302, 302, 200, 200]);
    // Served as one host: the page says so, so the client does not redirect either.
    const meta = /<meta name="travana-hosts" content='([^']*)'/.exec(answers[2]?.body ?? "");
    expect(JSON.parse(meta?.[1] ?? "{}")).toEqual({ portal: "", staff: "", kind: "single" });
    expect(answers[2]?.headers.location).toBeUndefined();
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(HOST_LOOP_MESSAGE);
    expect(HOST_LOOP_MESSAGE).toBe("host routing: the proxy is not forwarding the original host; PORTAL_BASE_URL is being ignored");
  });

  it("a different destination, or no mark, starts counting again (a normal revisit is not a loop)", async () => {
    const first = await staff("/portal/a");
    const again = await staff("/portal/b", { headers: { cookie: cookieFrom(first) } });
    expect(again.status).toBe(302);
    expect(String((again.headers["set-cookie"] ?? [])[0])).toMatch(/^hr_mark=1\./);
    const noMark = await staff("/portal/a");
    expect(noMark.status).toBe(302);
  });

  it("redirectsAlreadyIssued reads only a matching mark", () => {
    expect(redirectsAlreadyIssued(undefined, `${PORTAL}/portal`)).toBe(0);
    expect(redirectsAlreadyIssued("a=b; hr_mark=junk", `${PORTAL}/portal`)).toBe(0);
  });

  it("the proxy-forwards case is untouched: a different host never trips the guard", async () => {
    const res = await portal("/portal/bookings");
    expect(res.status).toBe(200);
  });
});

describe("retire worker for the old portal address", () => {
  it("is served on the staff host only when a portal host exists", async () => {
    process.env.PORTAL_BASE_URL = PORTAL;
    const res = await staff("/portal-sw.js");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/javascript");
    expect(res.headers["cache-control"]).toBe("no-cache");
    expect(res.headers["service-worker-allowed"]).toBe("/");
    expect(res.body).toBe(PORTAL_SW_RETIRE_SCRIPT);
  });

  it("the portal host and a single host get the normal worker, unchanged", async () => {
    process.env.PORTAL_BASE_URL = PORTAL;
    expect((await portal("/portal-sw.js")).body).toBe("// the normal worker");
    delete process.env.PORTAL_BASE_URL;
    expect((await staff("/portal-sw.js")).body).toBe("// the normal worker");
  });

  it("is valid worker code that retires the subscription: tells the server, unsubscribes, unregisters; shows nothing", async () => {
    const events: Record<string, (e: { waitUntil: (p: Promise<unknown>) => void }) => void> = {};
    const calls: string[] = [];
    const subscription = {
      toJSON: () => ({ endpoint: "https://push.example/abc", keys: { p256dh: "P", auth: "A" } }),
      unsubscribe: async () => {
        calls.push("unsubscribe");
        return true;
      },
    };
    const self = {
      addEventListener: (name: string, fn: (e: { waitUntil: (p: Promise<unknown>) => void }) => void) => {
        events[name] = fn;
      },
      skipWaiting: () => calls.push("skipWaiting"),
      registration: {
        pushManager: { getSubscription: async () => subscription },
        unregister: async () => {
          calls.push("unregister");
          return true;
        },
      },
    };
    const fetchMock = vi.fn(async (url: string, init: { body: string }) => {
      calls.push(`fetch ${url} ${init.body}`);
      return { ok: true };
    });
    vm.runInNewContext(PORTAL_SW_RETIRE_SCRIPT, { self, fetch: fetchMock, JSON, Promise });
    expect(Object.keys(events).sort()).toEqual(["activate", "install"]);

    events.install?.({ waitUntil: () => undefined });
    let pending: Promise<unknown> = Promise.resolve();
    events.activate?.({ waitUntil: (p) => (pending = p) });
    await pending;

    expect(calls).toEqual([
      "skipWaiting",
      `fetch /api/v2/portal/push/retire ${JSON.stringify({ subscription: { endpoint: "https://push.example/abc", keys: { p256dh: "P", auth: "A" } } })}`,
      "unsubscribe",
      "unregister",
    ]);
  });
});
