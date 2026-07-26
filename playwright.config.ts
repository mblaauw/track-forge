import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: [
    {
      // Fastify API server with dry-run (fake providers)
      command: process.env.CI
        ? "npm run build && npm run -w apps/server start"
        : "npm run -w apps/server dev",
      port: 3000,
      reuseExistingServer: !process.env.CI,
      env: {
        SUNO_DRY_RUN: "true",
      },
    },
  ],
});
