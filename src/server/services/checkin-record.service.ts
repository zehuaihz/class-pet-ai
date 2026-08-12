import { CheckinStatus } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { createPointTransactionInTx } from "@/server/services/point-transaction.service"
import { AppError } from "@/server/utils/errors"

const submitCheckinSchema = z.object({
  actorTeacherId: z.string().min(1).optional(),
  studentId: z.string().min(1),
  taskId: z.string().min(1),
  evidenceUrl: z.string().url().optional().nullable(),
})

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
  return prisma.$transaction(async (tx) => {
    const existing = await tx.checkinRecord.findUnique({
      where: { taskId_studentId: { taskId: parsed.taskId, studentId: parsed.studentId } },
    })
    if (existing) throw new AppError("CONFLICT", "Checkin record exists", 409)

    const record = await tx.checkinRecord.create({
      data: {
        taskId: task.id,
        studentId: parsed.studentId,
        status,
        evidenceUrl: parsed.evidenceUrl ?? null,
        submittedAt: new Date(),
      },
    })

    if (status === CheckinStatus.COMPLETED && task.rewardPoints > 0) {
      await createPointTransactionInTx(tx, {
        actorTeacherId: task.createdByTeacherId,
        classroomId: task.classroomId,
        studentId: student.id,
        delta: task.rewardPoints,
        reason: task.title,
        source: "CHECKIN",
        checkinRecordId: record.id,
        meta: { taskId: task.id, recordId: record.id },
      })
    }
    return record
  })
}

export async function approveCheckinRecord(actorTeacherId: string, recordId: string) {
  const record = await findCheckinWithTask(recordId)
  await assertTeacherOwnsClassroom(actorTeacherId, record.task.classroomId)
  if (record.status !== CheckinStatus.PENDING) return record

  return prisma.$transaction(async (tx) => {
    const updated = await tx.checkinRecord.updateMany({
      where: { id: recordId, status: CheckinStatus.PENDING },
      data: { status: CheckinStatus.APPROVED, approvedById: actorTeacherId, approvedAt: new Date() },
    })
    if (updated.count === 0) {
      return tx.checkinRecord.findUnique({ where: { id: recordId }, include: { task: true } })
    }

    if (record.task.rewardPoints > 0) {
      await createPointTransactionInTx(tx, {
        actorTeacherId,
        classroomId: record.task.classroomId,
        studentId: record.studentId,
        delta: record.task.rewardPoints,
        reason: record.task.title,
        source: "CHECKIN",
        checkinRecordId: record.id,
        meta: { taskId: record.taskId, recordId: record.id },
      })
    }
    return tx.checkinRecord.findUnique({ where: { id: recordId }, include: { task: true } })
  })
}

export async function rejectCheckinRecord(actorTeacherId: string, recordId: string) {
  const record = await findCheckinWithTask(recordId)
  await assertTeacherOwnsClassroom(actorTeacherId, record.task.classroomId)

  const updated = await prisma.checkinRecord.updateMany({
    where: { id: recordId, status: CheckinStatus.PENDING },
    data: { status: CheckinStatus.REJECTED, approvedById: actorTeacherId, approvedAt: new Date() },
  })
  if (updated.count === 0) return prisma.checkinRecord.findUnique({ where: { id: recordId }, include: { task: true } })
  return prisma.checkinRecord.findUnique({ where: { id: recordId }, include: { task: true } })
}
