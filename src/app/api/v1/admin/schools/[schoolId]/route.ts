import { NextRequest } from "next/server"
import { requireAdmin } from "@/server/auth/session"
import { jsonError, jsonOk } from "@/server/utils/api"
import { AppError } from "@/server/utils/errors"
import { updateSchool } from "@/server/services/admin-platform.service"

export async function PATCH(request: NextRequest, context: { params: Promise<{ schoolId: string }> }) {
  try {
    await requireAdmin()
    const { schoolId } = await context.params
    const body = await request.json()
    if (!body || typeof body !== "object") {
      throw new AppError("VALIDATION_ERROR", "请求体不能为空", 422)
    }
    const school = await updateSchool(schoolId, body)
    return jsonOk(school)
  } catch (error) {
    return jsonError(error)
  }
}
