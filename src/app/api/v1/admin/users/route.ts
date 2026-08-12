import { requireAdmin } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { jsonError, jsonOk } from "@/server/utils/api"

export async function GET() {
  try {
    await requireAdmin()
    const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 100 })
    return jsonOk({
      items: users.map((user) => ({ id: user.id, role: user.role, name: user.name, email: user.email, status: user.status })),
    })
  } catch (error) {
    return jsonError(error)
  }
}
