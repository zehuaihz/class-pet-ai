import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { jsonError, jsonOk } from "@/server/utils/api"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { getClassroomDashboard } from "@/server/services/dashboard.service"
import { listZoo } from "@/server/services/student-pet.service"
import { getGloryBoard } from "@/server/services/leaderboard.service"
import { getSystemName } from "@/server/services/system-setting.service"

export async function GET(_request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    const classroom = await assertTeacherOwnsClassroom(teacher.teacherProfileId, classroomId)
    const [dashboard, zoo, gloryBoard, systemName] = await Promise.all([
      getClassroomDashboard(classroomId),
      listZoo(teacher.teacherProfileId, classroomId),
      getGloryBoard(teacher.teacherProfileId, classroomId),
      getSystemName(),
    ])
    return jsonOk({
      classroomName: classroom.name,
      systemName,
      todayPointCount: dashboard.today.pointCount,
      zoo,
      gloryBoard: gloryBoard.slice(0, 10),
      slogan: "认真表现，喂养你的专属宠物！",
    })
  } catch (error) {
    return jsonError(error)
  }
}
