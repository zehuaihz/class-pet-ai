import { NextResponse, type NextRequest } from "next/server"
import { checkRateLimit } from "@/server/security/rate-limit.service"

const DEFAULT_LOGIN_RATE_LIMIT = 5
const MAX_LOGIN_RATE_LIMIT = 1_000
const LOGIN_RATE_WINDOW_MS = 15 * 60_000

/**
 * Fails closed: an unset, non-numeric, or absurd `LOGIN_RATE_LIMIT_MAX` falls
 * back to the production default instead of disabling the throttle. The
 * authenticated E2E suites raise it only for the server they spawn.
 */
function loginRateLimit(): number {
  const parsed = Number.parseInt(process.env.LOGIN_RATE_LIMIT_MAX ?? "", 10)
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LOGIN_RATE_LIMIT
  return Math.min(parsed, MAX_LOGIN_RATE_LIMIT)
}

/**
 * `X-Forwarded-For` is client-controlled unless a trusted proxy overwrites it,
 * so the leftmost entry cannot be trusted. Prefer a platform-provided header
 * and otherwise take the rightmost hop (the one the closest proxy appended).
 */
function clientIp(request: NextRequest): string {
  const platformIp = request.headers.get("x-real-ip")?.trim()
  if (platformIp) return platformIp

  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const hops = forwarded.split(",").map((hop) => hop.trim()).filter(Boolean)
    if (hops.length > 0) return hops[hops.length - 1]
  }

  return "unknown"
}

function tooManyAttempts() {
  return NextResponse.json(
    { success: false, error: { code: "RATE_LIMIT", message: "Too many login attempts" } },
    { status: 429 },
  )
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  if (path !== "/api/v1/auth/login" || request.method !== "POST") return NextResponse.next()

  const limit = loginRateLimit()
  const ipResult = checkRateLimit(`login:ip:${clientIp(request)}`, limit, LOGIN_RATE_WINDOW_MS)
  if (!ipResult.allowed) return tooManyAttempts()

  // A per-account bucket keeps IP rotation from granting unlimited guesses
  // against a single account. The identifier is hashed so the in-memory key
  // never holds a raw email or phone number.
  const identifier = await readIdentifier(request)
  if (identifier) {
    const identifierResult = checkRateLimit(`login:id:${identifier}`, limit, LOGIN_RATE_WINDOW_MS)
    if (!identifierResult.allowed) return tooManyAttempts()
  }

  return NextResponse.next()
}

async function readIdentifier(request: NextRequest): Promise<string | null> {
  try {
    const body = (await request.clone().json()) as { identifier?: unknown }
    const identifier = typeof body?.identifier === "string" ? body.identifier.trim().toLowerCase() : ""
    if (!identifier) return null
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identifier))
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  } catch {
    return null
  }
}

export const config = {
  matcher: ["/api/v1/auth/login"],
}
