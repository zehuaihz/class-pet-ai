import { defineConfig, devices } from "@playwright/test"
import { resolveE2EEnv } from "./e2e/real/env"

const env = resolveE2EEnv()

/**
 * Authenticated E2E suite. Unlike playwright.config.ts (mocked UI contracts),
 * this one boots a real server against the dedicated test database, seeds real
 * accounts and drives real login sessions.
 */
export default defineConfig({
  testDir: "./e2e/real",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["html", { outputFolder: "playwright-report/real" }], ["list"]],
  globalSetup: "./e2e/real/global-setup.ts",
  use: {
    baseURL: `http://localhost:${env.port}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `npx next dev -p ${env.port}`,
    url: `http://localhost:${env.port}/api/health/live`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: env.databaseUrl,
      SESSION_SECRET: env.sessionSecret,
      TEACHER_LOGIN_EMAIL: env.teacherEmail,
      TEACHER_LOGIN_PASSWORD: env.teacherPassword,
      AI_PROVIDER: "mock",
      NODE_ENV: "test",
      LOGIN_RATE_LIMIT_MAX: "200",
    },
  },
  projects: [{ name: "real-chromium", use: { ...devices["Desktop Chrome"] } }],
})
