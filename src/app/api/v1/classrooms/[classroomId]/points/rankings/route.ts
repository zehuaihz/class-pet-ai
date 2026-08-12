import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { jsonError, jsonOk } from "@/server/utils/api"

export async function GET(_request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    await assertTeacherOwnsClassroom(teacher.teacherProfileId, classroomId)

    const students = await prisma.student.findMany({
      where: { classroomId, status: "ACTIVE" },
      orderBy: [{ totalPoints: "desc" }, { name: "asc" }],
      take: 20,
    })

    const groups = await prisma.group.findMany({
      where: { classroomId },
      orderBy: [{ totalPoints: "desc" }, { name: "asc" }],
      take: 20,
    })

    return jsonOk({
      students: students.map((student, index) => ({
        rank: index + 1,
        studentId: student.id,
        name: student.name,
        totalPoints: student.totalPoints,
      })),
      groups: groups.map((group, index) => ({
        rank: index + 1,
        groupId: group.id,
        name: group.name,
        totalPoints: group.totalPoints,
      })),
    })
  } catch (error) {
    return jsonError(error)
  }
}
