import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { jsonError, jsonOk } from "@/server/utils/api"
import { AppError } from "@/server/utils/errors"

async function getOwnedRule(teacherProfileId: string, ruleId: string) {
  const rule = await prisma.pointRule.findUnique({ where: { id: ruleId } })
  if (!rule) throw new AppError("NOT_FOUND", "Point rule not found", 404)
  await assertTeacherOwnsClassroom(teacherProfileId, rule.classroomId)
  return rule
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ ruleId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { ruleId } = await context.params
    const rule = await getOwnedRule(teacher.teacherProfileId, ruleId)
    const body = await request.json()
    const pointDelta = body.pointDelta === undefined ? undefined : Number(body.pointDelta)
    if (pointDelta !== undefined && !Number.isInteger(pointDelta)) throw new AppError("VALIDATION_ERROR", "pointDelta must be integer", 422)
    return jsonOk(await prisma.pointRule.update({ where: { id: rule.id }, data: { name: body.name === undefined ? undefined : String(body.name).trim(), category: body.category, pointDelta, enabled: body.enabled } }))
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ ruleId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { ruleId } = await context.params
    const rule = await getOwnedRule(teacher.teacherProfileId, ruleId)
    return jsonOk(await prisma.pointRule.update({ where: { id: rule.id }, data: { enabled: false } }))
  } catch (error) {
    return jsonError(error)
  }
}
