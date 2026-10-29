import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/server/auth/session"
import { jsonError } from "@/server/utils/api"
import { ok } from "@/server/utils/response-envelope"
import { listPlatformClassrooms } from "@/server/services/admin-platform.service"

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(request.url)
    const result = await listPlatformClassrooms({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      keyword: searchParams.get("keyword") ?? undefined,
    })
    return NextResponse.json(ok({ items: result.items }, result.meta))
  } catch (error) {
    return jsonError(error)
  }
}
