import { requireStudent } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { jsonError, jsonOk } from "@/server/utils/api"

export async function GET() {
  try {
    const user = await requireStudent()
    const student = await prisma.student.findUnique({
      where: { id: user.studentId },
      include: { classroom: true, group: true },
    })
    if (!student) return jsonOk({ student: null })

    // zoo 体系：学生个人成长宠物取代旧"班级宠物"。
    const pet = await prisma.studentPet.findFirst({
      where: { studentId: student.id, status: "GROWING" },
      select: { name: true, level: true },
    })

    return jsonOk({
      student: {
        id: student.id,
        name: student.name,
        totalPoints: student.totalPoints,
        group: student.group?.name ?? null,
        classroom: { id: student.classroom.id, name: student.classroom.name },
        pet: pet ? { name: pet.name, level: pet.level } : null,
      },
    })
  } catch (error) {
    return jsonError(error)
  }
}
