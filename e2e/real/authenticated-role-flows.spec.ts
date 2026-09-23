import { expect, test } from "@playwright/test"
import { fixtures, loginThroughUi, loginViaApi } from "./support"

/**
 * Real login against the real API + PostgreSQL. Every request here goes through
 * the actual session cookie, role guards and ownership checks.
 */
test.describe("authenticated role flows", () => {
  test("teacher logs in with the configured account and reaches the dashboard", async ({ page }) => {
    const data = fixtures()
    await loginThroughUi(page, data.teacher.identifier, data.teacher.password)
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole("heading", { name: "教师 Dashboard" })).toBeVisible()
  })

  test("student session lands on the student area and cannot open teacher pages", async ({ page, baseURL }) => {
    const data = fixtures()
    await loginViaApi(page.context(), baseURL!, data.studentAccount.identifier, data.studentAccount.password, data.studentAccount.role)

    await page.goto("/student")
    await expect(page.getByRole("heading", { name: "我的信息" })).toBeVisible()

    // Page-level guard: a direct URL hit must not render teacher content.
    await page.goto(`/classrooms/${data.classroomId}/students`)
    await expect(page).toHaveURL(/\/forbidden/)
    await expect(page.getByRole("heading", { name: "无权访问" })).toBeVisible()
  })

  test("parent sees only the linked child and a foreign child id returns not found", async ({ page, baseURL }) => {
    const data = fixtures()
    await loginViaApi(page.context(), baseURL!, data.parentAccount.identifier, data.parentAccount.password, data.parentAccount.role)

    await page.goto("/parent")
    await expect(page.getByText("E2E 学生")).toBeVisible()

    const foreign = await page.request.get(`${baseURL}/api/v1/parent/children/not-a-child-id`)
    expect(foreign.status()).toBe(404)
  })

  test("admin can suspend a user, which invalidates that user's session", async ({ page, baseURL }) => {
    const data = fixtures()

    // Suspended-account holder signs in first so we can prove the session dies.
    await loginViaApi(
      page.context(),
      baseURL!,
      data.suspendedAccount.identifier,
      data.suspendedAccount.password,
      data.suspendedAccount.role,
    )
    const beforeSuspension = await page.request.get(`${baseURL}/api/v1/parent/children`)
    expect(beforeSuspension.ok()).toBeTruthy()

    const adminContext = await page.context().browser()!.newContext({ baseURL })
    await loginViaApi(adminContext, baseURL!, data.adminAccount.identifier, data.adminAccount.password, data.adminAccount.role)

    const usersResponse = await adminContext.request.get(
      `${baseURL}/api/v1/admin/users?keyword=${encodeURIComponent("E2E 停用家长")}`,
    )
    expect(usersResponse.ok()).toBeTruthy()
    const users = (await usersResponse.json()) as { data: { items: Array<{ id: string; name: string }> } }
    const target = users.data.items[0]
    expect(target).toBeTruthy()

    const patch = await adminContext.request.patch(`${baseURL}/api/v1/admin/users/${target.id}`, {
      data: { status: "SUSPENDED" },
    })
    expect(patch.ok()).toBeTruthy()

    // The previously valid cookie now fails because sessionVersion was bumped.
    const afterSuspension = await page.request.get(`${baseURL}/api/v1/parent/children`)
    expect(afterSuspension.status()).toBe(401)

    await adminContext.close()
  })

  test("unauthenticated visitors are redirected to the login page", async ({ page }) => {
    await page.goto("/parent")
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})
