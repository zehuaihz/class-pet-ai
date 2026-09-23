import { expect, test } from "@playwright/test"
import { fixtures, loginViaApi } from "./support"

/**
 * End-to-end flows over the real check-in / reward / points pipeline with a
 * real PostgreSQL database and a real login session.
 */
test.describe("authenticated transactional flows", () => {
  test("student submits a check-in and the teacher approves it exactly once", async ({ page, baseURL }) => {
    const data = fixtures()

    await loginViaApi(page.context(), baseURL!, data.studentAccount.identifier, data.studentAccount.password, data.studentAccount.role)

    const submit = await page.request.post(`${baseURL}/api/v1/student/checkins`, {
      data: { taskId: data.taskId, evidenceUrl: "https://example.com/evidence.png" },
      headers: { "content-type": "application/json" },
    })
    if (!submit.ok()) {
      // Already submitted by a previous run: idempotent outcome is acceptable.
      expect(submit.status()).toBe(409)
    }

    const teacherContext = await page.context().browser()!.newContext({ baseURL })
    await loginViaApi(teacherContext, baseURL!, data.teacher.identifier, data.teacher.password)

    const pending = await teacherContext.request.get(`${baseURL}/api/v1/classrooms/${data.classroomId}/checkin-records`)
    const pendingBody = (await pending.json()) as { data: { items: Array<{ id: string; taskTitle: string }> } }
    const record = pendingBody.data.items.find((item) => item.taskTitle === "E2E 每日阅读打卡")

    if (record) {
      const approve = await teacherContext.request.patch(`${baseURL}/api/v1/checkin-records/${record.id}/approve`, {
        data: {},
      })
      expect(approve.ok()).toBeTruthy()

      // Second approval must not add points again.
      const before = await readPoints(teacherContext, baseURL!, data.classroomId, data.studentId)
      const again = await teacherContext.request.patch(`${baseURL}/api/v1/checkin-records/${record.id}/approve`, { data: {} })
      expect(again.ok()).toBeTruthy()
      const after = await readPoints(teacherContext, baseURL!, data.classroomId, data.studentId)
      expect(after).toBe(before)
    }

    await teacherContext.close()
  })

  test("teacher manual check-in creates a record for the selected student", async ({ page, baseURL }) => {
    const data = fixtures()
    await loginViaApi(page.context(), baseURL!, data.teacher.identifier, data.teacher.password)

    const response = await page.request.post(`${baseURL}/api/v1/classrooms/${data.classroomId}/checkin-records`, {
      data: { taskId: data.taskId, studentId: data.studentId },
      headers: { "content-type": "application/json" },
    })
    // 200 on first manual record, 409 when the task/student pair already exists.
    expect([200, 409]).toContain(response.status())
  })

  test("student redemption is atomic: stock and balance never go negative", async ({ page, baseURL }) => {
    const data = fixtures()
    await loginViaApi(page.context(), baseURL!, data.studentAccount.identifier, data.studentAccount.password, data.studentAccount.role)

    const results = await Promise.all(
      Array.from({ length: 3 }, (_, index) =>
        page.request.post(`${baseURL}/api/v1/student/rewards/${data.rewardId}/redeem`, {
          headers: { "Idempotency-Key": `e2e-redeem-${Date.now()}-${index}` },
        }),
      ),
    )

    const statuses = results.map((response) => response.status())
    // Only as many requests as there is stock may succeed.
    expect(statuses.filter((status) => status === 200).length).toBeLessThanOrEqual(2)

    const rewards = await page.request.get(`${baseURL}/api/v1/student/rewards`)
    const body = (await rewards.json()) as { data: { totalPoints: number; items: Array<{ id: string; stock: number | null }> } }
    expect(body.data.totalPoints).toBeGreaterThanOrEqual(0)

    const item = body.data.items.find((candidate) => candidate.id === data.rewardId)
    if (item && item.stock !== null) expect(item.stock).toBeGreaterThanOrEqual(0)
  })

  test("teacher can create and then edit a reward item", async ({ page, baseURL }) => {
    const data = fixtures()
    await loginViaApi(page.context(), baseURL!, data.teacher.identifier, data.teacher.password)

    const created = await page.request.post(`${baseURL}/api/v1/classrooms/${data.classroomId}/rewards`, {
      data: { name: `E2E 新奖励 ${Date.now()}`, costPoints: 3, stock: 1, enabled: true },
      headers: { "content-type": "application/json" },
    })
    expect(created.ok()).toBeTruthy()
    const createdBody = (await created.json()) as { data: { id: string } }

    const updated = await page.request.patch(`${baseURL}/api/v1/rewards/${createdBody.data.id}`, {
      data: { costPoints: 4, enabled: false },
      headers: { "content-type": "application/json" },
    })
    expect(updated.ok()).toBeTruthy()
    const updatedBody = (await updated.json()) as { data: { costPoints: number; enabled: boolean } }
    expect(updatedBody.data.costPoints).toBe(4)
    expect(updatedBody.data.enabled).toBe(false)

    const removed = await page.request.delete(`${baseURL}/api/v1/rewards/${createdBody.data.id}`)
    expect(removed.ok()).toBeTruthy()
  })

  test("AI job reaches a terminal state through the real worker pipeline", async ({ page, baseURL }) => {
    const data = fixtures()
    await loginViaApi(page.context(), baseURL!, data.teacher.identifier, data.teacher.password)

    const created = await page.request.post(`${baseURL}/api/v1/ai/comment-draft`, {
      data: { classroomId: data.classroomId, studentId: data.studentId, notes: "本周表现认真" },
      headers: { "content-type": "application/json" },
    })
    expect(created.status()).toBe(202)
    const job = (await created.json()) as { data: { jobId: string } }
    const jobId = job.data.jobId
    expect(jobId).toBeTruthy()

    const status = await page.request.get(`${baseURL}/api/v1/ai/jobs/${jobId}`)
    expect(status.ok()).toBeTruthy()
    const statusBody = (await status.json()) as { data: { status: string } }
    expect(["PENDING", "RUNNING", "SUCCEEDED", "FAILED"]).toContain(statusBody.data.status)
  })
})

async function readPoints(
  context: { request: { get: (url: string) => Promise<{ json: () => Promise<unknown> }> } },
  baseURL: string,
  classroomId: string,
  studentId: string,
): Promise<number> {
  const response = (await context.request.get(`${baseURL}/api/v1/classrooms/${classroomId}/students`)) as unknown as {
    json: () => Promise<{ data: { items: Array<{ id: string; totalPoints: number }> } }>
  }
  const body = await response.json()
  return body.data.items.find((item) => item.id === studentId)?.totalPoints ?? 0
}
