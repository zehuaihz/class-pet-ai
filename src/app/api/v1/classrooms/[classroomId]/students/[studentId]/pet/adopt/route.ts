import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { adoptNextPet } from "@/server/services/student-pet.service"
import { jsonError, jsonOk } from "@/server/utils/api"

export async function POST(_request: NextRequest, context: { params: Promise<{ classroomId: string; studentId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId, studentId } = await context.params
    return jsonOk({ pet: await adoptNextPet(teacher.teacherProfileId, classroomId, studentId) })
  } catch (error) {
    return jsonError(error)
  }
}
