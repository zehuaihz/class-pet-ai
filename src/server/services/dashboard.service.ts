import { PetStatus } from "@prisma/client"
import { prisma } from "@/server/db/prisma"
import { getClassroomCheckinStats } from "@/server/services/checkin-stats.service"
import { getClassroomThresholds } from "@/server/services/pet-level-config.service"
import { getLevelProgress } from "@/server/domain/student-pet-rules"

export async function getClassroomDashboard(
  classroomId: string,
  actorTeacherId?: string,
  options?: { topStudentsTake?: number },
) {
  const [pets, students, recentTransactions, activeTasks, totalStudents, todayTransactions, thresholds] = await Promise.all([
    prisma.studentPet.findMany({
      where: { student: { classroomId }, status: PetStatus.GROWING },
      select: { name: true, level: true, growthValue: true, speciesKey: true },
    }),
    prisma.student.findMany({ where: { classroomId, status: "ACTIVE" }, orderBy: { totalPoints: "desc" }, take: options?.topStudentsTake ?? 3 }),
    prisma.pointTransaction.findMany({ where: { classroomId }, orderBy: { createdAt: "desc" }, take: 5, include: { student: true, group: true } }),
    prisma.checkinTask.findMany({ where: { classroomId, status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.student.count({ where: { classroomId, status: "ACTIVE" } }),
    prisma.pointTransaction.findMany({ where: { classroomId, createdAt: { gte: startOfToday() } } }),
    getClassroomThresholds(classroomId),
  ])

  const bestPet = pets.length > 0 ? pets.reduce((a, b) => (b.level > a.level || (b.level === a.level && b.growthValue > a.growthValue) ? b : a)) : null
  const progress = getLevelProgress(bestPet?.growthValue ?? 0, thresholds)
  const pet = {
    name: "班级宠物",
    level: bestPet?.level ?? 0,
    speciesKey: bestPet?.speciesKey ?? null,
    growthValue: bestPet?.growthValue ?? 0,
    totalPets: pets.length,
    nextThreshold: progress.nextThreshold,
    progressRatio: progress.progressRatio,
    remainingToNext: progress.remainingToNext,
    graduated: progress.graduated,
  }

  const stats = actorTeacherId
    ? await getClassroomCheckinStats(actorTeacherId, classroomId)
    : await getDashboardStatsWithoutAuthorization(classroomId, activeTasks.map((task) => task.id))
  const completedCount = stats.reduce((sum, item) => sum + item.completedCount, 0)
  const missedCount = stats.reduce((sum, item) => sum + item.missedCount, 0)
  const denominator = stats.length > 0 ? stats.reduce((sum, item) => sum + item.totalStudents, 0) : totalStudents

  return {
    today: {
      checkinRate: denominator === 0 ? 0 : completedCount / denominator,
      pointCount: todayTransactions.reduce((sum, tx) => sum + tx.delta, 0),
      missedCount,
    },
    pet,
    topStudents: students,
    recentTransactions,
    activeTasks,
  }
}

function startOfToday(): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

async function getDashboardStatsWithoutAuthorization(classroomId: string, taskIds: string[]) {
  const [students, groups] = await Promise.all([
    prisma.student.count({ where: { classroomId, status: "ACTIVE" } }),
    taskIds.length > 0
      ? prisma.checkinRecord.groupBy({
          by: ["taskId", "status"],
          where: { taskId: { in: taskIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ])
  if (taskIds.length === 0) {
    const [completedCount, missedCount] = await Promise.all([
      prisma.checkinRecord.count({ where: { task: { classroomId }, status: { in: ["COMPLETED", "APPROVED"] } } }),
      prisma.checkinRecord.count({ where: { task: { classroomId }, status: "MISSED" } }),
    ])
    return [{
      taskId: "dashboard",
      totalStudents: students,
      completedCount,
      approvedCount: 0,
      pendingCount: 0,
      rejectedCount: 0,
      missedCount,
      completionRate: students === 0 ? 0 : completedCount / students,
    }]
  }
  return taskIds.map((taskId) => {
    const rows = groups.filter((row) => row.taskId === taskId)
    const count = (status: string) => rows.find((row) => row.status === status)?._count._all ?? 0
    const completedCount = count("COMPLETED") + count("APPROVED")
    return {
      taskId,
      totalStudents: students,
      completedCount,
      approvedCount: count("APPROVED"),
      pendingCount: count("PENDING"),
      rejectedCount: count("REJECTED"),
      missedCount: count("MISSED"),
      completionRate: students === 0 ? 0 : completedCount / students,
    }
  })
}
