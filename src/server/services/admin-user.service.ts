import { Prisma, UserRole } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/server/db/prisma"
import { writeAuditLogInTx } from "@/server/services/audit-log.service"
import { AppError } from "@/server/utils/errors"

export const USER_STATUSES = ["ACTIVE", "SUSPENDED"] as const
export type UserStatus = (typeof USER_STATUSES)[number]

const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.nativeEnum(UserRole).optional(),
  status: z.enum(USER_STATUSES).optional(),
  keyword: z.string().trim().min(1).max(100).optional(),
})

const updateUserSchema = z.object({
  status: z.enum(USER_STATUSES),
})

/** Projection used by every mutation response so no path leaks extra fields. */
const USER_SUMMARY_SELECT = {
  id: true,
  role: true,
  name: true,
  email: true,
  status: true,
} as const

export async function listUsers(input: unknown) {
  const parsed = listUsersSchema.parse(input)
  const where: Prisma.UserWhereInput = {
    role: parsed.role,
    status: parsed.status,
    name: parsed.keyword ? { contains: parsed.keyword, mode: "insensitive" } : undefined,
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (parsed.page - 1) * parsed.limit,
      take: parsed.limit,
    }),
  ])

  return {
    items: users.map((user) => ({
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
    })),
    meta: { total, page: parsed.page, limit: parsed.limit },
  }
}

/**
 * Admin status mutation. Suspension and reactivation bump sessionVersion so any
 * cookie issued before the change stops authenticating immediately.
 */
export async function updateUserStatus(actorUserId: string, userId: string, input: unknown) {
  const parsed = updateUserSchema.parse(input)
  if (actorUserId === userId) {
    throw new AppError("CONFLICT", "Cannot change your own account status", 409)
  }

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: userId }, select: { id: true, status: true, role: true } })
    if (!target) throw new AppError("NOT_FOUND", "User not found", 404)
    if (target.status === parsed.status) {
      return tx.user.findUniqueOrThrow({ where: { id: userId }, select: USER_SUMMARY_SELECT })
    }

    // Suspending the last active admin would leave the system unadministrable.
    if (parsed.status === "SUSPENDED" && target.role === UserRole.ADMIN) {
      const remainingAdmins = await tx.user.count({ where: { role: UserRole.ADMIN, status: "ACTIVE", id: { not: userId } } })
      if (remainingAdmins === 0) throw new AppError("CONFLICT", "Cannot suspend the last active admin", 409)
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: { status: parsed.status, sessionVersion: { increment: 1 } },
      select: USER_SUMMARY_SELECT,
    })

    await writeAuditLogInTx(tx, {
      actorUserId,
      action: parsed.status === "SUSPENDED" ? "USER_SUSPENDED" : "USER_REACTIVATED",
      entityType: "User",
      entityId: userId,
      metadata: { previousStatus: target.status, status: parsed.status, role: target.role },
    })

    return updated
  })
}
