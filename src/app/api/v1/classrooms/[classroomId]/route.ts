import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { jsonError, jsonOk } from "@/server/utils/api"
import { AppError } from "@/server/utils/errors"

export async function GET(_request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    const classroom = await assertTeacherOwnsClassroom(teacher.teacherProfileId, classroomId)
    return jsonOk(classroom)
  } catch (error) {
    return jsonError(error)
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    await assertTeacherOwnsClassroom(teacher.teacherProfileId, classroomId)

    const body = await request.json()
    const name = body.name === undefined ? undefined : String(body.name).trim()
    if (name !== undefined && !name) throw new AppError("VALIDATION_ERROR", "classroom name required", 422)

    const classroom = await prisma.classroom.update({
      where: { id: classroomId },
      data: {
        name,
        grade: body.grade,
        schoolName: body.schoolName,
        isPublicRank: body.isPublicRank,
      },
    })

    return jsonOk(classroom)
  } catch (error) {
    return jsonError(error)
  }
}
