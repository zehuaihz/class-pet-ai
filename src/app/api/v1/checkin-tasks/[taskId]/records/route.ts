import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { jsonError, jsonOk } from "@/server/utils/api"
import { approveCheckinRecord, rejectCheckinRecord, submitCheckinRecord } from "@/server/services/checkin-record.service"

export async function POST(request: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { taskId } = await context.params
    const body = await request.json()
    const record = await submitCheckinRecord({ ...body, actorTeacherId: teacher.teacherProfileId, taskId })
    return jsonOk(record)
  } catch (error) {
    return jsonError(error)
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  const teacher = await requireTeacher()
  const { taskId } = await context.params
  const body = await request.json()
  if (body.action === "approve") {
    return jsonOk(await approveCheckinRecord(teacher.teacherProfileId, body.recordId ?? taskId))
  }
  return jsonOk(await rejectCheckinRecord(teacher.teacherProfileId, body.recordId ?? taskId))
}
