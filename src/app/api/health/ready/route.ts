import { NextResponse } from "next/server"
import { prisma } from "@/server/db/prisma"

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: "ready", checks: { database: "ok" } })
  } catch (error) {
    return NextResponse.json(
      { status: "unavailable", checks: { database: "fail", error: error instanceof Error ? error.message : "unknown" } },
      { status: 503 },
    )
  }
}
