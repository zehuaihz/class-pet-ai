import { NextResponse, type NextRequest } from "next/server"
import { checkRateLimit } from "@/server/security/rate-limit.service"

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (path === "/api/v1/auth/login" && request.method === "POST") {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const result = checkRateLimit(`login:${ip}`, 5, 15 * 60_000)
    if (!result.allowed) {
      return NextResponse.json({ success: false, error: { code: "RATE_LIMIT", message: "Too many login attempts" } }, { status: 429 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/api/v1/auth/login"],
}
