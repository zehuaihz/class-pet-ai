import { defineConfig, devices } from "@playwright/test"
import { resolveE2EEnv } from "./e2e/real/env"

const TEACHER_STORAGE_STATE = "e2e/.auth/teacher.json"
const env = resolveE2EEnv()

/**
 * Mocked UI-contract suite: API responses are stubbed, but page-level role
 * guards are real, so every spec reuses one real teacher session against the
 * dedicated browser-suite database (never the development database).
 * The database-backed suite lives in playwright.real.config.ts.
 */
export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["**/real/**"],
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html"], ["list"]],
  globalSetup: "./e2e/setup/global-setup.ts",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: env.databaseUrl,
      SESSION_SECRET: env.sessionSecret,
      TEACHER_LOGIN_EMAIL: env.teacherEmail,
      TEACHER_LOGIN_PASSWORD: env.teacherPassword,
      AI_PROVIDER: "mock",
      LOGIN_RATE_LIMIT_MAX: "200",
      NODE_ENV: "test",
    },
  },
  projects: [
    { name: "setup", testMatch: /setup\/auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: TEACHER_STORAGE_STATE },
      dependencies: ["setup"],
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"], storageState: TEACHER_STORAGE_STATE },
      dependencies: ["setup"],
    },
  ],
})
