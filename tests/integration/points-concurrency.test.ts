/**
 * Parallel point writes.
 *
 * The invariants under test are the ones that break when two requests race:
 * one row per idempotency key, one reversal per original transaction, and a
 * `Student.totalPoints` balance that always equals the sum of the ledger.
 */
import { describe, expect, it } from "vitest"
import { prisma } from "@/server/db/prisma"
import {
  createPointTransaction,
  reversePointTransaction,
  type CreatePointTransactionInput,
} from "@/server/services/point-transaction.service"
import { seedClassroomForTeacher } from "@/test/seeds/seed-classroom"
import { CONCURRENCY } from "./setup/integration-env"
import {
  describeError,
  expectBalanceMatchesLedger,
  readPetGrowth,
  readStudentPoints,
  settleAll,
  sumDeltas,
  unexpectedRejections,
  uniqueKey,
} from "./setup/harness"

const seed = () =>
  seedClassroomForTeacher({
    teacher: { email: "points-concurrency@test.com", name: "并发老师" },
    classroom: { name: "并发班" },
    students: [{ name: "小明", totalPoints: 0 }],
  })

describe("point transaction concurrency", () => {
  it("awards points exactly once for N parallel writes sharing one idempotency key", async () => {
    const { teacher, classroom, students } = await seed()
    const [student] = students
    const idempotencyKey = uniqueKey("parallel-grant")

    const input: CreatePointTransactionInput = {
      actorTeacherId: teacher.id,
      classroomId: classroom.id,
      studentId: student.id,
      delta: 7,
      reason: "并行幂等奖励",
      idempotencyKey,
    }

    const settled = await settleAll(Array.from({ length: CONCURRENCY }, () => createPointTransaction(input)))

    expect(settled.rejected.map(describeError)).toEqual([])
    const ids = new Set(settled.fulfilled.map((result) => result.transaction.id))
    expect(ids.size).toBe(1)
    expect(settled.fulfilled).toHaveLength(CONCURRENCY)

    expect(await prisma.pointTransaction.count({ where: { idempotencyKey } })).toBe(1)
    expect(await prisma.pointTransaction.count()).toBe(1)

    // Exactly one increment: 1 x delta, not N x delta.
    expect(await readStudentPoints(student.id)).toBe(7)
    expect(await expectBalanceMatchesLedger(student.id)).toBe(7)

    // Pet growth is a side effect of the ledger: it must not be applied twice either.
    expect(await readPetGrowth(classroom.id)).toBe(7)
    expect(await prisma.petGrowthLog.count()).toBe(1)
    expect(await prisma.auditLog.count({ where: { action: "POINTS_GRANTED" } })).toBe(1)
  })

  it("accepts a repeated idempotency key sequentially without double spending", async () => {
    const { teacher, classroom, students } = await seed()
    const [student] = students
    const idempotencyKey = uniqueKey("sequential-grant")
    const input: CreatePointTransactionInput = {
      actorTeacherId: teacher.id,
      classroomId: classroom.id,
      studentId: student.id,
      delta: 4,
      reason: "顺序幂等奖励",
      idempotencyKey,
    }

    const first = await createPointTransaction(input)
    const second = await createPointTransaction(input)

    expect(second.transaction.id).toBe(first.transaction.id)
    expect(await prisma.pointTransaction.count()).toBe(1)
    expect(await readStudentPoints(student.id)).toBe(4)
  })

  it("reverses a transaction exactly once under N parallel reversals", async () => {
    const { teacher, classroom, students } = await seed()
    const [student] = students

    const { transaction: original } = await createPointTransaction({
      actorTeacherId: teacher.id,
      classroomId: classroom.id,
      studentId: student.id,
      delta: 10,
      reason: "待撤销奖励",
    })
    expect(await readStudentPoints(student.id)).toBe(10)

    const { fulfilled, rejected } = await settleAll(
      Array.from({ length: CONCURRENCY }, () => reversePointTransaction(teacher.id, original.id, "撤销：待撤销奖励")),
    )

    // Losing racers either observe the committed reversal or are rejected with a
    // conflict; neither may create a second reversal or a second balance change.
    expect(unexpectedRejections(rejected, "CONFLICT").map(describeError)).toEqual([])
    expect(fulfilled.length + rejected.length).toBe(CONCURRENCY)
    expect(fulfilled.length).toBeGreaterThan(0)
    for (const result of fulfilled) expect(result.transaction.reversalOfId).toBe(original.id)

    const reversals = await prisma.pointTransaction.findMany({ where: { reversalOfId: original.id } })
    expect(reversals).toHaveLength(1)
    expect(reversals[0].delta).toBe(-10)

    expect(await readStudentPoints(student.id)).toBe(0)
    expect(await expectBalanceMatchesLedger(student.id)).toBe(0)

    // Reversals never feed pet growth.
    expect(await readPetGrowth(classroom.id)).toBe(10)
    expect(await prisma.petGrowthLog.count()).toBe(1)
  })

  it("keeps the balance equal to the ledger after mixed parallel grants and reversals", async () => {
    const { teacher, classroom, students } = await seed()
    const [student] = students

    const gratuitous = await Promise.all(
      Array.from({ length: CONCURRENCY }, (_, index) =>
        createPointTransaction({
          actorTeacherId: teacher.id,
          classroomId: classroom.id,
          studentId: student.id,
          delta: 3,
          reason: `并行奖励 ${index}`,
        }),
      ),
    )

    expect(await readStudentPoints(student.id)).toBe(3 * CONCURRENCY)
    expect(await sumDeltas(student.id)).toBe(3 * CONCURRENCY)

    const originalIds = gratuitous.map((result) => result.transaction.id)
    const reversals = await settleAll(
      originalIds.map((id) => reversePointTransaction(teacher.id, id, "撤销：并行奖励")),
    )

    expect(unexpectedRejections(reversals.rejected, "CONFLICT").map(describeError)).toEqual([])
    expect(await prisma.pointTransaction.count({ where: { reversalOfId: { in: originalIds } } })).toBe(CONCURRENCY)

    const finalBalance = await readStudentPoints(student.id)
    expect(finalBalance).toBe(0)
    expect(await sumDeltas(student.id)).toBe(0)
    expect(await expectBalanceMatchesLedger(student.id)).toBe(0)
  })

  it("never lets a parallel deduction drive the balance negative", async () => {
    // Student has exactly enough for two of the five parallel deductions.
    const seeded = await seedClassroomForTeacher({
      teacher: { email: "points-overdraw@test.com", name: "透支老师" },
      classroom: { name: "透支班" },
      students: [{ name: "小明", totalPoints: 20 }],
    })
    const [student] = seeded.students

    const attempts = await settleAll(
      Array.from({ length: CONCURRENCY }, (_, index) =>
        createPointTransaction({
          actorTeacherId: seeded.teacher.id,
          classroomId: seeded.classroom.id,
          studentId: student.id,
          delta: -10,
          reason: `并行扣分 ${index}`,
          requireSufficientBalance: true,
        }),
      ),
    )

    expect(unexpectedRejections(attempts.rejected, "CONFLICT").map(describeError)).toEqual([])
    expect(attempts.fulfilled).toHaveLength(2)
    expect(attempts.rejected).toHaveLength(CONCURRENCY - 2)

    const balance = await readStudentPoints(student.id)
    expect(balance).toBe(0)
    expect(balance).toBeGreaterThanOrEqual(0)
    expect(await expectBalanceMatchesLedger(student.id, 20)).toBe(0)
    expect(await prisma.pointTransaction.count({ where: { delta: -10 } })).toBe(2)
  })

  it("resolves parallel reversals of the SAME transaction idempotently instead of erroring", async () => {
    const seeded = await seed()
    const [student] = seeded.students

    const granted = await createPointTransaction({
      actorTeacherId: seeded.teacher.id,
      classroomId: seeded.classroom.id,
      studentId: student.id,
      delta: 5,
      reason: "待撤销",
    })

    const race = await settleAll(
      Array.from({ length: CONCURRENCY }, () =>
        reversePointTransaction(seeded.teacher.id, granted.transaction.id, "撤销：同一笔"),
      ),
    )

    // Every racer - winner and losers alike - must get the one reversal back.
    expect(race.rejected.map(describeError)).toEqual([])
    expect(race.fulfilled).toHaveLength(CONCURRENCY)
    const reversalIds = new Set(race.fulfilled.map((result) => result.transaction.id))
    expect(reversalIds.size).toBe(1)

    expect(await prisma.pointTransaction.count({ where: { reversalOfId: granted.transaction.id } })).toBe(1)
    expect(await readStudentPoints(student.id)).toBe(0)
    expect(await expectBalanceMatchesLedger(student.id)).toBe(0)
  })
})
