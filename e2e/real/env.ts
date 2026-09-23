import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { loadProjectEnv } from "../support/env-file"

const HERE = dirname(fileURLToPath(import.meta.url))

export const E2E_FIXTURES_PATH = resolve(HERE, "fixtures.json")

// A database dedicated to the browser suite, kept separate from the Vitest
// integration database so the two can run without truncating each other.
const TEST_DATABASE_NAME = "class_pet_ai_e2e"
const SAFE_DATABASE_NAME = /(test|e2e)/i

/**
 * The real E2E suite must never run against the development database, so the
 * target URL is derived by swapping the database name for the dedicated test
 * database and then asserted to still look like a test database.
 */
export function resolveE2EEnv() {
  const merged = loadProjectEnv()

  const baseUrl = merged.DATABASE_URL
  if (!baseUrl) throw new Error("DATABASE_URL is required to derive the E2E database URL")

  const url = new URL(baseUrl)
  if (merged.E2E_DATABASE_URL) {
    url.href = merged.E2E_DATABASE_URL
  } else {
    url.pathname = `/${TEST_DATABASE_NAME}`
  }

  const databaseName = url.pathname.replace(/^\//, "")
  if (!SAFE_DATABASE_NAME.test(databaseName)) {
    throw new Error(`Refusing to run real E2E against non-test database "${databaseName}"`)
  }

  if (!merged.SESSION_SECRET) throw new Error("SESSION_SECRET is required to start the E2E server")

  return {
    databaseUrl: url.toString(),
    databaseName,
    sessionSecret: merged.SESSION_SECRET,
    teacherEmail: merged.TEACHER_LOGIN_EMAIL ?? "",
    teacherPassword: merged.TEACHER_LOGIN_PASSWORD ?? "",
    port: Number(merged.E2E_PORT ?? 3100),
  }
}

export const E2E_CREDENTIALS = {
  student: { identifier: "student.e2e@example.com", password: "student-pass-123", role: "STUDENT" },
  parent: { identifier: "parent.e2e@example.com", password: "parent-pass-123", role: "PARENT" },
  admin: { identifier: "admin.e2e@example.com", password: "admin-pass-123", role: "ADMIN" },
  suspended: { identifier: "suspended.e2e@example.com", password: "suspended-pass-123", role: "PARENT" },
} as const

export const E2E_CLASSROOM_NAME = "E2E 测试班级"
export const E2E_TASK_TITLE = "E2E 每日阅读打卡"
export const E2E_REWARD_NAME = "E2E 奖励贴纸"
