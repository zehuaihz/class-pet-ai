import { requireStudent } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { jsonError, jsonOk } from "@/server/utils/api"

export async function GET() {
  try {
    const user = await requireStudent()
    const student = await prisma.student.findUnique({
      where: { id: user.studentId },
      include: { classroom: { include: { pet: true } }, group: true },
    })
    if (!student) return jsonOk({ student: null })
    return jsonOk({
      student: {
        id: student.id,
        name: student.name,
        totalPoints: student.totalPoints,
        group: student.group?.name ?? null,
        classroom: { id: student.classroom.id, name: student.classroom.name },
        pet: student.classroom.pet ? { name: student.classroom.pet.name, level: student.classroom.pet.level } : null,
      },
    })
  } catch (error) {
    return jsonError(error)
  }
}
