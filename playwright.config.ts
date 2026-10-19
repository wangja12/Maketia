import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Runs the production build against the test database.
  webServer: [
    {
      command: `pnpm start -p ${port}`,
      url: `http://localhost:${port}`,
      reuseExistingServer: false,
      env: {
        DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
        APP_URL: `http://localhost:${port}`,
        // Chromium resolves *.localhost to the loopback address: real host-based routing in tests.
        PUBLIC_ROOT_DOMAIN: "localhost",
        PUBLIC_DOMAIN_TARGET: "cname.tunnels-ia.test",
        PAYMENT_SECRETS_KEY: Buffer.alloc(32, 9).toString("base64"),
        ANALYTICS_SECRET: "e2e-analytics-secret-not-for-production-use",
      },
    },
  ],
});
