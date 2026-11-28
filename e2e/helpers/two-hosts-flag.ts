/**
 * Import this FIRST in playwright.hosts.config.ts. It switches the E2E helpers (helpers/env.ts) to the two-host
 * run before they are evaluated, in the runner and in every worker it starts (they inherit this variable).
 */
process.env.E2E_TWO_HOSTS = "1";
