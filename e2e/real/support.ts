import { readFileSync } from "node:fs"
import type { BrowserContext, Page } from "@playwright/test"
import { E2E_FIXTURES_PATH } from "./env"

export interface E2EFixtures {
  classroomId: string
  studentId: string
  taskId: string
  rewardId: string
  teacher: { identifier: string; password: string }
  studentAccount: { identifier: string; password: string; role: string }
  parentAccount: { identifier: string; password: string; role: string }
  adminAccount: { identifier: string; password: string; role: string }
  suspendedAccount: { identifier: string; password: string; role: string }
}

let cached: E2EFixtures | null = null

export function fixtures(): E2EFixtures {
  if (!cached) cached = JSON.parse(readFileSync(E2E_FIXTURES_PATH, "utf8")) as E2EFixtures
  return cached
}

/**
 * Logs in through the real login route so the browser holds a real signed
 * session cookie — no route stubbing.
 */
export async function loginThroughUi(page: Page, identifier: string, password: string) {
  await page.goto("/auth/login")
  await page.getByPlaceholder("输入账号").fill(identifier)
  await page.getByPlaceholder("输入密码").fill(password)
  await page.getByRole("button", { name: "登录" }).click()
}

/** Establishes a real session directly against the API without rendering the form. */
export async function loginViaApi(context: BrowserContext, baseURL: string, identifier: string, password: string, role?: string) {
  const response = await context.request.post(`${baseURL}/api/v1/auth/login`, {
    data: { identifier, password, loginType: "password", ...(role ? { role } : {}) },
    headers: { "content-type": "application/json" },
  })
  if (!response.ok()) {
    throw new Error(`Login failed for ${identifier}: ${response.status()} ${await response.text()}`)
  }
  return response
}
