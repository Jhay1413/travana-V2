import childProcess, { spawn as namedSpawn } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import tls from "node:tls";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import puppeteer from "puppeteer-core";
import { CANARY_HOST, describeTarget, installOutboundBlock, isBrowserCommand, isLoopbackHost, runCanary, type BlockedAttempt } from "./block-outbound";

const PIPE = "\\\\.\\pipe\\e2e-block-test-missing";
let dir: string;
let logFile: string;
let uninstall: () => void;
let server: http.Server;
let port: number;

function logged(): BlockedAttempt[] {
  if (!fs.existsSync(logFile)) return [];
  return fs
    .readFileSync(logFile, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as BlockedAttempt);
}

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "block-outbound-"));
  logFile = path.join(dir, "outbound.log");
  // Started before the block goes in; accepting connections is not what is under test.
  server = http.createServer((_req, res) => res.end("ok"));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as net.AddressInfo).port;
  uninstall = installOutboundBlock({ logFile });
});

afterAll(async () => {
  uninstall();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => fs.rmSync(logFile, { force: true }));
afterEach(() => undefined);

function connectError(connect: () => net.Socket): Promise<NodeJS.ErrnoException> {
  return new Promise((resolve, reject) => {
    const s = connect();
    s.once("error", resolve);
    s.once("connect", () => {
      s.destroy();
      reject(new Error("connection was allowed"));
    });
  });
}

describe("isLoopbackHost / describeTarget", () => {
  it("treats localhost, 127.x and ::1 as loopback and everything else as external", () => {
    for (const h of ["localhost", "LOCALHOST", "127.0.0.1", "127.1.2.3", "::1", "[::1]", "::ffff:127.0.0.1", undefined, ""]) {
      expect(isLoopbackHost(h), String(h)).toBe(true);
    }
    for (const h of ["example.com", "8.8.8.8", "0.0.0.0", "localhost.evil.com", "127.0.0.1.evil.com", "10.0.0.5", "::2", "localhost.", "127.999.1.1", "127.0.0", "::ffff:127.999.1.1"]) {
      expect(isLoopbackHost(h), h).toBe(false);
    }
  });

  it("reads the host from every argument shape of Socket.connect", () => {
    expect(describeTarget([{ port: 443, host: "a.com" }])).toEqual({ kind: "tcp", host: "a.com", port: 443 });
    expect(describeTarget([{ port: 443, hostname: "b.com" }])).toMatchObject({ host: "b.com" });
    expect(describeTarget([443, "c.com"])).toEqual({ kind: "tcp", host: "c.com", port: 443 });
    expect(describeTarget(["443", "c.com"])).toMatchObject({ host: "c.com" });
    expect(describeTarget([[{ port: 1, host: "d.com" }, () => undefined]])).toMatchObject({ host: "d.com" });
    expect(describeTarget([{ port: 80 }])).toEqual({ kind: "tcp", host: undefined, port: 80 });
    expect(describeTarget(["/tmp/x.sock"])).toEqual({ kind: "ipc" });
    // A numeric string is a port, however odd; a non-numeric string is a path.
    expect(describeTarget(["0", "c.com"])).toMatchObject({ kind: "tcp", host: "c.com" });
    expect(describeTarget(["80.0", "c.com"])).toMatchObject({ kind: "tcp" });
    // Only local pipes are local; a pipe on another machine is outbound.
    expect(describeTarget([{ path: "\\\\?\\pipe\\x" }])).toEqual({ kind: "ipc" });
    expect(describeTarget([{ path: "\\\\fileserver\\pipe\\x" }])).toEqual({ kind: "tcp", host: "fileserver" });
    expect(describeTarget([{ path: PIPE }])).toEqual({ kind: "ipc" });
  });
});

describe("outbound block", () => {
  it("lets a loopback connection through and logs nothing", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(await res.text()).toBe("ok");
    const byName = await fetch(`http://localhost:${port}/`).catch(() => null); // localhost may resolve to ::1 only
    if (byName) expect(await byName.text()).toBe("ok");
    expect(logged()).toEqual([]);
  });

  it("lets net.connect to 127.0.0.1 through in the (port, host) shape", async () => {
    await new Promise<void>((resolve, reject) => {
      const s = net.connect(port, "127.0.0.1", () => {
        s.destroy();
        resolve();
      });
      s.once("error", reject);
    });
    expect(logged()).toEqual([]);
  });

  it("refuses and logs an external hostname via net.connect(options)", async () => {
    const err = await connectError(() => net.connect({ port: 5432, host: "db.example.com" }));
    expect(err.code).toBe("E2E_OUTBOUND_BLOCKED");
    const [entry] = logged();
    expect(entry).toMatchObject({ host: "db.example.com", port: 5432 });
    expect(Array.isArray(entry.stack)).toBe(true);
  });

  it("refuses an external IP given as (port, host)", async () => {
    const err = await connectError(() => net.connect(443, "203.0.113.7"));
    expect(err.code).toBe("E2E_OUTBOUND_BLOCKED");
    expect(logged()).toHaveLength(1);
    expect(logged()[0]).toMatchObject({ host: "203.0.113.7", port: 443 });
  });

  it("refuses an external IP given as an options object", async () => {
    const err = await connectError(() => net.connect({ port: 80, host: "198.51.100.9" }));
    expect(err.code).toBe("E2E_OUTBOUND_BLOCKED");
    expect(logged()[0]).toMatchObject({ host: "198.51.100.9" });
  });

  it("refuses plain http.request to an external host", async () => {
    const err = await new Promise<NodeJS.ErrnoException>((resolve) => {
      http.get("http://example.com/", () => resolve(new Error("allowed") as NodeJS.ErrnoException)).on("error", resolve);
    });
    expect(err.code).toBe("E2E_OUTBOUND_BLOCKED");
    expect(logged()[0]).toMatchObject({ host: "example.com", port: 80 });
  });

  it("refuses https.request to an external host", async () => {
    const err = await new Promise<NodeJS.ErrnoException>((resolve) => {
      https.get("https://api.example.com/", () => resolve(new Error("allowed") as NodeJS.ErrnoException)).on("error", resolve);
    });
    expect(err.code).toBe("E2E_OUTBOUND_BLOCKED");
    expect(logged()[0]).toMatchObject({ host: "api.example.com", port: 443 });
  });

  it("refuses tls.connect to an external host", async () => {
    const err = await connectError(() => tls.connect({ host: "secure.example.com", port: 443 }) as unknown as net.Socket);
    expect(err.code).toBe("E2E_OUTBOUND_BLOCKED");
    expect(logged()[0]).toMatchObject({ host: "secure.example.com", port: 443 });
  });

  it("refuses global fetch to an external host and to an external IP", async () => {
    await expect(fetch("https://api.example.com/v1/send", { method: "POST", body: "x" })).rejects.toThrow();
    await expect(fetch("http://203.0.113.9:8080/")).rejects.toThrow();
    const hosts = logged().map((a) => a.host);
    expect(hosts).toContain("api.example.com");
    expect(hosts).toContain("203.0.113.9");
  });

  it("never writes request bodies, headers or credentials to the log", async () => {
    await fetch("https://api.example.com/", { method: "POST", headers: { Authorization: "Bearer SECRET-TOKEN" }, body: "SECRET-BODY" }).catch(() => undefined);
    const text = fs.readFileSync(logFile, "utf8");
    expect(text).not.toContain("SECRET");
  });

  it("allows a Unix socket / named pipe path (does not log it)", async () => {
    const p = process.platform === "win32" ? PIPE : path.join(dir, "missing.sock");
    const err = await connectError(() => net.connect(p));
    expect(err.code).not.toBe("E2E_OUTBOUND_BLOCKED"); // fails because nothing listens, not because of the block
    expect(logged()).toEqual([]);
  });
});

