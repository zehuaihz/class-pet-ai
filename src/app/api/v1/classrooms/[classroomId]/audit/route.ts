import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { cleanupClassroomAudit } from "@/server/services/audit-export.service"
import { jsonError, jsonOk } from "@/server/utils/api"
import { AppError } from "@/server/utils/errors"

export async function DELETE(request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    const body = await request.json()
    const before = new Date(String(body.before ?? ""))
    if (Number.isNaN(before.getTime())) {
      throw new AppError("VALIDATION_ERROR", "before date required", 422)
    }
    return jsonOk(await cleanupClassroomAudit(teacher.teacherProfileId, classroomId, before))
  } catch (error) {
    return jsonError(error)
  }
}
