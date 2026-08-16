import { NextRequest } from "next/server"
import { Prisma, UserRole } from "@prisma/client"
import { z } from "zod"
import { requireAdmin } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { provisionAccount } from "@/server/services/auth.service"
import { jsonError, jsonOk } from "@/server/utils/api"
import { AppError } from "@/server/utils/errors"

const MANAGED_ROLES = [UserRole.ADMIN, UserRole.TEACHER] as const

const createUserSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8),
  role: z.enum(MANAGED_ROLES),
})

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

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const body = createUserSchema.parse(await request.json())
    try {
      const user = await provisionAccount({ role: body.role, name: body.name, email: body.email, password: body.password })
      return jsonOk({ id: user.id, role: user.role, name: user.name, email: user.email, status: user.status })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError("CONFLICT", "账号已存在", 409)
      }
      throw error
    }
  } catch (error) {
    return jsonError(error)
  }
}
