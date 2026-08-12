import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { jsonError, jsonOk } from "@/server/utils/api"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { getClassroomPet } from "@/server/services/pet-growth.service"

export async function GET(_request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    await assertTeacherOwnsClassroom(teacher.teacherProfileId, classroomId)
    return jsonOk(await getClassroomPet(classroomId))
  } catch (error) {
    return jsonError(error)
  }
}
