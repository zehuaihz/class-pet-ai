import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { AppError } from "@/server/utils/errors"

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/** Export the full classroom behavior ledger as CSV. */
export async function exportClassroomAudit(actorTeacherId: string, classroomId: string): Promise<string> {
  await assertTeacherOwnsClassroom(actorTeacherId, classroomId)

  const transactions = await prisma.pointTransaction.findMany({
    where: { classroomId },
    orderBy: { createdAt: "asc" },
    include: { student: { select: { name: true } }, group: { select: { name: true } } },
  })

  const header = ["时间", "学生/小组", "操作事项", "变动积分", "来源", "撤销"]
  const rows = transactions.map((tx) => [
    tx.createdAt.toISOString(),
    tx.student?.name ?? tx.group?.name ?? "-",
    tx.reason,
    String(tx.delta),
    tx.source,
    tx.reversalOfId ? "是" : "",
  ])

  return [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n")
}

/**
 * Delete behavior log entries older than a retention date. Growth logs cascade
 * with their transactions. Current balances and pet growth are left untouched.
 */
export async function cleanupClassroomAudit(actorTeacherId: string, classroomId: string, before: Date) {
  await assertTeacherOwnsClassroom(actorTeacherId, classroomId)
  if (!(before instanceof Date) || Number.isNaN(before.getTime())) {
    throw new AppError("VALIDATION_ERROR", "before date required", 422)
  }

  const { count } = await prisma.pointTransaction.deleteMany({
    where: { classroomId, createdAt: { lt: before } },
  })
  return { deleted: count, before: before.toISOString() }
}
