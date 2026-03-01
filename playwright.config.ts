import { defineConfig } from "@playwright/test";

/**
 * E2E tests for the Gist extension.
 * Run: pnpm build && pnpm test:e2e
 * Extension is loaded via fixtures (tests/e2e/fixtures.ts) using a persistent context.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    trace: "on-first-retry",
  },
});
