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
    const redemptions = await prisma.rewardRedemption.findMany({
      where: { rewardItem: { classroomId } },
      include: { student: true, rewardItem: true },
      orderBy: { requestedAt: "desc" },
    })
    return jsonOk({ items: redemptions })
  } catch (error) {
    return jsonError(error)
  }
}
