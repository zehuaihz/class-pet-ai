import { describe, expect, it, vi } from "vitest"

const routeMocks = vi.hoisted(() => ({
  requireTeacher: vi.fn(),
  assertTeacherOwnsClassroom: vi.fn(),
  pointTransactionFindMany: vi.fn(),
}))

vi.mock("@/server/auth/session", () => ({
  requireTeacher: routeMocks.requireTeacher,
}))

vi.mock("@/server/services/classroom.service", () => ({
  assertTeacherOwnsClassroom: routeMocks.assertTeacherOwnsClassroom,
}))

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    pointTransaction: { findMany: routeMocks.pointTransactionFindMany },
  },
}))

import { GET } from "@/app/api/v1/classrooms/[classroomId]/points/transactions/route"

describe("GET classroom point transactions", () => {
  it("returns raw timestamps instead of server-local formatted time strings", async () => {
    routeMocks.requireTeacher.mockResolvedValue({ teacherProfileId: "teacher_1" })
    routeMocks.assertTeacherOwnsClassroom.mockResolvedValue(undefined)
    routeMocks.pointTransactionFindMany.mockResolvedValue([
      {
        id: "pt_1",
        student: { name: "小明" },
        group: null,
        reason: "课堂发言",
        delta: 2,
        reversalOfId: null,
        createdAt: new Date("2026-08-21T01:12:00.000Z"),
      },
    ])

    const response = await GET(new Request("http://test.local") as never, { params: Promise.resolve({ classroomId: "class_1" }) })
    const payload = await response.json()

    expect(payload.data.items).toEqual([
      {
        id: "pt_1",
        name: "小明",
        reason: "课堂发言",
        delta: 2,
        createdAt: "2026-08-21T01:12:00.000Z",
        reversalOfId: null,
      },
    ])
    expect(payload.data.items[0]).not.toHaveProperty("time")
  })
})
