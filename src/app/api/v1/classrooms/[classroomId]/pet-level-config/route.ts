import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { getLevelConfig, saveLevelConfig } from "@/server/services/pet-level-config.service"
import { jsonError, jsonOk } from "@/server/utils/api"

export async function GET(_request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    return jsonOk({ items: await getLevelConfig(teacher.teacherProfileId, classroomId) })
  } catch (error) {
    return jsonError(error)
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    const body = await request.json()
    return jsonOk({ items: await saveLevelConfig(teacher.teacherProfileId, classroomId, body) })
  } catch (error) {
    return jsonError(error)
  }
}
