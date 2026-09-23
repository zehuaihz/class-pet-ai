import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { test as setup, expect } from "@playwright/test"
import { loadProjectEnv } from "../support/env-file"

const HERE = dirname(fileURLToPath(import.meta.url))

export const TEACHER_STORAGE_STATE = resolve(HERE, "../.auth/teacher.json")

/**
 * The mocked UI specs still need a genuine session, because protected pages now
 * authorize on the server before rendering. This performs one real login and
 * reuses the resulting cookie for every mocked spec.
 */
setup("authenticate as teacher", async ({ request }) => {
  const env = loadProjectEnv()
  const identifier = env.TEACHER_LOGIN_EMAIL
  const password = env.TEACHER_LOGIN_PASSWORD
  if (!identifier || !password) {
    throw new Error("TEACHER_LOGIN_EMAIL and TEACHER_LOGIN_PASSWORD are required to authenticate the E2E suite")
  }

  const response = await request.post("/api/v1/auth/login", {
    data: { identifier, password, loginType: "password" },
    headers: { "content-type": "application/json" },
  })
  expect(response.ok(), `login failed: ${response.status()} ${await response.text()}`).toBeTruthy()

  mkdirSync(dirname(TEACHER_STORAGE_STATE), { recursive: true })
  await request.storageState({ path: TEACHER_STORAGE_STATE })
})