describe("browser launches (child processes)", () => {
  const CHROME = "C:\\fake\\chrome.exe";

  it("recognises browsers by executable and leaves node, tsx and esbuild alone", () => {
    for (const c of [
      "chrome",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "/usr/bin/chromium-browser",
      "google-chrome-stable",
      "chrome-headless-shell",
      "msedge.exe",
      "firefox",
      '"C:/x/Chrome/chrome.exe" --headless',
      "/home/u/.cache/puppeteer/chrome/linux/chrome",
    ]) {
      expect(isBrowserCommand(c), c).toBe(true);
    }
    for (const c of [process.execPath, "node", "tsx", "esbuild", "C:\\repo\\node_modules\\@esbuild\\win32-x64\\esbuild.exe", "git", "taskkill", "pg_isready"]) {
      expect(isBrowserCommand(c), c).toBe(false);
    }
  });

  it("refuses every spawn form for a browser and logs it", () => {
    expect(() => childProcess.spawn(CHROME, ["--headless"])).toThrow(/refused to start a browser/);
    expect(() => childProcess.spawnSync(CHROME)).toThrow(/refused/);
    expect(() => childProcess.execFile(CHROME, [])).toThrow(/refused/);
    expect(() => childProcess.execFileSync(CHROME)).toThrow(/refused/);
    expect(() => childProcess.exec(`"${CHROME}" --headless`)).toThrow(/refused/);
    expect(() => childProcess.execSync("chromium --headless")).toThrow(/refused/);
    expect(logged().map((a) => a.host.split(":")[0])).toEqual([
      "child_process.spawn",
      "child_process.spawnSync",
      "child_process.execFile",
      "child_process.execFileSync",
      "child_process.exec",
      "child_process.execSync",
    ]);
  });

  it("is also hit by a named ES import (syncBuiltinESMExports)", () => {
    expect(() => namedSpawn("chromium", [])).toThrow(/refused/);
  });

  it("still lets node run, so vite, tsx and esbuild keep working", () => {
    const out = childProcess.execFileSync(process.execPath, ["-e", "process.stdout.write('fine')"], { encoding: "utf8" });
    expect(out).toBe("fine");
    expect(logged()).toEqual([]);
  });

  it("keeps util.promisify working on exec and execFile (the server relies on it at start-up)", async () => {
    expect(typeof (childProcess.exec as unknown as Record<symbol, unknown>)[promisify.custom]).toBe("function");
    const { stdout } = await promisify(childProcess.execFile)(process.execPath, ["-e", "process.stdout.write('viaPromisify')"]);
    expect(stdout).toBe("viaPromisify");
  });

  it("puppeteer's own launch path reaches the wrapped spawn and never starts a process", async () => {
    // puppeteer checks the file exists first, so give it a real (empty) file called chrome.exe.
    const fake = path.join(dir, "chrome.exe");
    fs.writeFileSync(fake, "");
    await expect(puppeteer.launch({ executablePath: fake, args: [] })).rejects.toThrow(/refused to start a browser/);
    expect(logged()).toHaveLength(1);
  });
});

describe("canary", () => {
  it("is refused with E2E_OUTBOUND_BLOCKED and is not written to the violation log", async () => {
    const result = await runCanary();
    expect(result).toMatchObject({ refused: true, code: "E2E_OUTBOUND_BLOCKED" });
    expect(logged()).toEqual([]);
    expect(CANARY_HOST).toBe("203.0.113.1");
  });
});
