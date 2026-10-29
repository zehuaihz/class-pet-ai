import { NextRequest } from "next/server"
import { requireAdmin } from "@/server/auth/session"
import { jsonError, jsonOk } from "@/server/utils/api"
import { AppError } from "@/server/utils/errors"
import { createSchool, listSchools } from "@/server/services/admin-platform.service"

export async function GET() {
  try {
    await requireAdmin()
    const schools = await listSchools({})
    return jsonOk({ items: schools })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const body = await request.json()
    if (!body || typeof body !== "object") {
      throw new AppError("VALIDATION_ERROR", "请求体不能为空", 422)
    }
    const school = await createSchool(body)
    return jsonOk(school, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
