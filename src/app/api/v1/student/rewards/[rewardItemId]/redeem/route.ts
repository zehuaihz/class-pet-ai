import { NextRequest } from "next/server"
import { requireStudent } from "@/server/auth/session"
import { requestRedemption } from "@/server/services/redemption.service"
import { jsonError, jsonOk } from "@/server/utils/api"
import { AppError } from "@/server/utils/errors"

export async function POST(request: NextRequest, context: { params: Promise<{ rewardItemId: string }> }) {
  try {
    const user = await requireStudent()
    const { rewardItemId } = await context.params
    const idempotencyKey = request.headers.get("Idempotency-Key")?.trim()
    if (idempotencyKey && (idempotencyKey.length < 8 || idempotencyKey.length > 255)) {
      throw new AppError("VALIDATION_ERROR", "Invalid Idempotency-Key", 422)
    }
    const redemption = await requestRedemption(user.studentId, rewardItemId, idempotencyKey)
    return jsonOk(redemption)
  } catch (error) {
    return jsonError(error)
  }
}
