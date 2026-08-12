import { beforeEach, describe, expect, it, vi } from "vitest"

const dbMocks = vi.hoisted(() => ({
  pointTransactionFindUnique: vi.fn(),
  pointTransactionCreate: vi.fn(),
  studentFindFirst: vi.fn(),
  studentUpdate: vi.fn(),
  studentPetFindFirst: vi.fn(),
  transaction: vi.fn(),
  assertTeacherOwnsClassroom: vi.fn(),
}))

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    pointTransaction: {
      findUnique: dbMocks.pointTransactionFindUnique,
    },
    $transaction: dbMocks.transaction,
  },
}))

vi.mock("@/server/services/classroom.service", () => ({
  assertTeacherOwnsClassroom: dbMocks.assertTeacherOwnsClassroom,
}))

import { reversePointTransaction } from "@/server/services/point-transaction.service"

describe("reversePointTransaction", () => {
  const original = {
    id: "point_tx_1",
    classroomId: "classroom_1",
    studentId: "student_1",
    groupId: null,
    teacherId: "teacher_1",
    delta: 5,
  }
  const reversal = {
    id: "point_tx_reversal_1",
    classroomId: "classroom_1",
    studentId: "student_1",
    groupId: null,
    teacherId: "teacher_1",
    delta: -5,
    reversalOfId: original.id,
    source: "ROLLBACK",
  }
  const tx = {
    pointTransaction: {
      findUnique: dbMocks.pointTransactionFindUnique,
      create: dbMocks.pointTransactionCreate,
    },
    student: { findFirst: dbMocks.studentFindFirst, update: dbMocks.studentUpdate },
    studentPet: { findFirst: dbMocks.studentPetFindFirst },
  }

  beforeEach(() => {
    let existingReversal: typeof reversal | null = null

    dbMocks.assertTeacherOwnsClassroom.mockResolvedValue(undefined)
    dbMocks.pointTransactionFindUnique.mockImplementation(({ where }: { where: Record<string, string> }) => {
      if (where.reversalOfId === original.id) return Promise.resolve(existingReversal)
      return Promise.resolve(original)
    })
    dbMocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx))
    dbMocks.studentFindFirst.mockResolvedValue({ id: original.studentId, classroomId: original.classroomId })
    dbMocks.studentUpdate.mockResolvedValue({ totalPoints: 95 })
    dbMocks.studentPetFindFirst.mockResolvedValue(null)
    dbMocks.pointTransactionCreate.mockImplementation(async () => {
      existingReversal = reversal
      return reversal
    })
  })

  it("creates one linked reversal and returns it for repeated rollback requests", async () => {
    const first = await reversePointTransaction("teacher_1", original.id, "录入错误")
    const second = await reversePointTransaction("teacher_1", original.id, "录入错误")

    expect(first.transaction).toEqual(reversal)
    expect(second.transaction).toEqual(reversal)
    expect(dbMocks.pointTransactionCreate).toHaveBeenCalledOnce()
    expect(dbMocks.pointTransactionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        classroomId: original.classroomId,
        studentId: original.studentId,
        delta: -original.delta,
        reason: "录入错误",
        source: "ROLLBACK",
        reversalOfId: original.id,
      }),
    })
  })
})
