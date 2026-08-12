import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { sanitizeAiText } from "@/server/services/ai-job.service"
import { AppError } from "@/server/utils/errors"
import type { CommentContext } from "@/server/ai/ai-provider"

export async function buildCommentContext(actorTeacherId: string, classroomId: string, studentId: string, tone: string, notes: string): Promise<CommentContext> {
  await assertTeacherOwnsClassroom(actorTeacherId, classroomId)
  const student = await prisma.student.findFirst({ where: { id: studentId, classroomId, status: "ACTIVE" } })
  if (!student) throw new AppError("NOT_FOUND", "Student not found", 404)

  return {
    studentName: student.name,
    tone,
    notes: sanitizeAiText(notes),
    totalPoints: student.totalPoints,
    recentGrowth: 0,
  }
}
