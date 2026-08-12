import { BadgeStatus } from "@prisma/client"
import { requireStudent } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { jsonError, jsonOk } from "@/server/utils/api"

export async function GET() {
  try {
    const user = await requireStudent()
    const student = await prisma.student.findUnique({ where: { id: user.studentId }, select: { classroomId: true } })
    if (!student) return jsonOk({ items: [], availableBadges: 0 })
    const [items, availableBadges] = await Promise.all([
      prisma.rewardItem.findMany({ where: { classroomId: student.classroomId, enabled: true }, orderBy: { costBadges: "asc" } }),
      prisma.badge.count({ where: { studentId: user.studentId, status: BadgeStatus.AVAILABLE } }),
    ])
    return jsonOk({ items, availableBadges })
  } catch (error) {
    return jsonError(error)
  }
}
