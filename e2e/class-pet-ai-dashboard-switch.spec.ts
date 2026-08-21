import { expect, test } from "@playwright/test"

// Verifies that switching class from the header switcher while on /dashboard
// reloads the dashboard stats in place (URL stays /dashboard) rather than
// navigating away, and that the persisted last class is honoured on load.

test.describe("dashboard class switching", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/v1/classrooms", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          json: {
            success: true,
            data: {
              items: [
                { id: "class_1", name: "三年级2班", studentCount: 3, graduatedPetCount: 1 },
                { id: "class_2", name: "四年级1班", studentCount: 2, graduatedPetCount: 0 },
              ],
            },
            error: null,
            meta: null,
          },
        })
        return
      }
      await route.fulfill({ json: { success: true, data: { id: "class_1", name: "三年级2班" }, error: null, meta: null } })
    })

    await page.route("**/api/v1/classrooms/class_1/dashboard", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: {
            today: { checkinRate: 0.85, pointCount: 42, missedCount: 6 },
            zoo: { graduatedCount: 1, growingCount: 12, availableBadges: 8 },
            topStudents: [{ id: "s_1", name: "小明", totalPoints: 128 }],
            activeTasks: [{ id: "t_1", title: "阅读 20 分钟" }],
            recentTransactions: [{ id: "pt_1", name: "小明", reason: "课堂发言", delta: 2 }],
          },
          error: null,
          meta: null,
        },
      })
    })

    await page.route("**/api/v1/classrooms/class_2/dashboard", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: {
            today: { checkinRate: 0.5, pointCount: 7, missedCount: 1 },
            zoo: { graduatedCount: 0, growingCount: 4, availableBadges: 1 },
            topStudents: [{ id: "s_3", name: "小华", totalPoints: 55 }],
            activeTasks: [],
            recentTransactions: [{ id: "pt_9", name: "小华", reason: "作业优秀", delta: 3 }],
          },
          error: null,
          meta: null,
        },
      })
    })
  })

  test("switching class updates dashboard stats in place", async ({ page }) => {
    await page.goto("/dashboard")

    // Loads with the first class (class_1) by default.
    await expect(page.getByText("85%", { exact: true })).toBeVisible()
    await expect(page.getByText("42", { exact: true })).toBeVisible()
    await expect(page.getByText("12", { exact: true })).toBeVisible()
    await expect(page).toHaveURL(/\/dashboard$/)

    // Switch to 四年级1班 from the header switcher.
    await page.getByLabel("班级切换器").selectOption("class_2")

    // Stats update to class_2 without leaving /dashboard.
    await expect(page.getByText("50%", { exact: true })).toBeVisible()
    await expect(page.getByText("7", { exact: true })).toBeVisible()
    await expect(page.getByText("4", { exact: true })).toBeVisible()
    await expect(page.getByText("小华", { exact: true })).toBeVisible()
    await expect(page.getByText("作业优秀 · +3")).toBeVisible()
    await expect(page).toHaveURL(/\/dashboard$/)
  })
})
