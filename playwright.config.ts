import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests for the gala registration wizard.
 *
 * These exist because three of the four bugs found while building the
 * wizard were things `npm run build` cannot catch: a stale dev server,
 * a transform applied in the wrong order, and a boolean wired as a
 * click handler. All three compiled perfectly and all three left the
 * page broken for anyone actually using it.
 *
 * Run against a dev server you have already started:
 *   npx playwright test
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/gala",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
