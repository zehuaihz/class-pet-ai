import { CheckinScheduleType, CheckinTaskType, TaskStatus } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { getCheckinStats } from "@/server/services/checkin-stats.service"

const createCheckinTaskSchema = z.object({
  actorTeacherId: z.string().min(1),
  classroomId: z.string().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  taskType: z.nativeEnum(CheckinTaskType).default(CheckinTaskType.CUSTOM),
  scheduleType: z.nativeEnum(CheckinScheduleType).default(CheckinScheduleType.ONE_TIME),
  deadlineAt: z.string().datetime().optional(),
  rewardPoints: z.number().int().min(0).default(0),
  requireEvidence: z.boolean().default(false),
})

export type CreateCheckinTaskInput = z.infer<typeof createCheckinTaskSchema>

export async function createCheckinTask(input: unknown) {
  const parsed = createCheckinTaskSchema.parse(input)
  await assertTeacherOwnsClassroom(parsed.actorTeacherId, parsed.classroomId)

  return prisma.checkinTask.create({
    data: {
      classroomId: parsed.classroomId,
      createdByTeacherId: parsed.actorTeacherId,
      title: parsed.title,
      description: parsed.description,
      taskType: parsed.taskType,
      scheduleType: parsed.scheduleType,
      deadlineAt: parsed.deadlineAt ? new Date(parsed.deadlineAt) : null,
      rewardPoints: parsed.rewardPoints,
      requireEvidence: parsed.requireEvidence,
      status: TaskStatus.ACTIVE,
    },
  })
}

export async function listCheckinTasks(actorTeacherId: string, classroomId: string, status?: TaskStatus) {
  await assertTeacherOwnsClassroom(actorTeacherId, classroomId)
  const tasks = await prisma.checkinTask.findMany({
    where: { classroomId, status: status ?? undefined },
    orderBy: { createdAt: "desc" },
  })
  const stats = await Promise.all(tasks.map((task) => getCheckinStats(actorTeacherId, task.id)))
  const statsByTaskId = new Map(stats.map((item) => [item.taskId, item]))
  return tasks.map((task) => ({ ...task, stats: statsByTaskId.get(task.id) }))
}

export async function getCheckinTaskStats(actorTeacherId: string, taskId: string) {
  return getCheckinStats(actorTeacherId, taskId)
}
