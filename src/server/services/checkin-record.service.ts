import { CheckinStatus, Prisma, TaskStatus } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { createPointTransactionInTx } from "@/server/services/point-transaction.service"
import { writeAuditLogInTx } from "@/server/services/audit-log.service"
import { AppError } from "@/server/utils/errors"

const submitCheckinSchema = z.object({
  actorTeacherId: z.string().min(1).optional(),
  studentId: z.string().min(1),
  taskId: z.string().min(1),
  evidenceUrl: z.string().url().optional().nullable(),
})

async function writeAuditIfAvailable(tx: Prisma.TransactionClient, input: Parameters<typeof writeAuditLogInTx>[1]): Promise<void> {
  if (!tx.auditLog?.create) return
  await writeAuditLogInTx(tx, input)
}

async function findCheckinWithTask(recordId: string) {
  const record = await prisma.checkinRecord.findUnique({ where: { id: recordId }, include: { task: true } })
  if (!record) throw new AppError("NOT_FOUND", "Record not found", 404)
  return record
}

export async function submitCheckinRecord(input: unknown) {
  const parsed = submitCheckinSchema.parse(input)
  const task = await prisma.checkinTask.findUnique({ where: { id: parsed.taskId } })
  if (!task) throw new AppError("NOT_FOUND", "Task not found", 404)

  const student = await prisma.student.findUnique({ where: { id: parsed.studentId } })
  if (!student) throw new AppError("NOT_FOUND", "Student not found", 404)
  if (student.classroomId !== task.classroomId) throw new AppError("FORBIDDEN", "Student not in classroom", 403)
  if (parsed.actorTeacherId) await assertTeacherOwnsClassroom(parsed.actorTeacherId, task.classroomId)

  const status = task.requireEvidence ? CheckinStatus.PENDING : CheckinStatus.COMPLETED
  return insertCheckinRecord({
    task: { id: task.id, classroomId: task.classroomId, createdByTeacherId: task.createdByTeacherId, title: task.title, rewardPoints: task.rewardPoints },
    studentId: student.id,
    evidenceUrl: parsed.evidenceUrl ?? null,
    status,
  })
}

/**
 * Creates the record (and any immediate reward) in one transaction. The unique
 * (taskId, studentId) constraint is the real guard, so a concurrent duplicate
 * submission is reported as a conflict rather than surfacing a raw P2002.
 */
async function insertCheckinRecord(input: {
  task: { id: string; classroomId: string; createdByTeacherId: string; title: string; rewardPoints: number }
  studentId: string
  evidenceUrl: string | null
  status: CheckinStatus
}) {
  const { task } = input
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.checkinRecord.findUnique({
        where: { taskId_studentId: { taskId: task.id, studentId: input.studentId } },
      })
      if (existing) throw new AppError("CONFLICT", "Checkin record exists", 409)

      const record = await tx.checkinRecord.create({
        data: {
          taskId: task.id,
          studentId: input.studentId,
          status: input.status,
          evidenceUrl: input.evidenceUrl,
          submittedAt: new Date(),
        },
      })

      if (input.status === CheckinStatus.COMPLETED && task.rewardPoints > 0) {
        await createPointTransactionInTx(tx, {
          actorTeacherId: task.createdByTeacherId,
          classroomId: task.classroomId,
          studentId: input.studentId,
          delta: task.rewardPoints,
          reason: task.title,
          source: "CHECKIN",
          checkinRecordId: record.id,
          meta: { taskId: task.id, recordId: record.id },
        })
      }
      await writeAuditIfAvailable(tx, {
        action: "CHECKIN_SUBMITTED",
        entityType: "CheckinRecord",
        entityId: record.id,
        classroomId: task.classroomId,
        metadata: { taskId: task.id, studentId: input.studentId, status: input.status },
      })
      return record
    })
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("CONFLICT", "Checkin record exists", 409)
    }
    throw error
  }
}

const studentSubmitSchema = z.object({
  taskId: z.string().min(1),
  evidenceUrl: z.string().url().optional().nullable(),
  idempotencyKey: z.string().trim().min(8).max(255).optional().nullable(),
})

/**
 * Student self-service check-in. The student identity is supplied by the caller
 * from the authenticated session — never from request data.
 */
