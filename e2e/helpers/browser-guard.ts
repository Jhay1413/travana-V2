import type { BrowserContext, Route } from "@playwright/test";
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { BASE_URL, BROWSER_LOG } from "./env";

/**
 * Browser-side half of the outbound block. Every request the page makes that is not to the test
 * server is aborted, except api.postcodes.io, which gets a fake answer (the client form's postcode
 * lookup calls it straight from the browser).
 *
 * Aborted requests are recorded. A request to a host in IGNORED_HOSTS is aborted silently (it does
 * not fail the test); anything else is "unexpected" and the fixture fails the test with the list.
 *
 * Decision on fonts / analytics: Google Fonts is linked from client/index.html. It carries no
 * data and no behaviour, only typography, so it is aborted and ignored (the page falls back to
 * system fonts; no locator in the suite depends on a font). Analytics/tracking hosts are NOT on
 * the ignore list: if the app ever starts calling one, the test fails and a human decides.
 */
export const IGNORED_HOSTS: Record<string, string> = {
  "fonts.googleapis.com": "Google Fonts stylesheet linked from client/index.html; typography only",
  "fonts.gstatic.com": "Google Fonts font files; typography only",
};

/** Chromium flag as a second layer: every hostname except localhost fails to resolve. */
export const BROWSER_ARGS = ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1"];

export const FAKE_POSTCODE = { postcode: "NE1 4ST", district: "Newcastle upon Tyne", country: "England" } as const;

export interface AbortedRequest {
  url: string;
  host: string;
  resourceType: string;
  ignored: boolean;
}

const testOrigin = new URL(BASE_URL).origin;

function fakePostcodeResponse(url: URL): { status: number; body: unknown } {
  const asked = decodeURIComponent(url.pathname.split("/").pop() ?? "").replace(/\s+/g, "").toUpperCase();
  if (asked === FAKE_POSTCODE.postcode.replace(/\s+/g, "")) {
    return {
      status: 200,
      body: {
        status: 200,
        result: {
          postcode: FAKE_POSTCODE.postcode,
          admin_district: FAKE_POSTCODE.district,
          country: FAKE_POSTCODE.country,
        },
      },
    };
  }
  return { status: 404, body: { status: 404, error: "Invalid postcode" } };
}

/** Appends one violation to the browser log (same line format as the server log). */
export function recordBrowserViolation(entry: AbortedRequest, logFile: string = BROWSER_LOG): void {
  mkdirSync(path.dirname(logFile), { recursive: true });
  appendFileSync(logFile, JSON.stringify({ at: new Date().toISOString(), host: entry.host, port: null, stack: [`${entry.resourceType} ${entry.url}`] }) + "\n");
}

/** Installs the guard on a context and returns the live list of aborted requests. */
export async function installBrowserGuard(context: BrowserContext): Promise<AbortedRequest[]> {
  const aborted: AbortedRequest[] = [];
  await context.route(
    (url) => url.origin !== testOrigin && (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "ws:" || url.protocol === "wss:"),
    async (route: Route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "api.postcodes.io" && route.request().method() === "GET") {
        const { status, body } = fakePostcodeResponse(url);
        await route.fulfill({
          status,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify(body),
        });
        return;
      }
      const entry: AbortedRequest = {
        url: url.origin + url.pathname,
        host: url.hostname,
        resourceType: route.request().resourceType(),
        ignored: Object.hasOwn(IGNORED_HOSTS, url.hostname),
      };
      aborted.push(entry);
      // Recorded to a file too, so the global teardown fails the run even if the test is test.fail or is retried.
      if (!entry.ignored) recordBrowserViolation(entry);
      await route.abort("blockedbyclient");
    },
  );
  return aborted;
}

export function unexpectedRequests(aborted: AbortedRequest[]): AbortedRequest[] {
  return aborted.filter((a) => !a.ignored);
}
