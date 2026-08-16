import { NextRequest, NextResponse } from "next/server"
import { authenticateAccount, authenticateWithCredentials } from "@/server/services/auth.service"
import { createSessionToken, setSessionCookie } from "@/server/auth/session"
import { AppError } from "@/server/utils/errors"
import { jsonError } from "@/server/utils/api"
import { ok } from "@/server/utils/response-envelope"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const user = body?.role ? await authenticateWithCredentials(body) : await authenticateAccount(body)
    // 统一在设置 cookie 前校验账号状态，堵住禁用账号经 env 兜底"半登录"。
    if (user.status !== "ACTIVE") throw new AppError("UNAUTHORIZED", "账号已禁用")
    const token = createSessionToken(user.id, user.sessionVersion ?? 0)

    return NextResponse.json(
      ok({
        user: { id: user.id, role: user.role, name: user.name },
        session: { expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
      }),
      { headers: { "Set-Cookie": setSessionCookie(token) } },
    )
  } catch (error) {
    return jsonError(error)
  }
}
