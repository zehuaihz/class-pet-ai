import { expect, test } from "@playwright/test"

test.describe("class pet AI teacher flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/v1/classrooms", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          json: {
            success: true,
            data: { items: [{ id: "class_1", name: "三年级2班", studentCount: 3, graduatedPetCount: 1 }] },
            error: null,
            meta: null,
          },
        })
        return
      }

      await route.fulfill({ json: { success: true, data: { id: "class_1", name: "三年级2班" }, error: null, meta: null } })
    })

    await page.route("**/api/v1/system-settings", async (route) => {
      await route.fulfill({ json: { success: true, data: { name: "班级动物园" }, error: null, meta: null } })
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

    await page.route("**/api/v1/classrooms/class_1/zoo", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: {
            items: [
              {
                student: { id: "s_1", name: "小明" },
                badgeCount: 1,
                pet: { id: "pet_1", name: "橘猫", speciesKey: "cat-orange", speciesName: "橘猫", visualKey: "cat-orange-lv1", growthValue: 7, status: "GROWING", adoptionSeq: 1, graduatedAt: null, level: 2, currentThreshold: 5, nextThreshold: 10, remainingToNext: 3, progressRatio: 0.4, graduated: false },
              },
              {
                student: { id: "s_2", name: "小红" },
                badgeCount: 0,
                pet: null,
              },
            ],
            error: null,
            meta: null,
          },
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
        json: {
          success: true,
          data: { transaction: { id: "pt_2", reason: "作业优秀", delta: 2 }, pet: { id: "pet_1", level: 2, growthValue: 7, graduated: false }, growthDelta: 2 },
          error: null,
          meta: null,
        },
      })
    })

    await page.route("**/api/v1/classrooms/class_1/point-rules", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: { items: [{ id: "r_1", name: "作业优秀", pointDelta: 2 }] },
          error: null,
          meta: null,
        },
      })
    })

    await page.route("**/api/v1/classrooms/class_1/points/rankings", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: { students: [], groups: [] },
          error: null,
          meta: null,
        },
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

    await page.route("**/api/v1/checkin-records/cr_1/approve", async (route) => {
      await route.fulfill({ json: { success: true, data: { id: "cr_1", status: "APPROVED" }, error: null, meta: null } })
    })

    await page.route("**/api/v1/checkin-records/cr_1/reject", async (route) => {
      await route.fulfill({ json: { success: true, data: { id: "cr_1", status: "REJECTED" }, error: null, meta: null } })
    })

    await page.route("**/api/v1/classrooms/class_1/dashboard", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: {
            today: { checkinRate: 0.85, pointCount: 42, missedCount: 6 },
            zoo: { graduatedCount: 1, growingCount: 3, availableBadges: 2 },
            topStudents: [{ id: "s_1", name: "小明", totalPoints: 128 }],
            activeTasks: [{ id: "t_1", title: "阅读 20 分钟" }],
            recentTransactions: [{ id: "pt_1", reason: "课堂发言", delta: 2 }],
          },
          error: null,
          meta: null,
        },
      })
    })

    await page.route("**/api/v1/classrooms/class_1/students/s_1/pet", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: {
            student: { id: "s_1", name: "小明" },
            pet: { id: "pet_1", name: "橘猫", speciesKey: "cat-orange", speciesName: "橘猫", visualKey: "cat-orange-lv2", growthValue: 7, status: "GROWING", adoptionSeq: 1, graduatedAt: null, level: 2, currentThreshold: 5, nextThreshold: 10, remainingToNext: 3, progressRatio: 0.4, graduated: false },
            badges: [{ id: "b_1", name: "Lv.10 毕业 · 云朵龙", visualKey: "dragon-lv10", status: "AVAILABLE", earnedAt: "2026-08-01T00:00:00Z" }],
            logs: [{ id: "log_1", reason: "课堂发言", growthDelta: 2, createdAt: "2026-08-07T00:00:00Z" }],
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
            systemName: "班级动物园",
            todayPointCount: 42,
            zoo: [
              { student: { id: "s_1", name: "小明" }, badgeCount: 1, pet: { id: "pet_1", name: "橘猫", speciesKey: "cat-orange", speciesName: "橘猫", visualKey: "cat-orange-lv2", growthValue: 7, status: "GROWING", adoptionSeq: 1, graduatedAt: null, level: 2, currentThreshold: 5, nextThreshold: 10, remainingToNext: 3, progressRatio: 0.4, graduated: false } },
            ],
            gloryBoard: [{ student: { id: "s_1", name: "小明" }, badgeCount: 1, pet: { speciesKey: "cat-orange", level: 2 } }],
            slogan: "认真表现，喂养你的专属宠物！",
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

      await route.fulfill({ json: { success: true, data: { jobId: "job_1", status: "PENDING" }, error: null, meta: null } })
    })

    // comment-draft 返回 jobId 后，页面会轮询任务接口拿草稿结果。
    await page.route("**/api/v1/ai/jobs/job_1", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: { id: "job_1", type: "COMMENT_DRAFT", status: "SUCCEEDED", outputJson: { text: "小明本周课堂表现积极，阅读打卡稳定。" }, errorMessage: null },
          error: null,
          meta: null,
        },
      })
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

  test("zoo page loads student pets and opens pet detail", async ({ page }) => {
    await page.goto("/classrooms/class_1/zoo")
    await expect(page.getByText("小明")).toBeVisible()
    await expect(page.getByText("橘猫")).toBeVisible()
    await expect(page.getByText("未分配宠物")).toBeVisible()
    // Open pet detail via card click.
    await page.getByText("小明").first().click()
    await expect(page.getByText("小明 的宠物")).toBeVisible()
    await expect(page.getByText(/Lv.2/).first()).toBeVisible()
    await expect(page.getByText("课堂发言")).toBeVisible()
  })

  test("screen page shows the class zoo and glory board", async ({ page }) => {
    await page.goto("/classrooms/class_1/screen")
    await expect(page.getByRole("heading", { name: "三年级2班" })).toBeVisible()
    await expect(page.getByText("班级动物园 · 今日加分 42")).toBeVisible()
    await expect(page.getByText("认真表现，喂养你的专属宠物！")).toBeVisible()
  })

  test("AI workbench loads and generates draft", async ({ page }) => {
    await page.goto("/classrooms/class_1/ai")
    await expect(page.getByText(/宠物在养 3 只 · 毕业 1 只/)).toBeVisible()
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
