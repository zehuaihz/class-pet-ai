import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { assignRandomPet } from "@/server/services/student-pet.service"
import { jsonError, jsonOk } from "@/server/utils/api"

export async function POST(request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    const body = await request.json()

    const studentIds = body.all === true
      ? (await prisma.student.findMany({ where: { classroomId, status: "ACTIVE" }, select: { id: true } })).map((student) => student.id)
      : Array.isArray(body.studentIds)
        ? body.studentIds.map(String)
        : []

    const items = await assignRandomPet(teacher.teacherProfileId, classroomId, studentIds)
    return jsonOk({ items })
  } catch (error) {
    return jsonError(error)
  }
}
