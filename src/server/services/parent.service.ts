import { prisma } from "@/server/db/prisma"
import { AppError } from "@/server/utils/errors"

const RECENT_LIMIT = 20

async function assertParentLinkedToStudent(parentChildStudentIds: string[], studentId: string) {
  if (!parentChildStudentIds.includes(studentId)) {
    // Same error as a missing student so a parent cannot probe which ids exist.
    throw new AppError("NOT_FOUND", "Child not found", 404)
  }
}

/**
 * Read-only child detail for parents. Access is scoped strictly to the
 * parent-child links loaded from the session, never to the requested id.
 */
export async function getChildDetail(parentChildStudentIds: string[], studentId: string) {
  await assertParentLinkedToStudent(parentChildStudentIds, studentId)

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { classroom: { select: { id: true, name: true, grade: true } }, group: { select: { id: true, name: true } } },
  })
  if (!student) throw new AppError("NOT_FOUND", "Child not found", 404)

  const [transactions, checkinRecords, redemptions, pet] = await Promise.all([
    prisma.pointTransaction.findMany({
      where: { studentId, classroomId: student.classroomId },
      orderBy: { createdAt: "desc" },
      take: RECENT_LIMIT,
    }),
    prisma.checkinRecord.findMany({
      where: { studentId },
      include: { task: { select: { id: true, title: true, rewardPoints: true } } },
      orderBy: { createdAt: "desc" },
      take: RECENT_LIMIT,
    }),
    prisma.rewardRedemption.findMany({
      where: { studentId },
      include: { rewardItem: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: RECENT_LIMIT,
    }),
    prisma.pet.findUnique({
      where: { classroomId: student.classroomId },
      select: { name: true, level: true, mood: true },
    }),
  ])

  return {
    student: {
      id: student.id,
      name: student.name,
      studentNo: student.studentNo,
      status: student.status,
      totalPoints: student.totalPoints,
      group: student.group ? { id: student.group.id, name: student.group.name } : null,
      classroom: student.classroom,
    },
    pet,
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      delta: transaction.delta,
      reason: transaction.reason,
      source: transaction.source,
      createdAt: transaction.createdAt,
    })),
    checkins: checkinRecords.map((record) => ({
      id: record.id,
      taskTitle: record.task.title,
      status: record.status,
      rewardPoints: record.task.rewardPoints,
      submittedAt: record.submittedAt,
      approvedAt: record.approvedAt,
    })),
    redemptions: redemptions.map((redemption) => ({
      id: redemption.id,
      rewardName: redemption.rewardItem.name,
      pointsSpent: redemption.pointsSpent,
      status: redemption.status,
      createdAt: redemption.createdAt,
      fulfilledAt: redemption.fulfilledAt,
    })),
  }
}

export type ChildDetail = Awaited<ReturnType<typeof getChildDetail>>
