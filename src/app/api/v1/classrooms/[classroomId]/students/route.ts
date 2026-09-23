import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { assertGroupBelongsToClassroom, assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { jsonError, jsonOk } from "@/server/utils/api"
import { AppError } from "@/server/utils/errors"

export async function GET(request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    await assertTeacherOwnsClassroom(teacher.teacherProfileId, classroomId)

    const { searchParams } = new URL(request.url)
    const keyword = searchParams.get("keyword")?.trim()
    const groupId = searchParams.get("groupId") ?? undefined
    if (groupId) await assertGroupBelongsToClassroom(groupId, classroomId)

    const students = await prisma.student.findMany({
      where: {
        classroomId,
        groupId,
        name: keyword ? { contains: keyword, mode: "insensitive" } : undefined,
        status: "ACTIVE",
      },
      include: { group: true },
      orderBy: [{ totalPoints: "desc" }, { name: "asc" }],
    })

    return jsonOk({
      items: students.map((student) => ({
        id: student.id,
        name: student.name,
        studentNo: student.studentNo,
        avatarUrl: student.avatarUrl,
        totalPoints: student.totalPoints,
        group: student.group ? { id: student.group.id, name: student.group.name } : null,
      })),
    })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    await assertTeacherOwnsClassroom(teacher.teacherProfileId, classroomId)

    const body = await request.json()
    const name = String(body.name ?? "").trim()
    if (!name) throw new AppError("VALIDATION_ERROR", "student name required", 422)
    if (body.groupId) await assertGroupBelongsToClassroom(String(body.groupId), classroomId)

    const student = await prisma.student.create({
      data: {
        classroomId,
        name,
        studentNo: body.studentNo ?? null,
        groupId: body.groupId ?? null,
        avatarUrl: body.avatarUrl ?? null,
      },
    })

    return jsonOk(student)
  } catch (error) {
    return jsonError(error)
  }
}
