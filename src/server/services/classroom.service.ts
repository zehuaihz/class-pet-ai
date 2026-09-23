import { prisma } from "@/server/db/prisma"
import { AppError } from "@/server/utils/errors"

export async function assertTeacherOwnsClassroom(teacherProfileId: string, classroomId: string) {
  const classroom = await prisma.classroom.findFirst({
    where: {
      id: classroomId,
      teacherId: teacherProfileId,
    },
  })

  if (!classroom) {
    throw new AppError("FORBIDDEN", "No permission for classroom")
  }

  return classroom
}

export async function assertGroupBelongsToClassroom(groupId: string, classroomId: string) {
  const group = await prisma.group.findFirst({
    where: { id: groupId, classroomId },
  })

  if (!group) {
    throw new AppError("FORBIDDEN", "No permission for group")
  }

  return group
}

export function createInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}
