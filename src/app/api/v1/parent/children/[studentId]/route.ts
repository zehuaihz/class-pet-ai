import { requireParent } from "@/server/auth/session"
import { getChildDetail } from "@/server/services/parent.service"
import { jsonError, jsonOk } from "@/server/utils/api"

export async function GET(_request: Request, context: { params: Promise<{ studentId: string }> }) {
  try {
    const user = await requireParent()
    const { studentId } = await context.params
    return jsonOk(await getChildDetail(user.childStudentIds, studentId))
  } catch (error) {
    return jsonError(error)
  }
}
