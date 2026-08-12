import { beforeEach, describe, expect, it, vi } from "vitest"

const taskStatsMocks = vi.hoisted(() => ({
  checkinTaskFindUnique: vi.fn(),
  checkinRecordCount: vi.fn(),
  studentCount: vi.fn(),
  assertTeacherOwnsClassroom: vi.fn(),
}))

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    checkinTask: { findUnique: taskStatsMocks.checkinTaskFindUnique },
    checkinRecord: { count: taskStatsMocks.checkinRecordCount },
    student: { count: taskStatsMocks.studentCount },
  },
}))

vi.mock("@/server/services/classroom.service", () => ({
  assertTeacherOwnsClassroom: taskStatsMocks.assertTeacherOwnsClassroom,
}))

import { getCheckinTaskStats } from "@/server/services/checkin-task.service"

describe("check-in statistics", () => {
  beforeEach(() => {
    taskStatsMocks.checkinTaskFindUnique.mockResolvedValue({ id: "task_1", classroomId: "classroom_1" })
    taskStatsMocks.assertTeacherOwnsClassroom.mockResolvedValue(undefined)
    taskStatsMocks.checkinRecordCount
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
    taskStatsMocks.studentCount.mockResolvedValue(5)
  })

  it("returns one status breakdown shared by task and dashboard consumers", async () => {
    const stats = await getCheckinTaskStats("teacher_1", "task_1")

    expect(stats).toEqual({
      taskId: "task_1",
      totalStudents: 5,
      completedCount: 3,
      approvedCount: 2,
      pendingCount: 1,
      rejectedCount: 1,
      missedCount: 2,
      completionRate: 3 / 5,
    })
  })

  it("uses zero completion rate when the classroom has no active students", async () => {
    taskStatsMocks.studentCount.mockResolvedValue(0)
    taskStatsMocks.checkinRecordCount.mockReset()
    taskStatsMocks.checkinRecordCount
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)

    await expect(getCheckinTaskStats("teacher_1", "task_1")).resolves.toMatchObject({
      totalStudents: 0,
      completionRate: 0,
    })
  })
})
