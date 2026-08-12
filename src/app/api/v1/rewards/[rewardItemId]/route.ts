import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { updateRewardItem, deleteRewardItem } from "@/server/services/reward.service"
import { jsonError, jsonOk } from "@/server/utils/api"

export async function PATCH(request: NextRequest, context: { params: Promise<{ rewardItemId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { rewardItemId } = await context.params
    return jsonOk(await updateRewardItem(teacher.teacherProfileId, rewardItemId, await request.json()))
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ rewardItemId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { rewardItemId } = await context.params
    return jsonOk(await deleteRewardItem(teacher.teacherProfileId, rewardItemId))
  } catch (error) {
    return jsonError(error)
  }
}
