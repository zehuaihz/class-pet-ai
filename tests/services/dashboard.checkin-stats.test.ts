import { beforeEach, describe, expect, it, vi } from "vitest"

const dashboardMocks = vi.hoisted(() => ({
  getClassroomPet: vi.fn(),
  studentFindMany: vi.fn(),
  studentCount: vi.fn(),
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
    pointTransaction: { findMany: dashboardMocks.pointTransactionFindMany },
    checkinTask: { findMany: dashboardMocks.checkinTaskFindMany },
    checkinRecord: { count: dashboardMocks.checkinRecordCount },
  },
}))

vi.mock("@/server/services/pet-growth.service", () => ({
  getClassroomPet: dashboardMocks.getClassroomPet,
}))

import { getClassroomDashboard } from "@/server/services/dashboard.service"

describe("dashboard check-in statistics", () => {
  beforeEach(() => {
    dashboardMocks.getClassroomPet.mockResolvedValue(null)
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
})
