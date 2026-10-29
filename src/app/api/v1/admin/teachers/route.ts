import { NextRequest } from "next/server"
import { requireAdmin } from "@/server/auth/session"
import { jsonError, jsonOk } from "@/server/utils/api"
import { AppError } from "@/server/utils/errors"
import { createTeacherAccount } from "@/server/services/admin-platform.service"

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await request.json()
    if (!body || typeof body !== "object") {
      throw new AppError("VALIDATION_ERROR", "请求体不能为空", 422)
    }
    const teacher = await createTeacherAccount(admin.id, body)
    return jsonOk(teacher, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
