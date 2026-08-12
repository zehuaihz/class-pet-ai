import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { assertGroupBelongsToClassroom, assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { jsonError, jsonOk } from "@/server/utils/api"
import { AppError } from "@/server/utils/errors"

async function loadOwnedStudent(teacherProfileId: string, studentId: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId } })
  if (!student) throw new AppError("NOT_FOUND", "Student not found", 404)
  await assertTeacherOwnsClassroom(teacherProfileId, student.classroomId)
  return student
}

export async function GET(_request: NextRequest, context: { params: Promise<{ studentId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { studentId } = await context.params
    const student = await loadOwnedStudent(teacher.teacherProfileId, studentId)
    return jsonOk(student)
  } catch (error) {
    return jsonError(error)
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ studentId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { studentId } = await context.params
    const student = await loadOwnedStudent(teacher.teacherProfileId, studentId)
    const body = await request.json()

    if (body.groupId) await assertGroupBelongsToClassroom(String(body.groupId), student.classroomId)

    const updated = await prisma.student.update({
      where: { id: studentId },
      data: {
        name: body.name === undefined ? undefined : String(body.name).trim(),
        studentNo: body.studentNo,
        groupId: body.groupId,
        avatarUrl: body.avatarUrl,
      },
    })

    return jsonOk(updated)
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ studentId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { studentId } = await context.params
    await loadOwnedStudent(teacher.teacherProfileId, studentId)
    await prisma.student.update({ where: { id: studentId }, data: { status: "DELETED" } })
    return jsonOk({ deleted: true })
  } catch (error) {
    return jsonError(error)
  }
}
