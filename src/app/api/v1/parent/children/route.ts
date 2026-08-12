import { requireParent } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { jsonError, jsonOk } from "@/server/utils/api"

export async function GET() {
  try {
    const user = await requireParent()
    const students = await prisma.student.findMany({
      where: { id: { in: user.childStudentIds } },
      include: { classroom: true },
    })
    return jsonOk({
      items: students.map((student) => ({
        id: student.id,
        name: student.name,
        totalPoints: student.totalPoints,
        classroom: { id: student.classroom.id, name: student.classroom.name },
      })),
    })
  } catch (error) {
    return jsonError(error)
  }
}
