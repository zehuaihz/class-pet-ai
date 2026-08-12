import { PointTransactionSource, Prisma } from "@prisma/client"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { getClassroomThresholds } from "@/server/services/pet-level-config.service"
import { graduatePetInTx } from "@/server/services/badge.service"
import { getStudentPetLevel } from "@/server/domain/student-pet-rules"
import { AppError } from "@/server/utils/errors"

export interface CreatePointTransactionInput {
  actorTeacherId: string
  classroomId: string
  studentId?: string | null
  groupId?: string | null
  ruleId?: string | null
  reversalOfId?: string | null
  checkinRecordId?: string | null
  idempotencyKey?: string | null
  batchKey?: string | null
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

export interface PointFeedResult {
  transaction: unknown
  studentTotalPoints: number | null
  groupTotalPoints: number | null
  pet: {
    id: string
    level: number
    growthValue: number
    graduated: boolean
  } | null
  badge: { id: string } | null
  growthDelta: number
}

/**
 * Feed the student's growing pet. Positive delta adds food, negative delta
 * removes food (progress regresses, floored at 0). A pet that crosses the
 * final threshold is graduated and mints a badge in the same transaction.
 */
async function feedStudentPetInTx(
  tx: Prisma.TransactionClient,
  pet: { id: string; studentId: string; speciesKey: string; name: string; growthValue: number; status: string },
  classroomId: string,
  transactionId: string,
  growthDelta: number,
  reason: string,
): Promise<NonNullable<PointFeedResult["pet"]> & { badge: PointFeedResult["badge"]; growthDelta: number }> {
  const thresholds = await getClassroomThresholds(classroomId, tx)
  const newGrowthValue = Math.max(0, pet.growthValue + growthDelta)
  const newLevel = getStudentPetLevel(newGrowthValue, thresholds)
  const updated = await tx.studentPet.update({
    where: { id: pet.id },
    data: { growthValue: newGrowthValue, level: newLevel },
  })

  if (growthDelta !== 0) {
    await tx.petGrowthLog.create({
      data: {
        studentPetId: pet.id,
        pointTransactionId: transactionId,
        growthDelta,
        reason: reason.trim(),
      },
    })
  }

  const graduation = await graduatePetInTx(tx, updated, thresholds)
  return {
    id: updated.id,
    level: newLevel,
    growthValue: newGrowthValue,
    graduated: graduation !== null,
    badge: graduation?.badge ?? null,
    growthDelta,
  }
}

export async function createPointTransactionInTx(
  tx: Prisma.TransactionClient,
  input: CreatePointTransactionInput,
): Promise<PointFeedResult> {
  validateTransactionTarget(input)
  await validateRule(tx, input)

  const sharedData = {
    classroomId: input.classroomId,
    teacherId: input.actorTeacherId,
    ruleId: input.ruleId,
    reversalOfId: input.reversalOfId,
    checkinRecordId: input.checkinRecordId,
    idempotencyKey: input.idempotencyKey,
    batchKey: input.batchKey,
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

    const pet = await tx.studentPet.findFirst({
      where: { studentId: input.studentId, status: "GROWING" },
    })
    if (!pet) {
      return {
        transaction,
        studentTotalPoints: updatedStudent.totalPoints,
        groupTotalPoints: null,
        pet: null,
        badge: null,
        growthDelta: 0,
      }
    }

    const fed = await feedStudentPetInTx(tx, pet, input.classroomId, transaction.id, input.delta, input.reason)
    return {
      transaction,
      studentTotalPoints: updatedStudent.totalPoints,
      groupTotalPoints: null,
      pet: { id: fed.id, level: fed.level, growthValue: fed.growthValue, graduated: fed.graduated },
      badge: fed.badge,
      growthDelta: fed.growthDelta,
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
    pet: null,
    badge: null,
    growthDelta: 0,
  }
}

export async function createPointTransaction(input: CreatePointTransactionInput) {
  validateTransactionTarget(input)
  await assertTeacherOwnsClassroom(input.actorTeacherId, input.classroomId)
  return prisma.$transaction((tx) => createPointTransactionInTx(tx, input))
}

export interface CreateBatchPointTransactionInput {
  actorTeacherId: string
  classroomId: string
  studentIds?: string[]
  allStudents?: boolean
  ruleId?: string | null
  idempotencyKey?: string | null
  delta: number
  reason: string
  source?: PointTransactionSource
  meta?: unknown
}

/**
 * Apply the same feed to many students (or the whole class) atomically.
 * A stable idempotencyKey makes retries safe: repeated calls with the same
 * key return the already-applied batch without creating new transactions.
 */
export async function createBatchPointTransaction(input: CreateBatchPointTransactionInput) {
  if (input.delta === 0) throw new AppError("VALIDATION_ERROR", "delta cannot be 0", 422)
  await assertTeacherOwnsClassroom(input.actorTeacherId, input.classroomId)

  const studentIds = input.allStudents
    ? undefined
    : Array.isArray(input.studentIds) && input.studentIds.length > 0
      ? input.studentIds
      : undefined
  if (!studentIds && !input.allStudents) {
    throw new AppError("VALIDATION_ERROR", "studentIds or allStudents required", 422)
  }

  const students = await prisma.student.findMany({
    where: {
      classroomId: input.classroomId,
      status: "ACTIVE",
      ...(studentIds ? { id: { in: studentIds } } : {}),
    },
    select: { id: true },
  })
  if (students.length === 0) throw new AppError("NOT_FOUND", "No active students in classroom", 404)

  const batchKey = input.idempotencyKey ?? `batch:${crypto.randomUUID()}`

  const run = () =>
    prisma.$transaction(async (tx) => {
      const existing = await tx.pointTransaction.findFirst({ where: { batchKey } })
      if (existing) {
        return {
          idempotent: true,
          applied: await tx.pointTransaction.count({ where: { batchKey } }),
          results: [],
        }
      }

      const results: PointFeedResult[] = []
      for (const student of students) {
        results.push(
          await createPointTransactionInTx(tx, {
            actorTeacherId: input.actorTeacherId,
            classroomId: input.classroomId,
            studentId: student.id,
            ruleId: input.ruleId ?? null,
            batchKey,
            idempotencyKey: null,
            delta: input.delta,
            reason: input.reason,
            source: input.source,
            meta: input.meta,
          }),
        )
      }
      return { idempotent: false, applied: results.length, results }
    })

  try {
    return await run()
  } catch (error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error
    return {
      idempotent: true,
      applied: await prisma.pointTransaction.count({ where: { batchKey } }),
      results: [],
    }
  }
}

export async function reversePointTransaction(actorTeacherId: string, transactionId: string, reason: string) {
  const original = await prisma.pointTransaction.findUnique({ where: { id: transactionId } })
  if (!original) throw new AppError("NOT_FOUND", "Transaction not found", 404)
  await assertTeacherOwnsClassroom(actorTeacherId, original.classroomId)

  if (original.source === PointTransactionSource.ROLLBACK || original.reversalOfId) {
    throw new AppError("CONFLICT", "Rollback transactions cannot be reversed", 409)
  }

  const execute = () =>
    prisma.$transaction(async (tx) => {
      const existing = await tx.pointTransaction.findUnique({ where: { reversalOfId: original.id } })
      if (existing) {
        return {
          transaction: existing,
          studentTotalPoints: null,
          groupTotalPoints: null,
          pet: null,
          badge: null,
          growthDelta: 0,
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
      pet: null,
      badge: null,
      growthDelta: 0,
    }
  }
}
