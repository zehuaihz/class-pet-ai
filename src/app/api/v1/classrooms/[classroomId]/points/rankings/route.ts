import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { getGroupPointTotals } from "@/server/services/group-points.service"
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

    const [groups, groupTotals] = await Promise.all([
      prisma.group.findMany({ where: { classroomId }, select: { id: true, name: true } }),
      getGroupPointTotals(classroomId),
    ])

    // The group ranking uses the shared 小组总积分 definition (member balances
    // plus group-level awards) so it agrees with the member scores above.
    const totalsByGroup = new Map(groupTotals.map((total) => [total.groupId, total]))
    const rankedGroups = groups
      .map((group) => ({
        groupId: group.id,
        name: group.name,
        totalPoints: totalsByGroup.get(group.id)?.totalPoints ?? 0,
      }))
      .sort((left, right) => right.totalPoints - left.totalPoints || left.name.localeCompare(right.name))
      .slice(0, 20)

    return jsonOk({
      students: students.map((student, index) => ({
        rank: index + 1,
        studentId: student.id,
        name: student.name,
        totalPoints: student.totalPoints,
      })),
      groups: rankedGroups.map((group, index) => ({
        rank: index + 1,
        groupId: group.groupId,
        name: group.name,
        totalPoints: group.totalPoints,
      })),
    })
  } catch (error) {
    return jsonError(error)
  }
}
