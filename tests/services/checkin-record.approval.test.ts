import { beforeEach, describe, expect, it, vi } from "vitest"

const dbMocks = vi.hoisted(() => ({
  checkinRecordFindUnique: vi.fn(),
  checkinRecordUpdateMany: vi.fn(),
  checkinRecordTxFindUnique: vi.fn(),
  pointTransactionCreate: vi.fn(),
  studentFindFirst: vi.fn(),
  studentUpdate: vi.fn(),
  petFindUnique: vi.fn(),
  petUpdate: vi.fn(),
  petGrowthLogCreate: vi.fn(),
  transaction: vi.fn(),
  assertTeacherOwnsClassroom: vi.fn(),
}))

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    checkinRecord: {
      findUnique: dbMocks.checkinRecordFindUnique,
    },
    $transaction: dbMocks.transaction,
  },
}))

vi.mock("@/server/services/classroom.service", () => ({
  assertTeacherOwnsClassroom: dbMocks.assertTeacherOwnsClassroom,
}))

import { approveCheckinRecord } from "@/server/services/checkin-record.service"

describe("approveCheckinRecord", () => {
  const record = {
    id: "record_1",
    taskId: "task_1",
    studentId: "student_1",
    status: "PENDING",
    task: {
      id: "task_1",
      classroomId: "classroom_1",
      createdByTeacherId: "teacher_1",
      title: "完成阅读",
      rewardPoints: 10,
    },
  }
  const approvedRecord = { ...record, status: "APPROVED", approvedById: "teacher_1" }
  const tx = {
    checkinRecord: { updateMany: dbMocks.checkinRecordUpdateMany, findUnique: dbMocks.checkinRecordTxFindUnique },
    pointTransaction: { create: dbMocks.pointTransactionCreate },
    student: { findFirst: dbMocks.studentFindFirst, update: dbMocks.studentUpdate },
    pet: { findUnique: dbMocks.petFindUnique, update: dbMocks.petUpdate },
    petGrowthLog: { create: dbMocks.petGrowthLogCreate },
  }

  beforeEach(() => {
    dbMocks.checkinRecordFindUnique.mockResolvedValue(record)
    dbMocks.checkinRecordUpdateMany.mockResolvedValue({ count: 1 })
    dbMocks.checkinRecordTxFindUnique.mockResolvedValue(approvedRecord)
    dbMocks.assertTeacherOwnsClassroom.mockResolvedValue(undefined)
    dbMocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx))
    dbMocks.pointTransactionCreate.mockResolvedValue({
      id: "point_tx_1",
      checkinRecordId: record.id,
      delta: record.task.rewardPoints,
      source: "CHECKIN",
    })
    dbMocks.studentFindFirst.mockResolvedValue({ id: record.studentId, classroomId: record.task.classroomId })
    dbMocks.studentUpdate.mockResolvedValue({ totalPoints: 10 })
    dbMocks.petFindUnique.mockResolvedValue(null)
  })

  it("approves the record and creates its reward in one database transaction", async () => {
    await approveCheckinRecord("teacher_1", record.id)

    expect(dbMocks.transaction).toHaveBeenCalledOnce()
    expect(dbMocks.checkinRecordUpdateMany).toHaveBeenCalledWith({
      where: { id: record.id, status: "PENDING" },
      data: expect.objectContaining({ status: "APPROVED", approvedById: "teacher_1" }),
    })
    expect(dbMocks.pointTransactionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        classroomId: record.task.classroomId,
        studentId: record.studentId,
        checkinRecordId: record.id,
        delta: record.task.rewardPoints,
        source: "CHECKIN",
      }),
    })
  })

  it("rolls back approval when reward creation fails", async () => {
    let persistedStatus = record.status
    let stagedStatus = record.status
    dbMocks.checkinRecordUpdateMany.mockImplementation(async () => {
      stagedStatus = "APPROVED"
      return { count: 1 }
    })
    dbMocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => {
      const result = await callback(tx)
      persistedStatus = stagedStatus
      return result
    })
    dbMocks.pointTransactionCreate.mockRejectedValueOnce(new Error("reward write failed"))

    await expect(approveCheckinRecord("teacher_1", record.id)).rejects.toThrow("reward write failed")
    expect(persistedStatus).toBe("PENDING")
  })
})
