import { NextRequest } from "next/server"
import { requireAdmin } from "@/server/auth/session"
import { updateUserStatus } from "@/server/services/admin-user.service"
import { jsonError, jsonOk } from "@/server/utils/api"

export async function PATCH(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  try {
    const admin = await requireAdmin()
    const { userId } = await context.params
    return jsonOk(await updateUserStatus(admin.id, userId, await request.json()))
  } catch (error) {
    return jsonError(error)
  }
}
