/**
 * Hard outbound block for the E2E app server. Loaded with `--import` by start-server.ts, so it
 * runs before any application code.
 *
 * Two layers, both refuse-and-log:
 *
 * 1. Sockets. It wraps `net.Socket.prototype.connect`, the choke point under pg, http, https, http2,
 *    undici/fetch and tls (tls.connect builds a net.Socket and calls connect on it). Only loopback
 *    targets, Unix sockets and local Windows named pipes (\\.\pipe\ and \\?\pipe\) are let through.
 *    Anything else never opens a socket: the socket is destroyed with an error on the next tick.
 *
 * 2. Child processes. A browser (puppeteer, used by image upscaling, browser-fetch and the easyJet
 *    scraper) is a SEPARATE process that opens its own sockets, so the socket patch cannot see it.
 *    spawn / spawnSync / execFile / execFileSync / exec / execSync / fork are wrapped with a refuse-list
 *    on the executable (chrome, chromium, headless shell, edge, firefox, puppeteer). Everything else
 *    (node, tsx, esbuild, ...) passes untouched. puppeteer reaches `childProcess.spawn` through the
 *    module object at call time, so the wrapper is hit (see block-outbound.test.ts).
 *
 * Every refusal is appended to the file named by E2E_OUTBOUND_LOG (one JSON object per line: host,
 * port, stack summary). If that write fails, the failure goes to stderr with a marker the global
 * teardown looks for.
 *
 * Not covered by design: plain DNS lookups (c-ares UDP via dns.resolve*), raw dgram sockets, and
 * a process started some way other than child_process. None of these can carry an email, SMS,
 * WhatsApp or post to a provider; every provider call is HTTP(S) from this process.
 */
import childProcess from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { syncBuiltinESMExports } from "node:module";

export interface BlockedAttempt {
  at: string;
  host: string;
  port: number | string | null;
  stack: string[];
}

/** Printed to stderr when a refusal could not be written to the log; the global teardown fails the run on it. */
export const LOG_WRITE_FAILED_MARKER = "[e2e outbound block] LOG WRITE FAILED";

/** The canary connects here (TEST-NET-3, never routable). Refusals of exactly this target are not logged as violations. */
export const CANARY_HOST = "203.0.113.1";
export const CANARY_PORT = 9;

const LOOPBACK_NAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function isValidIpv4(h: string): boolean {
  const parts = h.split(".");
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

export function isLoopbackHost(host: string | undefined | null): boolean {
  if (host === undefined || host === null || host === "") return true; // node defaults to localhost
  const h = host.toLowerCase();
  if (LOOPBACK_NAMES.has(h)) return true;
  if (isValidIpv4(h) && h.startsWith("127.")) return true;
  const mapped = /^::ffff:(.+)$/.exec(h);
  if (mapped && isValidIpv4(mapped[1]) && mapped[1].startsWith("127.")) return true;
  return false;
}

interface Target {
  kind: "ipc" | "tcp";
  host?: string;
  port?: number | string;
}

/** A Windows pipe path is local only as \\.\pipe\x or \\?\pipe\x. \\host\pipe\x reaches another machine. */
function describePath(p: string): Target {
  const unc = /^[\\/]{2}([^\\/]+)[\\/]/.exec(p);
  if (!unc) return { kind: "ipc" };
  const host = unc[1];
  if (host === "." || host === "?") return { kind: "ipc" };
  return { kind: "tcp", host };
}

/** Mirrors the argument shapes of Socket.connect: (options), (port[, host]), (path), or node's pre-normalised array. */
export function describeTarget(args: unknown[]): Target {
  let first: unknown = args[0];
  let second: unknown = args[1];
  if (Array.isArray(first)) {
    first = first[0];
    second = undefined;
  }
  if (first !== null && typeof first === "object") {
    const o = first as { path?: unknown; port?: unknown; host?: unknown; hostname?: unknown };
    if (typeof o.path === "string" && o.port === undefined) return describePath(o.path);
    const host = typeof o.host === "string" ? o.host : typeof o.hostname === "string" ? o.hostname : undefined;
    return { kind: "tcp", host, port: o.port as number | string | undefined };
  }
  if (typeof first === "string" && first.trim() !== "" && !(Number(first) >= 0)) return describePath(first); // connect(path)
  return { kind: "tcp", host: typeof second === "string" ? second : undefined, port: first as number | string | undefined };
}

function stackSummary(): string[] {
  const lines = (new Error().stack ?? "")
    .split("\n")
    .slice(1)
    .map((l) => l.trim())
    .filter((l) => !l.includes("block-outbound"));
  // Prefer the app's own frames; fall back to node's when the call came entirely from inside node (e.g. fetch).
  const own = lines.filter((l) => !l.includes("(node:") && !l.startsWith("at node:") && !l.includes("node_modules"));
  return (own.length > 0 ? own : lines).slice(0, 5);
}

function record(logFile: string, attempt: BlockedAttempt): void {
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile, JSON.stringify(attempt) + "\n");
  } catch (err) {
    // Never let the refusal depend on the log. Say so loudly instead.
    process.stderr.write(`${LOG_WRITE_FAILED_MARKER}: ${(err as Error).message} (host ${attempt.host}:${attempt.port})\n`);
  }
}

