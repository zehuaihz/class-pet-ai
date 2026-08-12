import { NextResponse } from "next/server"
import { clearSessionCookie } from "@/server/auth/session"
import { ok } from "@/server/utils/response-envelope"

export async function POST() {
  return NextResponse.json(ok({ loggedOut: true }), {
    headers: { "Set-Cookie": clearSessionCookie() },
  })
}
