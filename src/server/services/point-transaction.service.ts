import { PointTransactionSource, Prisma } from "@prisma/client"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { writeAuditLogInTx } from "@/server/services/audit-log.service"
import { AppError } from "@/server/utils/errors"

export interface CreatePointTransactionInput {
  actorTeacherId: string
  classroomId: string
  studentId?: string | null
  groupId?: string | null
  ruleId?: string | null
  reversalOfId?: string | null
  syncPetGrowth?: boolean
  checkinRecordId?: string | null
  redemptionId?: string | null
  idempotencyKey?: string | null
  delta: number
  reason: string
  source?: PointTransactionSource
  meta?: unknown
  requireSufficientBalance?: boolean
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

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
    .join(",")}}`
}

function requestFingerprint(input: CreatePointTransactionInput): string {
  return stableJson({
    actorTeacherId: input.actorTeacherId,
    classroomId: input.classroomId,
    studentId: input.studentId ?? null,
    groupId: input.groupId ?? null,
    ruleId: input.ruleId ?? null,
    reversalOfId: input.reversalOfId ?? null,
    checkinRecordId: input.checkinRecordId ?? null,
    redemptionId: input.redemptionId ?? null,
    delta: input.delta,
    reason: input.reason.trim(),
    source: input.source ?? PointTransactionSource.MANUAL,
    meta: input.meta ?? null,
    syncPetGrowth: input.syncPetGrowth !== false,
  })
}

function existingFingerprint(transaction: {
  requestFingerprint: string | null
  teacherId: string
  classroomId: string
  studentId: string | null
  groupId: string | null
  ruleId: string | null
  reversalOfId: string | null
  checkinRecordId: string | null
  redemptionId: string | null
  delta: number
  reason: string
  source: PointTransactionSource
  meta: Prisma.JsonValue | null
}): string {
  return transaction.requestFingerprint ?? stableJson({
    actorTeacherId: transaction.teacherId,
    classroomId: transaction.classroomId,
    studentId: transaction.studentId,
    groupId: transaction.groupId,
    ruleId: transaction.ruleId,
    reversalOfId: transaction.reversalOfId,
    checkinRecordId: transaction.checkinRecordId,
    redemptionId: transaction.redemptionId,
    delta: transaction.delta,
    reason: transaction.reason,
    source: transaction.source,
    meta: transaction.meta,
  })
}

async function writeAuditIfAvailable(tx: Prisma.TransactionClient, input: Parameters<typeof writeAuditLogInTx>[1]): Promise<void> {
  if (!tx.auditLog?.create) return
  await writeAuditLogInTx(tx, input)
}

function assertIdempotencyMatch(
  existing: Parameters<typeof existingFingerprint>[0],
  input: CreatePointTransactionInput,
): void {
  if (existing.teacherId !== input.actorTeacherId || existing.classroomId !== input.classroomId) {
    throw new AppError("CONFLICT", "Idempotency key already used", 409)
  }
  if (existingFingerprint(existing) !== requestFingerprint(input)) {
    throw new AppError("CONFLICT", "Idempotency key reused with different request", 409)
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

  const normalizedReason = input.reason.trim()
  const source = input.source ?? PointTransactionSource.MANUAL
  const sharedData = {
    classroomId: input.classroomId,
    teacherId: input.actorTeacherId,
    ruleId: input.ruleId,
    reversalOfId: input.reversalOfId,
    checkinRecordId: input.checkinRecordId,
    redemptionId: input.redemptionId,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint: requestFingerprint(input),
    delta: input.delta,
    reason: normalizedReason,
    source,
    meta: input.meta === undefined ? undefined : (input.meta as Prisma.InputJsonValue),
  }

  if (input.studentId) {
    const student = await tx.student.findFirst({
      where: { id: input.studentId, classroomId: input.classroomId },
      select: { id: true },
    })
    if (!student) throw new AppError("NOT_FOUND", "Student not found", 404)

    // Conditional update: the balance predicate is part of the WHERE clause, so
    // concurrent deductions can never drive the balance below zero.
    const updatedStudent = await tx.student.updateMany({
      where: {
        id: input.studentId,
        classroomId: input.classroomId,
        ...(input.requireSufficientBalance && input.delta < 0
          ? { totalPoints: { gte: Math.abs(input.delta) } }
          : {}),
      },
      data: { totalPoints: { increment: input.delta } },
    })
    if (updatedStudent.count === 0) {
      throw new AppError("CONFLICT", "Insufficient points", 409)
    }

    const transaction = await tx.pointTransaction.create({
      data: { ...sharedData, studentId: input.studentId },
    })

    const currentStudent = await tx.student.findUnique({
      where: { id: input.studentId },
      select: { totalPoints: true },
    })

    const petGrowthDelta = input.syncPetGrowth === false ? 0 : Math.max(0, input.delta)
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
          reason: normalizedReason,
        },
      })
    }

    await writeAuditIfAvailable(tx, {
      action: input.delta >= 0 ? "POINTS_GRANTED" : "POINTS_DEDUCTED",
      entityType: "PointTransaction",
      entityId: transaction.id,
      classroomId: input.classroomId,
      metadata: {
        studentId: input.studentId,
        delta: input.delta,
        source,
        idempotencyKey: input.idempotencyKey,
      },
    })

    return {
      transaction,
      studentTotalPoints: currentStudent?.totalPoints ?? null,
      groupTotalPoints: null,
      petGrowthDelta,
    }
  }

  const group = await tx.group.findFirst({
    where: { id: input.groupId!, classroomId: input.classroomId },
    select: { id: true },
  })
  if (!group) throw new AppError("NOT_FOUND", "Group not found", 404)

  const transaction = await tx.pointTransaction.create({
    data: { ...sharedData, groupId: input.groupId },
  })
  const updatedGroup = await tx.group.update({
    where: { id: input.groupId! },
    data: { totalPoints: { increment: input.delta } },
  })

  await writeAuditIfAvailable(tx, {
    action: input.delta >= 0 ? "POINTS_GRANTED" : "POINTS_DEDUCTED",
    entityType: "PointTransaction",
    entityId: transaction.id,
    classroomId: input.classroomId,
    metadata: {
      groupId: input.groupId,
      delta: input.delta,
      source,
      idempotencyKey: input.idempotencyKey,
    },
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

  if (input.idempotencyKey) {
    const existing = await prisma.pointTransaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
    if (existing) {
      assertIdempotencyMatch(existing, input)
      return { transaction: existing, studentTotalPoints: null, groupTotalPoints: null, petGrowthDelta: 0 }
    }
  }

  try {
    return await prisma.$transaction((tx) => createPointTransactionInTx(tx, input))
  } catch (error: unknown) {
    if (!input.idempotencyKey || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error
    const existing = await prisma.pointTransaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
    if (!existing) throw error
    assertIdempotencyMatch(existing, input)
    return { transaction: existing, studentTotalPoints: null, groupTotalPoints: null, petGrowthDelta: 0 }
  }
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
    if (existing) return { transaction: existing, studentTotalPoints: null, groupTotalPoints: null, petGrowthDelta: 0 }

    return createPointTransactionInTx(tx, {
      actorTeacherId,
      classroomId: original.classroomId,
      studentId: original.studentId,
      groupId: original.groupId,
      reversalOfId: original.id,
      delta: -original.delta,
      reason,
      source: PointTransactionSource.ROLLBACK,
      syncPetGrowth: false,
      meta: { reversedTransactionId: original.id },
      requireSufficientBalance: original.studentId !== null && original.delta > 0,
    })
  })

  try {
    return await execute()
  } catch (error: unknown) {
    // A concurrent reversal either loses the unique(reversalOfId) race (P2002)
    // or trips the balance guard first — both mean "already reversed", so the
    // existing reversal is the correct idempotent answer.
    const uniqueConflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
    const lostRace = error instanceof AppError && error.code === "CONFLICT"
    if (!uniqueConflict && !lostRace) throw error

    const existing = await prisma.pointTransaction.findUnique({ where: { reversalOfId: original.id } })
    if (!existing) throw error
    return { transaction: existing, studentTotalPoints: null, groupTotalPoints: null, petGrowthDelta: 0 }
  }
}
