// Must stay the first import: it switches the E2E helpers to the two-host run before they are evaluated.
import "./e2e/helpers/two-hosts-flag";
import { defineConfig, devices } from "@playwright/test";
import { BASE_URL } from "./e2e/helpers/env";
import { BROWSER_ARGS } from "./e2e/helpers/browser-guard";

const isCI = Boolean(process.env.CI);

/**
 * The two-host run (npm run test:e2e:hosts): the customer portal and the public quote page are served from
 * http://portal.localhost:5057 while the staff site is http://localhost:5057 (same app, same server, PORTAL_BASE_URL set).
 * Same global setup, same safety guard and outbound block as the main suite; only the port, the portal host name and
 * the specs (e2e/hosts) differ. The main suite (playwright.config.ts) never sets PORTAL_BASE_URL and ignores e2e/hosts.
 * Like the main suite it needs the practice database (npm run db:test:up) and must not run at the same time as it.
 */
export default defineConfig({
  testDir: "./e2e/hosts",
  testMatch: "**/*.spec.ts",
  globalSetup: "./e2e/global-setup.ts",
  outputDir: "./test-results",

  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  forbidOnly: isCI,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],

  use: {
    baseURL: BASE_URL,
    timezoneId: "Europe/London",
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 }, launchOptions: { args: BROWSER_ARGS } },
    },
  ],
});
