import { BadgeStatus, Prisma, RewardRedemptionStatus } from "@prisma/client"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { AppError } from "@/server/utils/errors"

/**
 * Redeem a reward item using badges as currency. Consumes the student's oldest
 * available badges (FIFO) atomically; a race-safe count check rolls the whole
 * transaction back when badges were overspent concurrently. A concurrent
 * duplicate with the same idempotency key is collapsed into the existing
 * redemption instead of surfacing a unique-constraint error.
 */
export async function requestRedemption(studentId: string, rewardItemId: string, idempotencyKey?: string) {
  const execute = () =>
    prisma.$transaction(async (tx) => {
      const item = await tx.rewardItem.findUnique({ where: { id: rewardItemId } })
      if (!item || !item.enabled) throw new AppError("NOT_FOUND", "Reward item not available", 404)

      const student = await tx.student.findUnique({ where: { id: studentId } })
      if (!student || student.classroomId !== item.classroomId) throw new AppError("FORBIDDEN", "Student not in classroom", 403)
      if (student.status !== "ACTIVE") throw new AppError("FORBIDDEN", "Student not active", 403)

      if (idempotencyKey) {
        const existing = await tx.rewardRedemption.findUnique({ where: { idempotencyKey } })
        if (existing) return existing
      }

      const availableBadges = await tx.badge.findMany({
        where: { studentId: student.id, status: BadgeStatus.AVAILABLE },
        orderBy: { earnedAt: "asc" },
        take: item.costBadges,
      })
      if (availableBadges.length < item.costBadges) throw new AppError("CONFLICT", "Insufficient badges", 409)

      if (item.stock !== null) {
        const reserved = await tx.rewardItem.updateMany({
          where: { id: item.id, stock: { gt: 0 } },
          data: { stock: { decrement: 1 } },
        })
        if (reserved.count === 0) throw new AppError("CONFLICT", "Out of stock", 409)
      }

      const redemption = await tx.rewardRedemption.create({
        data: {
          rewardItemId: item.id,
          studentId: student.id,
          badgesSpent: item.costBadges,
          idempotencyKey: idempotencyKey ?? null,
          status: RewardRedemptionStatus.PENDING,
        },
      })

      const consumed = await tx.badge.updateMany({
        where: { id: { in: availableBadges.map((badge) => badge.id) }, status: BadgeStatus.AVAILABLE },
        data: { status: BadgeStatus.CONSUMED, consumedAt: new Date(), consumedByRedemptionId: redemption.id },
      })
      if (consumed.count !== item.costBadges) throw new AppError("CONFLICT", "Insufficient badges", 409)

      return redemption
    })

  try {
    return await execute()
  } catch (error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error
    const existing = await prisma.rewardRedemption.findUnique({ where: { idempotencyKey: idempotencyKey ?? "" } })
    if (!existing) throw error
    return existing
  }
}

async function loadOwnedRedemption(actorTeacherId: string, redemptionId: string) {
  const redemption = await prisma.rewardRedemption.findUnique({ where: { id: redemptionId }, include: { rewardItem: true } })
  if (!redemption) throw new AppError("NOT_FOUND", "Redemption not found", 404)
  await assertTeacherOwnsClassroom(actorTeacherId, redemption.rewardItem.classroomId)
  return redemption
}

export async function approveRedemption(actorTeacherId: string, redemptionId: string) {
  await loadOwnedRedemption(actorTeacherId, redemptionId)
  const updated = await prisma.rewardRedemption.updateMany({
    where: { id: redemptionId, status: RewardRedemptionStatus.PENDING },
    data: { status: RewardRedemptionStatus.APPROVED, handledById: actorTeacherId },
  })
  if (updated.count === 0) throw new AppError("CONFLICT", "Redemption not pending", 409)
  return prisma.rewardRedemption.findUnique({ where: { id: redemptionId } })
}

export async function fulfillRedemption(actorTeacherId: string, redemptionId: string) {
  await loadOwnedRedemption(actorTeacherId, redemptionId)
  const updated = await prisma.rewardRedemption.updateMany({
    where: { id: redemptionId, status: RewardRedemptionStatus.APPROVED },
    data: { status: RewardRedemptionStatus.FULFILLED, handledById: actorTeacherId, fulfilledAt: new Date() },
  })
  if (updated.count === 0) throw new AppError("CONFLICT", "Redemption not approved", 409)
  return prisma.rewardRedemption.findUnique({ where: { id: redemptionId } })
}

export async function cancelRedemption(actorTeacherId: string, redemptionId: string) {
  const redemption = await loadOwnedRedemption(actorTeacherId, redemptionId)
  if (redemption.status === RewardRedemptionStatus.CANCELLED || redemption.status === RewardRedemptionStatus.FULFILLED) {
    return redemption
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.rewardRedemption.updateMany({
      where: { id: redemptionId, status: { in: [RewardRedemptionStatus.PENDING, RewardRedemptionStatus.APPROVED] } },
      data: { status: RewardRedemptionStatus.CANCELLED, handledById: actorTeacherId },
    })
    if (updated.count === 0) return tx.rewardRedemption.findUnique({ where: { id: redemptionId } })

    if (redemption.rewardItem.stock !== null) {
      await tx.rewardItem.update({ where: { id: redemption.rewardItemId }, data: { stock: { increment: 1 } } })
    }

    // Refund the consumed badges back to available.
    await tx.badge.updateMany({
      where: { consumedByRedemptionId: redemptionId, status: BadgeStatus.CONSUMED },
      data: { status: BadgeStatus.AVAILABLE, consumedAt: null, consumedByRedemptionId: null },
    })

    return tx.rewardRedemption.findUnique({ where: { id: redemptionId } })
  })
}
