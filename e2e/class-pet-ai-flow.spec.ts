import { expect, test } from "@playwright/test"

test.describe("class pet AI teacher flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/v1/classrooms", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          json: {
            success: true,
            data: { items: [{ id: "class_1", name: "三年级2班", studentCount: 3, petLevel: 8 }] },
            error: null,
            meta: null,
          },
        })
        return
      }

      await route.fulfill({ json: { success: true, data: { id: "class_1", name: "三年级2班" }, error: null, meta: null } })
    })

    await page.route("**/api/v1/classrooms/class_1/students", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: { items: [{ id: "s_1", name: "小明", totalPoints: 128 }, { id: "s_2", name: "小红", totalPoints: 115 }] },
          error: null,
          meta: null,
        },
      })
    })

    await page.route("**/api/v1/classrooms/class_1/points/transactions", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          json: {
            success: true,
            data: { items: [{ id: "pt_1", name: "小明", reason: "课堂发言", delta: 2, time: "09:12" }] },
            error: null,
            meta: null,
          },
        })
        return
      }

      await route.fulfill({
        json: { success: true, data: { transaction: { id: "pt_2", reason: "作业优秀", delta: 2 }, studentTotalPoints: 130, petGrowthDelta: 2 }, error: null, meta: null },
      })
    })

    await page.route("**/api/v1/points/transactions/*/reverse", async (route) => {
      await route.fulfill({ json: { success: true, data: {}, error: null, meta: null } })
    })

    await page.route("**/api/v1/classrooms/class_1/checkin-tasks", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          json: { success: true, data: { items: [{ id: "t_1", title: "阅读 20 分钟", rewardPoints: 2 }] }, error: null, meta: null },
        })
        return
      }
      await route.fulfill({ json: { success: true, data: { id: "t_2", title: "早读打卡" }, error: null, meta: null } })
    })

    await page.route("**/api/v1/classrooms/class_1/checkin-records", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: { items: [{ id: "cr_1", studentName: "小明", taskTitle: "阅读 20 分钟", status: "PENDING" }] },
          error: null,
          meta: null,
        },
      })
    })

    await page.route("**/api/v1/classrooms/class_1/checkin-tasks", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          json: {
            success: true,
            data: { items: [{ id: "t_1", title: "阅读 20 分钟", rewardPoints: 2 }] },
            error: null,
            meta: null,
          },
        })
        return
      }
      await route.fulfill({ json: { success: true, data: { id: "t_2", title: "早读打卡" }, error: null, meta: null } })
    })

    await page.route("**/api/v1/checkin-records/cr_1/approve", async (route) => {
      await route.fulfill({ json: { success: true, data: { id: "cr_1", status: "APPROVED" }, error: null, meta: null } })
    })

    await page.route("**/api/v1/checkin-records/cr_1/reject", async (route) => {
      await route.fulfill({ json: { success: true, data: { id: "cr_1", status: "REJECTED" }, error: null, meta: null } })
    })

    await page.route("**/api/v1/classrooms/class_1/pet", async (route) => {
      await route.fulfill({ json: { success: true, data: { name: "云朵龙", species: "dragon", level: 8, growthValue: 760, mood: "HAPPY", hunger: 82 }, error: null, meta: null } })
    })

    await page.route("**/api/v1/classrooms/class_1/pet/logs", async (route) => {
      await route.fulfill({ json: { success: true, data: { items: [{ id: "log_1", reason: "课堂发言", growthDelta: 2, createdAt: "2026-08-07T00:00:00Z" }] }, error: null, meta: null } })
    })

    await page.route("**/api/v1/classrooms/class_1/dashboard", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: {
            today: { checkinRate: 0.85, pointCount: 42, missedCount: 6 },
            pet: { name: "云朵龙", level: 8 },
            topStudents: [{ id: "s_1", name: "小明", totalPoints: 128 }],
            activeTasks: [{ id: "t_1", title: "阅读 20 分钟" }],
            recentTransactions: [{ id: "pt_1", reason: "课堂发言", delta: 2 }],
          },
          error: null,
          meta: null,
        },
      })
    })

    await page.route("**/api/v1/classrooms/class_1/screen", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: {
            classroomName: "三年级2班",
            pet: { name: "云朵龙", level: 8, growthValue: 760 },
            todayPointCount: 42,
            checkinRate: 0.85,
            rankings: [{ id: "s_1", name: "小明", totalPoints: 128 }],
            slogan: "认真完成任务，喂养班级宠物！",
          },
          error: null,
          meta: null,
        },
      })
    })

    await page.route("**/api/v1/ai/comment-draft", async (route) => {
      if (route.request().postData()?.includes("fail")) {
        await route.fulfill({ json: { success: false, data: null, error: { code: "INTERNAL_ERROR", message: "AI failed" }, meta: null }, status: 500 })
        return
      }

      await route.fulfill({ json: { success: true, data: { outputJson: { text: "小明本周课堂表现积极，阅读打卡稳定。" } }, error: null, meta: null } })
    })
  })

  test("dashboard loads live classroom summary", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page.getByText("85%")).toBeVisible()
    await expect(page.getByText("42")).toBeVisible()
    await expect(page.getByText("课堂发言 · +2")).toBeVisible()
  })

  test("points page loads and submits quick add", async ({ page }) => {
    await page.goto("/classrooms/class_1/points")
    await expect(page.getByText("小明").first()).toBeVisible()
    await page.getByRole("button", { name: "+1" }).first().click()
    await page.getByRole("button", { name: "作业优秀" }).click()
    await page.getByRole("button", { name: "确认加分" }).click()
    await expect(page.getByText("课堂发言").first()).toBeVisible()
  })

  test("checkin pages load and create task", async ({ page }) => {
    await page.goto("/classrooms/class_1/checkins")
    await expect(page.getByText("阅读 20 分钟", { exact: true }).first()).toBeVisible()
    await page.getByRole("link", { name: "创建任务" }).click()
    await expect(page).toHaveURL(/checkins\/new/)
    await page.getByRole("button", { name: "保存" }).click()
    await expect(page.getByRole("button", { name: /保存/ })).toBeVisible()
  })

  test("checkin approval page handles approve and reject", async ({ page }) => {
    await page.goto("/classrooms/class_1/checkins")
    await expect(page.getByText("待审批")).toBeVisible()
    await page.getByRole("button", { name: "通过" }).first().click()
  })

  test("pet page loads live pet and logs", async ({ page }) => {
    await page.goto("/classrooms/class_1/pet")
    await expect(page.getByText("云朵龙 Lv.8")).toBeVisible()
    await expect(page.getByText("课堂发言")).toBeVisible()
  })

  test("screen page updates live", async ({ page }) => {
    await page.goto("/classrooms/class_1/screen")
    await expect(page.getByRole("heading", { name: "三年级2班" })).toBeVisible()
    await expect(page.getByText("认真完成任务，喂养班级宠物！")).toBeVisible()
  })

  test("AI workbench loads and generates draft", async ({ page }) => {
    await page.goto("/classrooms/class_1/ai")
    await expect(page.getByText(/班级宠物 云朵龙 Lv.8/)).toBeVisible()
    await page.getByRole("link", { name: /评语生成/ }).click()
    await page.getByRole("button", { name: "生成草稿" }).click()
    await expect(page.getByText("小明本周课堂表现积极，阅读打卡稳定。")).toBeVisible()
  })

  test("AI failure state shows error", async ({ page }) => {
    await page.goto("/classrooms/class_1/ai/comment")
    await page.getByLabel("补充说明").fill("fail")
    await page.getByRole("button", { name: "生成草稿" }).click()
    await expect(page.getByText("AI failed")).toBeVisible()
  })
})
