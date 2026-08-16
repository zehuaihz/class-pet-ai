import { NextRequest } from "next/server"
import { UserRole } from "@prisma/client"
import { z } from "zod"
import { requireAdmin } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { setUserPassword } from "@/server/services/auth.service"
import { jsonError, jsonOk } from "@/server/utils/api"
import { AppError } from "@/server/utils/errors"

const MANAGED_ROLES = [UserRole.ADMIN, UserRole.TEACHER] as const

const updateUserSchema = z.object({
  name: z.string().trim().min(1).optional(),
  role: z.enum(MANAGED_ROLES).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  password: z.string().min(8).optional(),
})

export async function PATCH(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  try {
    const admin = await requireAdmin()
    const { userId } = await context.params
    const body = updateUserSchema.parse(await request.json())

    // 自我保护：不能禁用自己，也不能把自己降级出系统管理员，否则系统会锁死。
    if (userId === admin.id) {
      if (body.status === "INACTIVE") throw new AppError("VALIDATION_ERROR", "不能禁用当前登录的系统管理员", 422)
      if (body.role && body.role !== UserRole.ADMIN) throw new AppError("VALIDATION_ERROR", "不能降级当前登录的系统管理员", 422)
    }

    const existing = await prisma.user.findUnique({ where: { id: userId } })
    if (!existing) throw new AppError("NOT_FOUND", "用户不存在", 404)

    const data: Record<string, unknown> = {}
    if (body.name) data.name = body.name.trim()
    if (body.role) data.role = body.role
    if (body.status) data.status = body.status
    // 角色/状态/密码变更使该用户现有会话立即失效（getCurrentUser 校验 sessionVersion）。
    if (body.role || body.status || body.password) data.sessionVersion = { increment: 1 }

    if (body.password) {
      await setUserPassword(userId, body.password)
    }

    const updated = await prisma.user.update({ where: { id: userId }, data })
    return jsonOk({ id: updated.id, role: updated.role, name: updated.name, email: updated.email, status: updated.status })
  } catch (error) {
    return jsonError(error)
  }
}