/* ------------------------------ child processes ----------------------------- */

const BROWSER_EXECUTABLE = /(^|[\\/\s"'])(chrome|chromium|chromium-browser|google-chrome[\w.-]*|chrome-headless-shell|headless_shell|msedge|microsoft-edge[\w.-]*|firefox)(\.exe)?(["'\s]|$)/i;

/** True when this executable (or shell command line) would start a web browser. */
export function isBrowserCommand(commandOrFile: unknown): boolean {
  if (typeof commandOrFile !== "string") return false;
  return BROWSER_EXECUTABLE.test(commandOrFile) || /puppeteer/i.test(commandOrFile);
}

type AnyFn = (...args: unknown[]) => unknown;
const WRAPPED_FUNCTIONS = ["spawn", "spawnSync", "execFile", "execFileSync", "exec", "execSync", "fork"] as const;

/* --------------------------------- install --------------------------------- */

export interface InstallOptions {
  logFile: string;
}

let installed = false;

export function installOutboundBlock(opts: InstallOptions): () => void {
  if (installed) throw new Error("outbound block is already installed");
  installed = true;
  const originalConnect = net.Socket.prototype.connect;

  function guarded(this: net.Socket, ...args: unknown[]): net.Socket {
    const target = describeTarget(args);
    if (target.kind === "tcp" && !isLoopbackHost(target.host)) {
      const attempt: BlockedAttempt = {
        at: new Date().toISOString(),
        host: String(target.host),
        port: target.port ?? null,
        stack: stackSummary(),
      };
      const isCanary = target.host === CANARY_HOST && Number(target.port) === CANARY_PORT;
      if (!isCanary) record(opts.logFile, attempt);
      const err = Object.assign(new Error(`[e2e outbound block] refused connection to ${attempt.host}:${attempt.port}`), {
        code: "E2E_OUTBOUND_BLOCKED",
      });
      process.nextTick(() => this.destroy(err));
      return this;
    }
    return (originalConnect as (...a: unknown[]) => net.Socket).apply(this, args);
  }
  net.Socket.prototype.connect = guarded as unknown as typeof net.Socket.prototype.connect;

  const originals = new Map<string, AnyFn>();
  const cp = childProcess as unknown as Record<string, AnyFn>;
  for (const name of WRAPPED_FUNCTIONS) {
    const original = cp[name];
    originals.set(name, original);
    cp[name] = function wrapped(this: unknown, ...args: unknown[]) {
      const first = args[0];
      // exec/execSync take a command line; the others take a file. fork takes a module path (never a browser).
      if (name !== "fork" && isBrowserCommand(first)) {
        record(opts.logFile, { at: new Date().toISOString(), host: `child_process.${name}:${String(first).slice(0, 120)}`, port: null, stack: stackSummary() });
        throw Object.assign(new Error(`[e2e outbound block] refused to start a browser: ${String(first).slice(0, 120)}`), { code: "E2E_OUTBOUND_BLOCKED" });
      }
      return original.apply(this, args);
    };
    // Keep everything hung off the original, e.g. util.promisify.custom on exec / execFile.
    Object.defineProperties(cp[name], Object.getOwnPropertyDescriptors(original));
  }
  // Named imports of "node:child_process" in ES modules must see the wrappers too.
  syncBuiltinESMExports();

  return () => {
    net.Socket.prototype.connect = originalConnect;
    for (const [name, fn] of originals) cp[name] = fn;
    syncBuiltinESMExports();
    installed = false;
  };
}

/** Tries to reach the canary host and resolves with whether the block refused it. Never throws. */
export function runCanary(): Promise<{ refused: boolean; code: string | null; at: string }> {
  return new Promise((resolve) => {
    const finish = (refused: boolean, code: string | null) => resolve({ refused, code, at: new Date().toISOString() });
    try {
      const s = net.connect({ host: CANARY_HOST, port: CANARY_PORT });
      s.once("error", (err: NodeJS.ErrnoException) => finish(err.code === "E2E_OUTBOUND_BLOCKED", err.code ?? null));
      s.once("connect", () => {
        s.destroy();
        finish(false, "CONNECTED");
      });
    } catch (err) {
      finish(false, (err as NodeJS.ErrnoException).code ?? "THREW");
    }
  });
}