export async function submitStudentCheckin(studentId: string, input: unknown) {
  const parsed = studentSubmitSchema.parse(input)
  const student = await prisma.student.findUnique({ where: { id: studentId } })
  if (!student) throw new AppError("NOT_FOUND", "Student not found", 404)
  if (student.status !== "ACTIVE") throw new AppError("FORBIDDEN", "Student not active", 403)

  const task = await prisma.checkinTask.findUnique({ where: { id: parsed.taskId } })
  if (!task) throw new AppError("NOT_FOUND", "Task not found", 404)
  if (task.classroomId !== student.classroomId) throw new AppError("FORBIDDEN", "Task not in your classroom", 403)
  if (task.status !== TaskStatus.ACTIVE) throw new AppError("CONFLICT", "Task is not open", 409)
  if (task.deadlineAt && task.deadlineAt.getTime() < Date.now()) {
    throw new AppError("CONFLICT", "Task deadline has passed", 409)
  }
  if (task.requireEvidence && !parsed.evidenceUrl) {
    throw new AppError("VALIDATION_ERROR", "Evidence is required for this task", 422)
  }

  const existing = await prisma.checkinRecord.findUnique({
    where: { taskId_studentId: { taskId: task.id, studentId } },
  })
  if (existing) {
    // Replaying the same submission is idempotent; anything else is a conflict.
    if (parsed.idempotencyKey && existing.evidenceUrl === (parsed.evidenceUrl ?? null)) return existing
    throw new AppError("CONFLICT", "Already checked in", 409)
  }

  return submitCheckinRecord({ studentId, taskId: task.id, evidenceUrl: parsed.evidenceUrl ?? null })
}

export async function listStudentCheckins(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, classroomId: true, totalPoints: true, name: true },
  })
  if (!student) throw new AppError("NOT_FOUND", "Student not found", 404)

  const [tasks, records] = await Promise.all([
    prisma.checkinTask.findMany({
      where: { classroomId: student.classroomId, status: TaskStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
    }),
    prisma.checkinRecord.findMany({
      where: { studentId },
      include: { task: true },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const recordByTaskId = new Map(records.map((record) => [record.taskId, record]))
  const now = Date.now()

  return {
    student: { id: student.id, name: student.name, totalPoints: student.totalPoints },
    tasks: tasks.map((task) => {
      const record = recordByTaskId.get(task.id)
      const overdue = Boolean(task.deadlineAt && task.deadlineAt.getTime() < now)
      return {
        id: task.id,
        title: task.title,
        description: task.description,
        rewardPoints: task.rewardPoints,
        requireEvidence: task.requireEvidence,
        deadlineAt: task.deadlineAt,
        overdue,
        record: record
          ? { id: record.id, status: record.status, evidenceUrl: record.evidenceUrl, submittedAt: record.submittedAt }
          : null,
      }
    }),
    records: records.map((record) => ({
      id: record.id,
      taskId: record.taskId,
      taskTitle: record.task.title,
      status: record.status,
      rewardPoints: record.task.rewardPoints,
      evidenceUrl: record.evidenceUrl,
      submittedAt: record.submittedAt,
    })),
  }
}

export async function approveCheckinRecord(actorTeacherId: string, recordId: string) {
  const record = await findCheckinWithTask(recordId)
  await assertTeacherOwnsClassroom(actorTeacherId, record.task.classroomId)
  if (record.status !== CheckinStatus.PENDING) return record

  return prisma.$transaction(async (tx) => {
    const current = await tx.checkinRecord.findUnique({ where: { id: recordId }, include: { task: true } })
    if (!current) throw new AppError("NOT_FOUND", "Record not found", 404)

    const approvedAt = new Date()
    const updated = await tx.checkinRecord.updateMany({
      where: { id: recordId, status: CheckinStatus.PENDING },
      data: { status: CheckinStatus.APPROVED, approvedById: actorTeacherId, approvedAt },
    })
    if (updated.count === 0) return tx.checkinRecord.findUnique({ where: { id: recordId }, include: { task: true } })

    if (current.task.rewardPoints > 0) {
      await createPointTransactionInTx(tx, {
        actorTeacherId,
        classroomId: current.task.classroomId,
        studentId: current.studentId,
        delta: current.task.rewardPoints,
        reason: current.task.title,
        source: "CHECKIN",
        checkinRecordId: current.id,
        meta: { taskId: current.taskId, recordId: current.id },
      })
    }
    await writeAuditIfAvailable(tx, {
      action: "CHECKIN_APPROVED",
      entityType: "CheckinRecord",
      entityId: current.id,
      classroomId: current.task.classroomId,
      metadata: { taskId: current.taskId, studentId: current.studentId, rewardPoints: current.task.rewardPoints },
    })
    return tx.checkinRecord.findUnique({ where: { id: recordId }, include: { task: true } })
  })
}

export async function rejectCheckinRecord(actorTeacherId: string, recordId: string) {
  const record = await findCheckinWithTask(recordId)
  await assertTeacherOwnsClassroom(actorTeacherId, record.task.classroomId)

  return prisma.$transaction(async (tx) => {
    const updated = await tx.checkinRecord.updateMany({
      where: { id: recordId, status: CheckinStatus.PENDING },
      data: { status: CheckinStatus.REJECTED, approvedById: actorTeacherId, approvedAt: new Date() },
    })
    const result = await tx.checkinRecord.findUnique({ where: { id: recordId }, include: { task: true } })
    if (updated.count > 0 && result) {
      await writeAuditIfAvailable(tx, {
        action: "CHECKIN_REJECTED",
        entityType: "CheckinRecord",
        entityId: result.id,
        classroomId: result.task.classroomId,
        metadata: { taskId: result.taskId, studentId: result.studentId },
      })
    }
    return result
  })
}
