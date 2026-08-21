import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { jsonError, jsonOk } from "@/server/utils/api"

export async function GET(_request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    await assertTeacherOwnsClassroom(teacher.teacherProfileId, classroomId)

    const transactions = await prisma.pointTransaction.findMany({
      where: { classroomId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { student: true, group: true },
    })

    return jsonOk({
      items: transactions.map((transaction) => ({
        id: transaction.id,
        name: transaction.student?.name ?? transaction.group?.name ?? "未知",
        reason: transaction.reason,
        delta: transaction.delta,
        createdAt: transaction.createdAt.toISOString(),
        reversalOfId: transaction.reversalOfId,
      })),
    })
  } catch (error) {
    return jsonError(error)
  }
}
