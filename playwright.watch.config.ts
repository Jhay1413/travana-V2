import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

/**
 * Slow-motion run for watching tests by eye (npm run test:e2e:watch).
 * Every browser action waits SLOW_MO ms, so the time limits are stretched to match.
 */
const SLOW_MO = 500;
const base = baseConfig.projects?.[0];

export default defineConfig({
  ...baseConfig,
  timeout: 10 * 60_000,
  expect: { timeout: 30_000 },
  use: { ...baseConfig.use, headless: false, actionTimeout: 60_000, navigationTimeout: 90_000 },
  projects: [
    {
      ...base,
      name: "chromium",
      use: { ...base?.use, launchOptions: { ...base?.use?.launchOptions, slowMo: SLOW_MO } },
    },
  ],
});
