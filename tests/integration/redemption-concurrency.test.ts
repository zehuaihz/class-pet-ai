/**
 * Redemption races: stock, balance and idempotency.
 *
 * Invariants:
 *  - stock never goes negative and is never oversold
 *  - a student balance never goes negative, even under parallel redemptions
 *  - replaying one idempotency key returns the same redemption and charges once
 *  - cancelling restores stock and points exactly once
 */
import { RewardRedemptionStatus } from "@prisma/client"
import { describe, expect, it } from "vitest"
import { prisma } from "@/server/db/prisma"
import {
  approveRedemption,
  cancelRedemption,
  fulfillRedemption,
  requestRedemption,
} from "@/server/services/redemption.service"
import { seedClassroomForTeacher } from "@/test/seeds/seed-classroom"
import { CONCURRENCY } from "./setup/integration-env"
import {
  describeError,
  expectAppError,
  expectBalanceMatchesLedger,
  readStudentPoints,
  settleAll,
  sumDeltas,
  unexpectedRejections,
  uniqueKey,
} from "./setup/harness"

const COST = 10

async function seedContest(input: { stock: number | null; pointsPerStudent: number; students: number }) {
  const seeded = await seedClassroomForTeacher({
    teacher: { email: `redemption-${uniqueKey("teacher")}@test.com`, name: "兑换老师" },
    classroom: { name: "兑换班" },
    students: Array.from({ length: input.students }, (_, index) => ({
      name: `学生${index}`,
      totalPoints: input.pointsPerStudent,
    })),
    rewardItems: [{ name: "铅笔", costPoints: COST, stock: input.stock }],
  })

  return { ...seeded, rewardItem: seeded.rewardItems[0] }
}

