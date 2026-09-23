import { NextRequest, NextResponse } from "next/server"
import { authenticateTeacher, authenticateWithCredentials } from "@/server/services/auth.service"
import { createSessionToken, setSessionCookie } from "@/server/auth/session"
import { jsonError } from "@/server/utils/api"
import { ok } from "@/server/utils/response-envelope"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const user = body?.role ? await authenticateWithCredentials(body) : await authenticateTeacher(body)
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
