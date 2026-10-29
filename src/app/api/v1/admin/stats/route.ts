import { requireAdmin } from "@/server/auth/session"
import { jsonError, jsonOk } from "@/server/utils/api"
import { getPlatformStats } from "@/server/services/admin-platform.service"

export async function GET() {
  try {
    await requireAdmin()
    const stats = await getPlatformStats()
    return jsonOk(stats)
  } catch (error) {
    return jsonError(error)
  }
}
