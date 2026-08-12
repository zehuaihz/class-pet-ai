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
    await assertTeacherOwnsClassroom(teacher.teacherProfileId, classroomId)
    return jsonOk({ items: await prisma.pointRule.findMany({ where: { classroomId, enabled: true }, orderBy: { createdAt: "asc" } }) })
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
    const pointDelta = Number(body.pointDelta)
    if (!name || !Number.isInteger(pointDelta)) throw new AppError("VALIDATION_ERROR", "name and integer pointDelta required", 422)
    return jsonOk(await prisma.pointRule.create({ data: { classroomId, name, category: body.category ?? null, pointDelta } }))
  } catch (error) {
    return jsonError(error)
  }
}
