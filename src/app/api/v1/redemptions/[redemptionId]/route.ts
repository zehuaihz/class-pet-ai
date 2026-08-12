import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { approveRedemption, fulfillRedemption, cancelRedemption } from "@/server/services/redemption.service"
import { jsonError, jsonOk } from "@/server/utils/api"
import { AppError } from "@/server/utils/errors"

export async function PATCH(request: NextRequest, context: { params: Promise<{ redemptionId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { redemptionId } = await context.params
    const { action } = await request.json()
    if (action === "approve") return jsonOk(await approveRedemption(teacher.teacherProfileId, redemptionId))
    if (action === "fulfill") return jsonOk(await fulfillRedemption(teacher.teacherProfileId, redemptionId))
    if (action === "cancel") return jsonOk(await cancelRedemption(teacher.teacherProfileId, redemptionId))
    throw new AppError("VALIDATION_ERROR", "unknown action", 422)
  } catch (error) {
    return jsonError(error)
  }
}
