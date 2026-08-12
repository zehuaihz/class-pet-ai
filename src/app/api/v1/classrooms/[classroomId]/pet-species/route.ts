import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { listPetSpecies } from "@/server/services/student-pet.service"
import { jsonError, jsonOk } from "@/server/utils/api"

export async function GET(_request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    return jsonOk({ items: await listPetSpecies(teacher.teacherProfileId, classroomId) })
  } catch (error) {
    return jsonError(error)
  }
}
