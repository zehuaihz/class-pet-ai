import { prisma } from "@/server/db/prisma"
import { AppError } from "@/server/utils/errors"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"

export interface SaveStudentCommentInput {
  studentId: string
  content: string
  tone?: string
  teacherProfileId?: string
}

/** Persist a teacher-confirmed comment (final step of the AI draft workflow). */
export async function saveStudentComment(
  teacherProfileId: string,
  classroomId: string,
  input: SaveStudentCommentInput,
) {
  await assertTeacherOwnsClassroom(teacherProfileId, classroomId)

  const student = await prisma.student.findFirst({
    where: { id: input.studentId, classroomId },
    select: { id: true, name: true },
  })
  if (!student) {
    throw new AppError("NOT_FOUND", "学生不存在或不属于该班级", 404)
  }

  return prisma.studentComment.create({
    data: {
      classroomId,
      studentId: input.studentId,
      teacherProfileId,
      content: input.content,
      tone: input.tone ?? "鼓励",
    },
    include: { student: { select: { id: true, name: true, studentNo: true } } },
  })
}

/** List confirmed comments, newest first; optional student filter. */
export async function listStudentComments(
  teacherProfileId: string,
  classroomId: string,
  studentId?: string | null,
) {
  await assertTeacherOwnsClassroom(teacherProfileId, classroomId)

  return prisma.studentComment.findMany({
    where: { classroomId, ...(studentId ? { studentId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { student: { select: { id: true, name: true, studentNo: true } } },
  })
}
