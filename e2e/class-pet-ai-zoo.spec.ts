import { expect, test } from "@playwright/test"

// Class zoo core loop: one-click random pet assignment, feeding that moves the
// pet's growth forward, and the level-up feedback. API responses are stubbed
// with mutable state so the browser flow can be exercised without a database.

test.describe("class zoo core loop", () => {
  test("assigns pets, feeds, and shows growth feedback", async ({ page }) => {
    let pet: Record<string, unknown> | null = null
    const petTemplate = {
      id: "pet_1",
      name: "橘猫",
      speciesKey: "cat-orange",
      speciesName: "橘猫",
      visualKey: "cat-orange-lv1",
      growthValue: 0,
      status: "GROWING",
      adoptionSeq: 1,
      graduatedAt: null,
      level: 1,
      currentThreshold: 0,
      nextThreshold: 5,
      remainingToNext: 5,
      progressRatio: 0,
      graduated: false,
    }

    await page.route("**/api/v1/classrooms", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: { items: [{ id: "class_1", name: "三年级2班", studentCount: 1, graduatedPetCount: 0 }] },
          error: null,
          meta: null,
        },
      })
    })

    await page.route("**/api/v1/system-settings", async (route) => {
      await route.fulfill({ json: { success: true, data: { name: "班级动物园" }, error: null, meta: null } })
    })

    await page.route("**/api/v1/classrooms/class_1/zoo", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: { items: [{ student: { id: "s_1", name: "小明" }, badgeCount: 0, pet }] },
          error: null,
          meta: null,
        },
      })
    })

    await page.route("**/api/v1/classrooms/class_1/pets/assign", async (route) => {
      pet = { ...petTemplate }
      await route.fulfill({ json: { success: true, data: { items: [pet] }, error: null, meta: null } })
    })

    await page.route("**/api/v1/classrooms/class_1/students/s_1/pet", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: { student: { id: "s_1", name: "小明" }, pet, badges: [], logs: [] },
          error: null,
          meta: null,
        },
      })
    })

    await page.route("**/api/v1/classrooms/class_1/points/feed", async (route) => {
      const body = route.request().postDataJSON()
      const delta = Number(body?.delta ?? 0)
      const nextGrowth = Math.max(0, ((pet?.growthValue as number | undefined) ?? 0) + delta)
      pet = {
        ...petTemplate,
        growthValue: nextGrowth,
        level: nextGrowth >= 5 ? 2 : 1,
        nextThreshold: 5,
        remainingToNext: Math.max(0, 5 - nextGrowth),
        progressRatio: Math.min(1, nextGrowth / 5),
        visualKey: nextGrowth >= 5 ? "cat-orange-lv2" : "cat-orange-lv1",
      }
      await route.fulfill({
        json: {
          success: true,
          data: {
            idempotent: false,
            applied: 1,
            results: [{ pet: { id: "pet_1", level: pet.level, growthValue: pet.growthValue, graduated: false }, badge: null, growthDelta: delta }],
          },
          error: null,
          meta: null,
        },
      })
    })

    await page.goto("/classrooms/class_1/zoo")
    await expect(page.getByText("小明")).toBeVisible()
    await expect(page.getByText("未分配宠物")).toBeVisible()

    // One-click random assignment.
    page.on("dialog", (dialog) => dialog.accept())
    await page.getByRole("button", { name: /一键分配宠物/ }).click()
    await expect(page.getByText("Lv.1", { exact: true })).toBeVisible()
    await expect(page.getByText("橘猫")).toBeVisible()

    // Open the pet detail and feed once.
    await page.getByText("小明").first().click()
    await expect(page.getByText("小明 的宠物")).toBeVisible()
    await page.getByRole("button", { name: "课堂表现 +1" }).click()
    await expect(page.getByText("累计食物 1", { exact: true })).toBeVisible()
  })
})
