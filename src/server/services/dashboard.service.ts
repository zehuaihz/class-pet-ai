import { prisma } from "@/server/db/prisma"
import { getClassroomPet } from "@/server/services/pet-growth.service"
import { getClassroomCheckinStats } from "@/server/services/checkin-stats.service"

export async function getClassroomDashboard(classroomId: string, actorTeacherId?: string) {
  const [pet, students, recentTransactions, activeTasks, totalStudents, todayTransactions] = await Promise.all([
    getClassroomPet(classroomId),
    prisma.student.findMany({ where: { classroomId, status: "ACTIVE" }, orderBy: { totalPoints: "desc" }, take: 3 }),
    prisma.pointTransaction.findMany({ where: { classroomId }, orderBy: { createdAt: "desc" }, take: 5, include: { student: true, group: true } }),
    prisma.checkinTask.findMany({ where: { classroomId, status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.student.count({ where: { classroomId, status: "ACTIVE" } }),
    prisma.pointTransaction.findMany({ where: { classroomId, createdAt: { gte: startOfToday() } } }),
  ])

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
