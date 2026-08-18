import { CheckinStatus, Prisma } from "@prisma/client"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { AppError } from "@/server/utils/errors"

export interface CheckinStats {
  taskId: string
  totalStudents: number
  completedCount: number
  approvedCount: number
  pendingCount: number
  rejectedCount: number
  missedCount: number
  completionRate: number
}

interface StatsClient {
  checkinTask: Pick<typeof prisma.checkinTask, "findUnique" | "findMany">
  checkinRecord: Pick<typeof prisma.checkinRecord, "count">
  student: Pick<typeof prisma.student, "count">
}

async function computeCheckinStats(client: StatsClient, taskId: string, classroomId: string): Promise<CheckinStats> {
  // 打卡记录只统计未删除学生（软删除学生不计入）。
  const studentActiveFilter = { status: "ACTIVE" }
  const [completedCount, approvedCount, pendingCount, rejectedCount, missedCount, totalStudents] = await Promise.all([
    client.checkinRecord.count({ where: { taskId, status: CheckinStatus.COMPLETED, student: studentActiveFilter } }),
    client.checkinRecord.count({ where: { taskId, status: CheckinStatus.APPROVED, student: studentActiveFilter } }),
    client.checkinRecord.count({ where: { taskId, status: CheckinStatus.PENDING, student: studentActiveFilter } }),
    client.checkinRecord.count({ where: { taskId, status: CheckinStatus.REJECTED, student: studentActiveFilter } }),
    client.checkinRecord.count({ where: { taskId, status: CheckinStatus.MISSED, student: studentActiveFilter } }),
    client.student.count({ where: { classroomId, status: "ACTIVE" } }),
  ])
  return {
    taskId,
    totalStudents,
    completedCount,
    approvedCount,
    pendingCount,
    rejectedCount,
    missedCount,
    completionRate: totalStudents === 0 ? 0 : completedCount / totalStudents,
  }
}

export async function getCheckinStatsWithClient(
  client: StatsClient,
  actorTeacherId: string,
  taskId: string,
): Promise<CheckinStats> {
  const task = await client.checkinTask.findUnique({ where: { id: taskId } })
  if (!task) throw new AppError("NOT_FOUND", "Task not found", 404)
  await assertTeacherOwnsClassroom(actorTeacherId, task.classroomId)
  return computeCheckinStats(client, taskId, task.classroomId)
}

export async function getCheckinStats(actorTeacherId: string, taskId: string): Promise<CheckinStats> {
  return getCheckinStatsWithClient(prisma, actorTeacherId, taskId)
}

export async function getClassroomCheckinStats(
  actorTeacherId: string,
  classroomId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<CheckinStats[]> {
  await assertTeacherOwnsClassroom(actorTeacherId, classroomId)
  const tasks = await client.checkinTask.findMany({ where: { classroomId, status: "ACTIVE" }, select: { id: true } })
  return Promise.all(tasks.map((task) => computeCheckinStats(client, task.id, classroomId)))
}
