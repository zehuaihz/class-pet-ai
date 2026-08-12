import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { assertGroupBelongsToClassroom, assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { jsonError, jsonOk } from "@/server/utils/api"
import { AppError } from "@/server/utils/errors"

async function getOwnedGroup(teacherProfileId: string, groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (!group) throw new AppError("NOT_FOUND", "Group not found", 404)
  await assertTeacherOwnsClassroom(teacherProfileId, group.classroomId)
  await assertGroupBelongsToClassroom(group.id, group.classroomId)
  return group
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { groupId } = await context.params
    const group = await getOwnedGroup(teacher.teacherProfileId, groupId)
    const body = await request.json()
    return jsonOk(await prisma.group.update({ where: { id: group.id }, data: { name: body.name === undefined ? undefined : String(body.name).trim() } }))
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { groupId } = await context.params
    const group = await getOwnedGroup(teacher.teacherProfileId, groupId)
    await prisma.group.delete({ where: { id: group.id } })
    return jsonOk({ deleted: true })
  } catch (error) {
    return jsonError(error)
  }
}
