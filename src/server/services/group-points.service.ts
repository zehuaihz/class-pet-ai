import type { Prisma } from "@prisma/client"
import { prisma } from "@/server/db/prisma"

export interface GroupPointTotal {
  groupId: string
  /** Sum of the active members' own point balances. */
  memberPoints: number
  /** Sum of the transactions granted directly to the group. */
  groupBonusPoints: number
  /** What the UI shows as 小组总积分. */
  totalPoints: number
}

type GroupTotalsClient = Pick<Prisma.TransactionClient, "group" | "student" | "pointTransaction">

/**
 * Single definition of "小组总积分" used by every caller (rankings, groups list):
 * the active members' balances plus any points granted directly to the group.
 * Group.totalPoints remains the group-level ledger accumulator only — reading it
 * as the team total is what made rankings disagree with the member scores.
 */
export async function getGroupPointTotals(
  classroomId: string,
  client: GroupTotalsClient = prisma,
): Promise<GroupPointTotal[]> {
  const [groups, memberSums, bonusSums] = await Promise.all([
    client.group.findMany({ where: { classroomId }, select: { id: true } }),
    client.student.groupBy({
      by: ["groupId"],
      where: { classroomId, status: "ACTIVE", groupId: { not: null } },
      _sum: { totalPoints: true },
    }),
    client.pointTransaction.groupBy({
      by: ["groupId"],
      where: { classroomId, groupId: { not: null } },
      _sum: { delta: true },
    }),
  ])

  const memberByGroup = new Map(memberSums.map((row) => [row.groupId, row._sum.totalPoints ?? 0]))
  const bonusByGroup = new Map(bonusSums.map((row) => [row.groupId, row._sum.delta ?? 0]))

  return groups.map((group) => {
    const memberPoints = memberByGroup.get(group.id) ?? 0
    const groupBonusPoints = bonusByGroup.get(group.id) ?? 0
    return { groupId: group.id, memberPoints, groupBonusPoints, totalPoints: memberPoints + groupBonusPoints }
  })
}
