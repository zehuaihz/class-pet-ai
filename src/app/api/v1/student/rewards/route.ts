import { requireStudent } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { jsonError, jsonOk } from "@/server/utils/api"

export async function GET() {
  try {
    const user = await requireStudent()
    const student = await prisma.student.findUnique({ where: { id: user.studentId }, select: { classroomId: true, totalPoints: true } })
    if (!student) return jsonOk({ items: [], totalPoints: 0 })
    const items = await prisma.rewardItem.findMany({ where: { classroomId: student.classroomId, enabled: true }, orderBy: { costPoints: "asc" } })
    return jsonOk({ items, totalPoints: student.totalPoints })
  } catch (error) {
    return jsonError(error)
  }
}
