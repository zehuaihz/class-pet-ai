import { BadgeStatus } from "@prisma/client"
import { requireStudent } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { jsonError, jsonOk } from "@/server/utils/api"

export async function GET() {
  try {
    const user = await requireStudent()
    const student = await prisma.student.findUnique({
      where: { id: user.studentId },
      select: {
        classroomId: true,
        totalPoints: true,
        badges: { where: { status: BadgeStatus.AVAILABLE }, select: { id: true } },
      },
    })
    if (!student) return jsonOk({ items: [], availableBadges: 0, redemptions: [] })

    const [items, redemptions] = await Promise.all([
      prisma.rewardItem.findMany({ where: { classroomId: student.classroomId, enabled: true }, orderBy: { costBadges: "asc" } }),
      prisma.rewardRedemption.findMany({
        where: { studentId: user.studentId },
        include: { rewardItem: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ])

    return jsonOk({
      items,
      availableBadges: student.badges.length,
      redemptions: redemptions.map((redemption) => ({
        id: redemption.id,
        badgesSpent: redemption.badgesSpent,
        status: redemption.status,
        createdAt: redemption.createdAt,
        rewardItem: redemption.rewardItem,
      })),
    })
  } catch (error) {
    return jsonError(error)
  }
}
