import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { jsonError, jsonOk } from "@/server/utils/api"
import { createCheckinTask, listCheckinTasks } from "@/server/services/checkin-task.service"

export async function GET(request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    const status = new URL(request.url).searchParams.get("status")
    const tasks = await listCheckinTasks(teacher.teacherProfileId, classroomId, status as never)
    return jsonOk({ items: tasks })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    const body = await request.json()
    const task = await createCheckinTask({ ...body, actorTeacherId: teacher.teacherProfileId, classroomId })
    return jsonOk(task)
  } catch (error) {
    return jsonError(error)
  }
}
