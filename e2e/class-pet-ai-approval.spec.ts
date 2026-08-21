import { expect, test } from "@playwright/test"

test("approval and reverse flows", async ({ page }) => {
  await page.route("**/api/v1/classrooms", async (route) => {
    await route.fulfill({ json: { success: true, data: { items: [{ id: "class_1", name: "三年级2班", studentCount: 3, graduatedPetCount: 1 }] }, error: null, meta: null } })
  })
  await page.route("**/api/v1/classrooms/class_1/checkin-tasks", async (route) => {
    await route.fulfill({ json: { success: true, data: { items: [{ id: "t_1", title: "阅读 20 分钟", rewardPoints: 2 }] }, error: null, meta: null } })
  })
  await page.route("**/api/v1/classrooms/class_1/checkin-records", async (route) => {
    await route.fulfill({ json: { success: true, data: { items: [{ id: "cr_1", studentName: "小明", taskTitle: "阅读 20 分钟", status: "PENDING" }, { id: "cr_2", studentName: "小红", taskTitle: "作业完成", status: "PENDING" }] }, error: null, meta: null } })
  })
  await page.route("**/api/v1/checkin-records/cr_1/approve", async (route) => {
    await route.fulfill({ json: { success: true, data: { id: "cr_1", status: "APPROVED" }, error: null, meta: null } })
  })
  await page.route("**/api/v1/points/transactions/pt_1/reverse", async (route) => {
    await route.fulfill({ json: { success: true, data: { transaction: { id: "pt_2" } }, error: null, meta: null } })
  })
  await page.route("**/api/v1/classrooms/class_1/points/transactions", async (route) => {
    await route.fulfill({ json: { success: true, data: { items: [{ id: "pt_1", name: "小明", reason: "课堂发言", delta: 2, createdAt: "2026-08-21T01:12:00.000Z" }] }, error: null, meta: null } })
  })
  await page.route("**/api/v1/classrooms/class_1/students", async (route) => {
    await route.fulfill({ json: { success: true, data: { items: [{ id: "s_1", name: "小明", totalPoints: 128 }] }, error: null, meta: null } })
  })

  await page.goto("/classrooms/class_1/checkins")
  await expect(page.getByText("阅读 20 分钟", { exact: true }).first()).toBeVisible()
  await page.getByRole("button", { name: "通过" }).first().click()

  await page.goto("/classrooms/class_1/points")
  await page.getByRole("button", { name: "撤销" }).first().click()
  await expect(page.getByText("小明", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("课堂发言 · 09:12")).toBeVisible()
})
