import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { getGroupPointTotals } from "@/server/services/group-points.service"
import { jsonError, jsonOk } from "@/server/utils/api"
import { AppError } from "@/server/utils/errors"

export async function GET(_request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    await assertTeacherOwnsClassroom(teacher.teacherProfileId, classroomId)

    const [groups, totals] = await Promise.all([
      prisma.group.findMany({ where: { classroomId }, orderBy: { sortOrder: "asc" } }),
      getGroupPointTotals(classroomId),
    ])

    // `totalPoints` is reported with the shared 小组总积分 definition; the raw
    // group-level ledger amount stays available as `groupBonusPoints`.
    const totalsByGroup = new Map(totals.map((total) => [total.groupId, total]))
    return jsonOk({
      items: groups.map((group) => {
        const total = totalsByGroup.get(group.id)
        return {
          ...group,
          memberPoints: total?.memberPoints ?? 0,
          groupBonusPoints: total?.groupBonusPoints ?? group.totalPoints,
          totalPoints: total?.totalPoints ?? group.totalPoints,
        }
      }),
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
    if (!name) throw new AppError("VALIDATION_ERROR", "group name required", 422)
    return jsonOk(await prisma.group.create({ data: { classroomId, name, sortOrder: Number(body.sortOrder ?? 0) } }))
  } catch (error) {
    return jsonError(error)
  }
}
