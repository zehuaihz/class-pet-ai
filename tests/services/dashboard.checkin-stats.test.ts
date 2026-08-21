import { beforeEach, describe, expect, it, vi } from "vitest"

const dashboardMocks = vi.hoisted(() => ({
  studentFindMany: vi.fn(),
  studentCount: vi.fn(),
  studentPetCount: vi.fn(),
  badgeCount: vi.fn(),
  pointTransactionFindMany: vi.fn(),
  checkinTaskFindMany: vi.fn(),
  checkinRecordCount: vi.fn(),
}))

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    student: {
      findMany: dashboardMocks.studentFindMany,
      count: dashboardMocks.studentCount,
    },
    studentPet: { count: dashboardMocks.studentPetCount },
    badge: { count: dashboardMocks.badgeCount },
    pointTransaction: { findMany: dashboardMocks.pointTransactionFindMany },
    checkinTask: { findMany: dashboardMocks.checkinTaskFindMany },
    checkinRecord: { count: dashboardMocks.checkinRecordCount },
  },
}))

import { getClassroomDashboard } from "@/server/services/dashboard.service"

describe("dashboard check-in statistics", () => {
  beforeEach(() => {
    dashboardMocks.studentPetCount.mockResolvedValue(0)
    dashboardMocks.badgeCount.mockResolvedValue(0)
    dashboardMocks.studentFindMany.mockResolvedValue([])
    dashboardMocks.studentCount.mockResolvedValue(5)
    dashboardMocks.pointTransactionFindMany.mockResolvedValue([])
    dashboardMocks.checkinTaskFindMany.mockResolvedValue([])
    dashboardMocks.checkinRecordCount
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
  })

  it("uses the same completed and missed status counts as check-in task statistics", async () => {
    const dashboard = await getClassroomDashboard("classroom_1")

    expect(dashboard.today).toEqual({
      checkinRate: 3 / 5,
      pointCount: 0,
      missedCount: 2,
    })
  })

  it("includes student names in recent point activity", async () => {
    dashboardMocks.pointTransactionFindMany
      .mockResolvedValueOnce([{ id: "pt_1", student: { name: "小明" }, group: null, reason: "课堂发言", delta: 2 }])
      .mockResolvedValueOnce([{ delta: 2 }])

    const dashboard = await getClassroomDashboard("classroom_1")

    expect(dashboard.recentTransactions).toEqual([{ id: "pt_1", name: "小明", reason: "课堂发言", delta: 2 }])
  })

  it("queries today's points from the app timezone day boundary", async () => {
    await getClassroomDashboard("classroom_1")

    expect(dashboardMocks.pointTransactionFindMany).toHaveBeenNthCalledWith(2, {
      where: { classroomId: "classroom_1", createdAt: { gte: expect.any(Date) } },
    })
    const query = dashboardMocks.pointTransactionFindMany.mock.calls[1][0] as { where: { createdAt: { gte: Date } } }
    expect(query.where.createdAt.gte.toISOString()).toMatch(/T16:00:00\.000Z$/)
  })
})
