import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/server/auth/session"
import { listUsers } from "@/server/services/admin-user.service"
import { jsonError } from "@/server/utils/api"
import { ok } from "@/server/utils/response-envelope"

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(request.url)
    const result = await listUsers({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      role: searchParams.get("role") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      keyword: searchParams.get("keyword") ?? undefined,
    })
    return NextResponse.json(ok({ items: result.items }, result.meta))
  } catch (error) {
    return jsonError(error)
  }
}
