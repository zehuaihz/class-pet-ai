import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { jsonError, jsonOk } from "@/server/utils/api"
import { rejectCheckinRecord } from "@/server/services/checkin-record.service"

export async function PATCH(_request: NextRequest, context: { params: Promise<{ recordId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { recordId } = await context.params
    return jsonOk(await rejectCheckinRecord(teacher.teacherProfileId, recordId))
  } catch (error) {
    return jsonError(error)
  }
}
