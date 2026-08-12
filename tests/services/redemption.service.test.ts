import { beforeEach, describe, expect, it, vi } from "vitest"

const dbMocks = vi.hoisted(() => ({
  rewardItemFindUnique: vi.fn(),
  studentFindUnique: vi.fn(),
  rewardRedemptionFindUnique: vi.fn(),
  badgeFindMany: vi.fn(),
  rewardItemUpdateMany: vi.fn(),
  rewardRedemptionCreate: vi.fn(),
  badgeUpdateMany: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock("@/server/db/prisma", () => ({
  prisma: { $transaction: dbMocks.transaction },
}))

import { requestRedemption } from "@/server/services/redemption.service"

const item = { id: "reward_1", classroomId: "classroom_1", name: "座位券", costBadges: 2, stock: 5, enabled: true }
const student = { id: "student_1", classroomId: "classroom_1", status: "ACTIVE" }
const badges = [{ id: "badge_old" }, { id: "badge_new" }]

const tx = {
  rewardItem: { findUnique: dbMocks.rewardItemFindUnique, updateMany: dbMocks.rewardItemUpdateMany },
  student: { findUnique: dbMocks.studentFindUnique },
  rewardRedemption: { findUnique: dbMocks.rewardRedemptionFindUnique, create: dbMocks.rewardRedemptionCreate },
  badge: { findMany: dbMocks.badgeFindMany, updateMany: dbMocks.badgeUpdateMany },
}

describe("requestRedemption", () => {
  beforeEach(() => {
    dbMocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx))
    dbMocks.rewardItemFindUnique.mockResolvedValue(item)
    dbMocks.studentFindUnique.mockResolvedValue(student)
    dbMocks.badgeFindMany.mockResolvedValue(badges)
    dbMocks.rewardItemUpdateMany.mockResolvedValue({ count: 1 })
    dbMocks.rewardRedemptionCreate.mockResolvedValue({ id: "redemption_1", badgesSpent: 2 })
    dbMocks.badgeUpdateMany.mockResolvedValue({ count: 2 })
  })

  it("consumes the oldest available badges atomically when redeeming", async () => {
    const redemption = await requestRedemption("student_1", "reward_1", "key-1")

    expect(dbMocks.badgeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 2, orderBy: { earnedAt: "asc" } }),
    )
    expect(dbMocks.badgeUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: { in: ["badge_old", "badge_new"] } }),
      data: expect.objectContaining({ status: "CONSUMED", consumedByRedemptionId: "redemption_1" }),
    })
    expect(redemption).toEqual({ id: "redemption_1", badgesSpent: 2 })
  })

  it("rejects when the student has too few available badges", async () => {
    dbMocks.badgeFindMany.mockResolvedValue([{ id: "badge_old" }])
    await expect(requestRedemption("student_1", "reward_1")).rejects.toThrow("Insufficient badges")
    expect(dbMocks.rewardRedemptionCreate).not.toHaveBeenCalled()
  })

  it("returns the existing redemption for a repeated idempotency key", async () => {
    dbMocks.rewardRedemptionFindUnique.mockResolvedValue({ id: "existing_redemption" })
    const redemption = await requestRedemption("student_1", "reward_1", "key-1")
    expect(redemption).toEqual({ id: "existing_redemption" })
    expect(dbMocks.badgeFindMany).not.toHaveBeenCalled()
  })
})
