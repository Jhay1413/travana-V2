import { existsSync, readFileSync } from "node:fs";
import { LOG_WRITE_FAILED_MARKER, type BlockedAttempt } from "./block-outbound";
import { BROWSER_LOG, OUTBOUND_LOG } from "./env";

/**
 * Startup connections that are allowed to be blocked without failing the run. Every entry must be a
 * named, explained, non-messaging host. They are still blocked and still logged; they are only
 * left out of the failure. Empty on purpose: add to it only after reading what the call is.
 */
export const KNOWN_HARMLESS_STARTUP_HOSTS: Record<string, string> = {};

export function readOutboundAttempts(logFile: string = OUTBOUND_LOG): BlockedAttempt[] {
  if (!existsSync(logFile)) return [];
  return readFileSync(logFile, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as BlockedAttempt);
}

export function unexpectedAttempts(attempts: BlockedAttempt[]): BlockedAttempt[] {
  return attempts.filter((a) => !Object.hasOwn(KNOWN_HARMLESS_STARTUP_HOSTS, a.host));
}

/** The loud failure message for the global teardown. Empty string when there is nothing to report. */
export function formatOutboundFailure(attempts: BlockedAttempt[], logFile: string = OUTBOUND_LOG): string {
  const unexpected = unexpectedAttempts(attempts);
  if (unexpected.length === 0) return "";
  const bar = "!".repeat(70);
  const lines = unexpected.map((a) => `  ${a.at}  ${a.host}:${a.port}\n      ${a.stack.join("\n      ")}`);
  return [
    "",
    bar,
    `OUTBOUND CONNECTION ATTEMPTS BLOCKED DURING THE E2E RUN: ${unexpected.length}`,
    ...lines,
    `Full log: ${logFile}`,
    bar,
  ].join("\n");
}

/** Teardown input: the server log, the browser log, and whether the server reported it could not write its log. */
export interface RunViolations {
  server: BlockedAttempt[];
  browser: BlockedAttempt[];
  logWriteFailed: boolean;
}

export function readRunViolations(serverLogText = ""): RunViolations {
  return {
    server: readOutboundAttempts(OUTBOUND_LOG),
    browser: readOutboundAttempts(BROWSER_LOG),
    logWriteFailed: serverLogText.includes(LOG_WRITE_FAILED_MARKER),
  };
}

export function formatRunViolations(v: RunViolations): string {
  const parts: string[] = [];
  if (v.server.length) parts.push("SERVER (sockets and child processes):" + formatOutboundFailure(v.server, OUTBOUND_LOG));
  if (v.browser.length) parts.push("BROWSER (requests outside the test server):" + formatOutboundFailure(v.browser, BROWSER_LOG));
  if (v.logWriteFailed) parts.push(`The server could not write its outbound log (look for "${LOG_WRITE_FAILED_MARKER}" in test-results/e2e-server.log). Treat the run as failed.`);
  return parts.join("\n");
}
