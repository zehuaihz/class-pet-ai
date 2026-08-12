import { PointTransactionSource, Prisma } from "@prisma/client"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { AppError } from "@/server/utils/errors"

export interface CreatePointTransactionInput {
  actorTeacherId: string
  classroomId: string
  studentId?: string | null
  groupId?: string | null
  ruleId?: string | null
  reversalOfId?: string | null
  checkinRecordId?: string | null
  redemptionId?: string | null
  idempotencyKey?: string | null
  delta: number
  reason: string
  source?: PointTransactionSource
  meta?: unknown
}

function validateTransactionTarget(input: CreatePointTransactionInput): void {
  if (!input.studentId && !input.groupId) {
    throw new AppError("VALIDATION_ERROR", "studentId or groupId required", 422)
  }

  if (input.studentId && input.groupId) {
    throw new AppError("VALIDATION_ERROR", "studentId and groupId cannot both be set", 422)
  }

  if (!input.reason.trim()) {
    throw new AppError("VALIDATION_ERROR", "reason required", 422)
  }
}

async function validateRule(tx: Prisma.TransactionClient, input: CreatePointTransactionInput): Promise<void> {
  if (!input.ruleId) return

  const rule = await tx.pointRule.findFirst({
    where: { id: input.ruleId, classroomId: input.classroomId, enabled: true },
    select: { id: true },
  })
  if (!rule) throw new AppError("NOT_FOUND", "Point rule not found", 404)
}

export async function createPointTransactionInTx(
  tx: Prisma.TransactionClient,
  input: CreatePointTransactionInput,
) {
  validateTransactionTarget(input)
  await validateRule(tx, input)

  const sharedData = {
    classroomId: input.classroomId,
    teacherId: input.actorTeacherId,
    ruleId: input.ruleId,
    reversalOfId: input.reversalOfId,
    checkinRecordId: input.checkinRecordId,
    redemptionId: input.redemptionId,
    idempotencyKey: input.idempotencyKey,
    delta: input.delta,
    reason: input.reason.trim(),
    source: input.source ?? PointTransactionSource.MANUAL,
    meta: input.meta === undefined ? undefined : (input.meta as Prisma.InputJsonValue),
  }

  if (input.studentId) {
    const student = await tx.student.findFirst({
      where: { id: input.studentId, classroomId: input.classroomId },
    })
    if (!student) throw new AppError("NOT_FOUND", "Student not found", 404)

    const transaction = await tx.pointTransaction.create({
      data: { ...sharedData, studentId: input.studentId },
    })
    const updatedStudent = await tx.student.update({
      where: { id: input.studentId },
      data: { totalPoints: { increment: input.delta } },
    })

    const petGrowthDelta = input.source === PointTransactionSource.ROLLBACK ? input.delta : Math.max(0, input.delta)
    const pet = await tx.pet.findUnique({ where: { classroomId: input.classroomId } })
    if (pet && petGrowthDelta !== 0) {
      await tx.pet.update({
        where: { id: pet.id },
        data: { growthValue: { increment: petGrowthDelta } },
      })
      await tx.petGrowthLog.create({
        data: {
          petId: pet.id,
          pointTransactionId: transaction.id,
          growthDelta: petGrowthDelta,
          reason: input.reason.trim(),
        },
      })
    }

    return {
      transaction,
      studentTotalPoints: updatedStudent.totalPoints,
      groupTotalPoints: null,
      petGrowthDelta,
    }
  }

  const group = await tx.group.findFirst({
    where: { id: input.groupId!, classroomId: input.classroomId },
  })
  if (!group) throw new AppError("NOT_FOUND", "Group not found", 404)

  const transaction = await tx.pointTransaction.create({
    data: { ...sharedData, groupId: input.groupId },
  })
  const updatedGroup = await tx.group.update({
    where: { id: input.groupId! },
    data: { totalPoints: { increment: input.delta } },
  })

  return {
    transaction,
    studentTotalPoints: null,
    groupTotalPoints: updatedGroup.totalPoints,
    petGrowthDelta: 0,
  }
}

export async function createPointTransaction(input: CreatePointTransactionInput) {
  validateTransactionTarget(input)
  await assertTeacherOwnsClassroom(input.actorTeacherId, input.classroomId)
  return prisma.$transaction((tx) => createPointTransactionInTx(tx, input))
}

export async function reversePointTransaction(actorTeacherId: string, transactionId: string, reason: string) {
  const original = await prisma.pointTransaction.findUnique({ where: { id: transactionId } })
  if (!original) throw new AppError("NOT_FOUND", "Transaction not found", 404)
  await assertTeacherOwnsClassroom(actorTeacherId, original.classroomId)

  if (original.source === PointTransactionSource.ROLLBACK || original.reversalOfId) {
    throw new AppError("CONFLICT", "Rollback transactions cannot be reversed", 409)
  }

  const execute = () => prisma.$transaction(async (tx) => {
    const existing = await tx.pointTransaction.findUnique({ where: { reversalOfId: original.id } })
    if (existing) {
      return {
        transaction: existing,
        studentTotalPoints: null,
        groupTotalPoints: null,
        petGrowthDelta: 0,
      }
    }

    return createPointTransactionInTx(tx, {
      actorTeacherId,
      classroomId: original.classroomId,
      studentId: original.studentId,
      groupId: original.groupId,
      reversalOfId: original.id,
      delta: -original.delta,
      reason,
      source: PointTransactionSource.ROLLBACK,
      meta: { reversedTransactionId: original.id },
    })
  })

  try {
    return await execute()
  } catch (error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error

    const existing = await prisma.pointTransaction.findUnique({ where: { reversalOfId: original.id } })
    if (!existing) throw error
    return {
      transaction: existing,
      studentTotalPoints: null,
      groupTotalPoints: null,
      petGrowthDelta: 0,
    }
  }
}
