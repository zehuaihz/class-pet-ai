import { NextRequest } from "next/server"
import { requireStudent } from "@/server/auth/session"
import { requestRedemption } from "@/server/services/redemption.service"
import { jsonError, jsonOk } from "@/server/utils/api"

export async function POST(request: NextRequest, context: { params: Promise<{ rewardItemId: string }> }) {
  try {
    const user = await requireStudent()
    const { rewardItemId } = await context.params
    const idempotencyKey = `redeem:${user.id}:${rewardItemId}`
    const redemption = await requestRedemption(user.studentId, rewardItemId, idempotencyKey)
    return jsonOk(redemption)
  } catch (error) {
    return jsonError(error)
  }
}
