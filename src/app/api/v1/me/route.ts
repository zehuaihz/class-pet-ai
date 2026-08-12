import { getCurrentUser } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { jsonError, jsonOk } from "@/server/utils/api"
import { AppError } from "@/server/utils/errors"

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) throw new AppError("UNAUTHORIZED", "Login required")

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      include: { teacherProfile: true },
    })

    if (!user) throw new AppError("UNAUTHORIZED", "Login required")

    return jsonOk({
      id: user.id,
      role: user.role,
      name: user.name,
      avatarUrl: user.avatarUrl,
      teacherProfile: user.teacherProfile
        ? { id: user.teacherProfile.id, schoolName: user.teacherProfile.schoolName }
        : null,
    })
  } catch (error) {
    return jsonError(error)
  }
}
