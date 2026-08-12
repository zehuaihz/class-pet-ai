import { PointTransactionSource, RewardRedemptionStatus } from "@prisma/client"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { createPointTransactionInTx } from "@/server/services/point-transaction.service"
import { AppError } from "@/server/utils/errors"

export async function requestRedemption(studentId: string, rewardItemId: string, idempotencyKey?: string) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.rewardItem.findUnique({ where: { id: rewardItemId } })
    if (!item || !item.enabled) throw new AppError("NOT_FOUND", "Reward item not available", 404)
    const classroom = await tx.classroom.findUnique({ where: { id: item.classroomId }, select: { teacherId: true } })
    if (!classroom) throw new AppError("NOT_FOUND", "Classroom not found", 404)
    const student = await tx.student.findUnique({ where: { id: studentId } })
    if (!student || student.classroomId !== item.classroomId) throw new AppError("FORBIDDEN", "Student not in classroom", 403)
    if (student.status !== "ACTIVE") throw new AppError("FORBIDDEN", "Student not active", 403)
    if (student.totalPoints < item.costPoints) throw new AppError("CONFLICT", "Insufficient points", 409)

    if (idempotencyKey) {
      const existing = await tx.pointTransaction.findUnique({ where: { idempotencyKey } })
      if (existing?.redemptionId) {
        const redemption = await tx.rewardRedemption.findUnique({ where: { id: existing.redemptionId } })
        if (redemption) return redemption
      }
    }

    if (item.stock !== null) {
      const reserved = await tx.rewardItem.updateMany({
        where: { id: item.id, stock: { gt: 0 } },
        data: { stock: { decrement: 1 } },
      })
      if (reserved.count === 0) throw new AppError("CONFLICT", "Out of stock", 409)
    }

    const redemption = await tx.rewardRedemption.create({
      data: { rewardItemId: item.id, studentId: student.id, pointsSpent: item.costPoints, status: RewardRedemptionStatus.PENDING },
    })

    await createPointTransactionInTx(tx, {
      actorTeacherId: classroom.teacherId,
      classroomId: item.classroomId,
      studentId: student.id,
      redemptionId: redemption.id,
      idempotencyKey: idempotencyKey ?? null,
      delta: -item.costPoints,
      reason: item.name,
      source: PointTransactionSource.REWARD,
      meta: { rewardItemId: item.id, redemptionId: redemption.id },
    })

    return redemption
  })
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

    const classroom = await tx.classroom.findUnique({ where: { id: redemption.rewardItem.classroomId }, select: { teacherId: true } })
    if (redemption.rewardItem.stock !== null) {
      await tx.rewardItem.update({ where: { id: redemption.rewardItemId }, data: { stock: { increment: 1 } } })
    }
    await createPointTransactionInTx(tx, {
      actorTeacherId: classroom?.teacherId ?? actorTeacherId,
      classroomId: redemption.rewardItem.classroomId,
      studentId: redemption.studentId,
      idempotencyKey: `cancel:${redemption.id}`,
      delta: redemption.pointsSpent,
      reason: `撤销兑换：${redemption.rewardItem.name}`,
      source: PointTransactionSource.ROLLBACK,
      meta: { cancelledRedemptionId: redemption.id },
    })
    return tx.rewardRedemption.findUnique({ where: { id: redemptionId } })
  })
}
