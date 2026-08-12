import { expect, test } from "@playwright/test"

test("AI failure state stays visible", async ({ page }) => {
  await page.route("**/api/v1/ai/comment-draft", async (route) => {
    await route.fulfill({ status: 500, json: { success: false, data: null, error: { code: "INTERNAL_ERROR", message: "AI failed" }, meta: null } })
  })
  await page.goto("/classrooms/class_1/ai/comment")
  await page.getByLabel("补充说明").fill("fail")
  await page.getByRole("button", { name: "生成草稿" }).click()
  await expect(page.getByText("AI failed")).toBeVisible()
})
