import { NextRequest } from "next/server"
import { z } from "zod"
import { requireUser } from "@/server/auth/session"
import { setUserPassword } from "@/server/services/auth.service"
import { verifyPassword } from "@/server/auth/password"
import { prisma } from "@/server/db/prisma"
import { jsonError, jsonOk } from "@/server/utils/api"
import { AppError } from "@/server/utils/errors"

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const { currentPassword, newPassword } = changePasswordSchema.parse(await request.json())

    const credentials = await prisma.passwordCredential.findMany({ where: { userId: user.id } })
    const matched = credentials.find((credential) => verifyPassword(currentPassword, credential))
    if (!matched) throw new AppError("UNAUTHORIZED", "Invalid current password", 401)

    await setUserPassword(user.id, newPassword)
    await prisma.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } })
    return jsonOk({ updated: true })
  } catch (error) {
    return jsonError(error)
  }
}