describe("redemption concurrency", () => {
  it("never oversells the last stock and never leaves negative stock", async () => {
    const students = CONCURRENCY
    const stock = 3
    const { students: seededStudents, rewardItem } = await seedContest({
      stock,
      pointsPerStudent: 100,
      students,
    })

    const { fulfilled, rejected } = await settleAll(
      seededStudents.map((student) => requestRedemption(student.id, rewardItem.id)),
    )

    expect(unexpectedRejections(rejected, "CONFLICT").map(describeError)).toEqual([])
    expect(fulfilled).toHaveLength(stock)
    expect(rejected).toHaveLength(students - stock)

    const item = await prisma.rewardItem.findUniqueOrThrow({ where: { id: rewardItem.id } })
    expect(item.stock).toBe(0)
    expect(item.stock).toBeGreaterThanOrEqual(0)

    const redemptions = await prisma.rewardRedemption.findMany({ where: { rewardItemId: rewardItem.id } })
    expect(redemptions).toHaveLength(stock)
    expect(await prisma.pointTransaction.count({ where: { redemptionId: { in: redemptions.map((row) => row.id) } } })).toBe(
      stock,
    )

    // Losers were never charged.
    for (const student of seededStudents) {
      const balance = await readStudentPoints(student.id)
      expect(balance === 100 || balance === 100 - COST).toBe(true)
      expect(balance).toBeGreaterThanOrEqual(0)
      await expectBalanceMatchesLedger(student.id, 100)
    }
  })

  it("never drives a balance negative when N parallel redemptions exceed it", async () => {
    const affordable = 3
    const { students, rewardItem } = await seedContest({
      stock: null,
      pointsPerStudent: COST * affordable,
      students: 1,
    })
    const [student] = students

    const attempts = await settleAll(
      Array.from({ length: CONCURRENCY }, () => requestRedemption(student.id, rewardItem.id)),
    )

    expect(unexpectedRejections(attempts.rejected, "CONFLICT").map(describeError)).toEqual([])
    expect(attempts.fulfilled).toHaveLength(affordable)
    expect(attempts.rejected).toHaveLength(CONCURRENCY - affordable)

    const balance = await readStudentPoints(student.id)
    expect(balance).toBe(0)
    expect(balance).toBeGreaterThanOrEqual(0)
    expect(await expectBalanceMatchesLedger(student.id, COST * affordable)).toBe(0)
    expect(await sumDeltas(student.id)).toBe(-COST * affordable)
    expect(await prisma.rewardRedemption.count()).toBe(affordable)
    expect(await prisma.pointTransaction.count()).toBe(affordable)
  })

  it("charges exactly once when one idempotency key is replayed in parallel", async () => {
    const { students, rewardItem } = await seedContest({ stock: 5, pointsPerStudent: 100, students: 1 })
    const [student] = students
    const idempotencyKey = uniqueKey("redeem")

    const { fulfilled, rejected } = await settleAll(
      Array.from({ length: CONCURRENCY }, () => requestRedemption(student.id, rewardItem.id, idempotencyKey)),
    )

    expect(rejected.map(describeError)).toEqual([])
    expect(new Set(fulfilled.map((redemption) => redemption.id)).size).toBe(1)

    expect(await prisma.rewardRedemption.count({ where: { idempotencyKey } })).toBe(1)
    expect(await readStudentPoints(student.id)).toBe(100 - COST)
    expect(await expectBalanceMatchesLedger(student.id, 100)).toBe(100 - COST)

    const item = await prisma.rewardItem.findUniqueOrThrow({ where: { id: rewardItem.id } })
    expect(item.stock).toBe(4)

    const pointRows = await prisma.pointTransaction.findMany({ where: { studentId: student.id } })
    expect(pointRows).toHaveLength(1)
    expect(pointRows[0].delta).toBe(-COST)
  })

  it("replays a redemption idempotency key sequentially without charging twice", async () => {
    const { students, rewardItem } = await seedContest({ stock: null, pointsPerStudent: 50, students: 1 })
    const [student] = students
    const idempotencyKey = uniqueKey("redeem-seq")

    const first = await requestRedemption(student.id, rewardItem.id, idempotencyKey)
    const second = await requestRedemption(student.id, rewardItem.id, idempotencyKey)

    expect(second.id).toBe(first.id)
    expect(await prisma.rewardRedemption.count()).toBe(1)
    expect(await prisma.pointTransaction.count()).toBe(1)
    expect(await readStudentPoints(student.id)).toBe(50 - COST)
  })

  it("rejects reuse of an idempotency key with a different request", async () => {
    const { students, rewardItems } = await seedContest({ stock: null, pointsPerStudent: 100, students: 1 })
    const [student] = students
    const secondItem = await prisma.rewardItem.create({
      data: { classroomId: rewardItems[0].classroomId, name: "橡皮", costPoints: 5, stock: null },
    })
    const idempotencyKey = uniqueKey("redeem-conflict")

    await requestRedemption(student.id, rewardItems[0].id, idempotencyKey)
    await expectAppError(requestRedemption(student.id, secondItem.id, idempotencyKey), "CONFLICT", 409)

    expect(await prisma.rewardRedemption.count()).toBe(1)
    expect(await readStudentPoints(student.id)).toBe(100 - COST)
  })

  it("restores stock and points exactly once for N parallel cancels", async () => {
    const { teacher, students, rewardItem } = await seedContest({ stock: 4, pointsPerStudent: 30, students: 1 })
    const [student] = students

    const redemption = await requestRedemption(student.id, rewardItem.id)
    expect(await readStudentPoints(student.id)).toBe(30 - COST)
    expect((await prisma.rewardItem.findUniqueOrThrow({ where: { id: rewardItem.id } })).stock).toBe(3)

    const { fulfilled, rejected } = await settleAll(
      Array.from({ length: CONCURRENCY }, () => cancelRedemption(teacher.id, redemption.id)),
    )

    expect(rejected.map(describeError)).toEqual([])
    expect(fulfilled).toHaveLength(CONCURRENCY)
    for (const result of fulfilled) expect(result?.status).toBe(RewardRedemptionStatus.CANCELLED)

    expect(await readStudentPoints(student.id)).toBe(30)
    expect(await expectBalanceMatchesLedger(student.id, 30)).toBe(30)
    expect(await sumDeltas(student.id)).toBe(0)

    const item = await prisma.rewardItem.findUniqueOrThrow({ where: { id: rewardItem.id } })
    expect(item.stock).toBe(4)

    const refunds = await prisma.pointTransaction.findMany({ where: { idempotencyKey: `cancel:${redemption.id}` } })
    expect(refunds).toHaveLength(1)
    expect(refunds[0].source).toBe("ROLLBACK")
    expect(refunds[0].delta).toBe(COST)

    expect(await prisma.auditLog.count({ where: { action: "REDEMPTION_CANCELLED" } })).toBe(1)
  })

  it("does not restore stock or points twice when a cancelled redemption is cancelled again", async () => {
    const { teacher, students, rewardItem } = await seedContest({ stock: 2, pointsPerStudent: 25, students: 1 })
    const [student] = students

    const redemption = await requestRedemption(student.id, rewardItem.id)
    await cancelRedemption(teacher.id, redemption.id)
    await cancelRedemption(teacher.id, redemption.id)

    expect(await readStudentPoints(student.id)).toBe(25)
    expect((await prisma.rewardItem.findUniqueOrThrow({ where: { id: rewardItem.id } })).stock).toBe(2)
    expect(await prisma.pointTransaction.count({ where: { source: "ROLLBACK" } })).toBe(1)
  })

  it("refuses to cancel a fulfilled redemption", async () => {
    const { teacher, students, rewardItem } = await seedContest({ stock: 2, pointsPerStudent: 25, students: 1 })
    const [student] = students

    const redemption = await requestRedemption(student.id, rewardItem.id)
    await approveRedemption(teacher.id, redemption.id)
    await fulfillRedemption(teacher.id, redemption.id)

    const result = await cancelRedemption(teacher.id, redemption.id)
    expect(result?.status).toBe(RewardRedemptionStatus.FULFILLED)
    expect(await readStudentPoints(student.id)).toBe(25 - COST)
    expect((await prisma.rewardItem.findUniqueOrThrow({ where: { id: rewardItem.id } })).stock).toBe(1)
  })

  it("lets only one handler move a redemption out of PENDING", async () => {
    const { teacher, students, rewardItem } = await seedContest({ stock: null, pointsPerStudent: 25, students: 1 })
    const [student] = students

    const redemption = await requestRedemption(student.id, rewardItem.id)
    const attempts = await settleAll([
      approveRedemption(teacher.id, redemption.id),
      approveRedemption(teacher.id, redemption.id),
    ])

    expect(attempts.fulfilled).toHaveLength(1)
    expect(unexpectedRejections(attempts.rejected, "CONFLICT").map(describeError)).toEqual([])

    const stored = await prisma.rewardRedemption.findUniqueOrThrow({ where: { id: redemption.id } })
    expect(stored.status).toBe(RewardRedemptionStatus.APPROVED)
  })

  it("refuses a redemption the student cannot afford", async () => {
    const { students, rewardItem } = await seedContest({ stock: null, pointsPerStudent: COST - 1, students: 1 })
    const [student] = students

    await expectAppError(requestRedemption(student.id, rewardItem.id), "CONFLICT", 409)

    expect(await prisma.rewardRedemption.count()).toBe(0)
    expect(await readStudentPoints(student.id)).toBe(COST - 1)
  })
})
