import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { jsonError, jsonOk } from "@/server/utils/api"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { getClassroomDashboard } from "@/server/services/dashboard.service"

export async function GET(_request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    const classroom = await assertTeacherOwnsClassroom(teacher.teacherProfileId, classroomId)
    const dashboard = await getClassroomDashboard(classroomId)
    return jsonOk({
      classroomName: classroom.name,
      pet: dashboard.pet,
      todayPointCount: dashboard.today.pointCount,
      checkinRate: dashboard.today.checkinRate,
      rankings: dashboard.topStudents,
      slogan: "认真完成任务，喂养班级宠物！",
    })
  } catch (error) {
    return jsonError(error)
  }
}
