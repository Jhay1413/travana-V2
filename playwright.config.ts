import { defineConfig, devices } from "@playwright/test";
import { BASE_URL } from "./e2e/helpers/env";
import { BROWSER_ARGS } from "./e2e/helpers/browser-guard";

const isCI = Boolean(process.env.CI);

/**
 * End-to-end tests. They run against a real app server (started by
 * e2e/global-setup.ts through e2e/helpers/start-server.ts, with an explicit, credential-free environment) and the
 * disposable Postgres from docker-compose.test.yml (npm run db:test:up).
 * Never use `networkidle` in a test: the SSE stream at /api/v2/realtime stays open.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./e2e/global-setup.ts",
  outputDir: "./test-results",

  // Tests share one database, so run them one at a time.
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  forbidOnly: isCI,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],

  use: {
    baseURL: BASE_URL,
    // Date text on screen ("14 Jun 2027", "Returns: ...") must not depend on the machine's zone.
    timezoneId: "Europe/London",
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  // Tall enough that the floating AI-assistant button does not sit on top of table row menus.
  // The browser also refuses to resolve any host but localhost (second layer behind the route guard in fixtures.ts).
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 }, launchOptions: { args: BROWSER_ARGS } },
    },
  ],
});
