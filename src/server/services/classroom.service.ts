import { UserRole } from "@prisma/client"
import { prisma } from "@/server/db/prisma"
import { AppError } from "@/server/utils/errors"

export async function assertTeacherOwnsClassroom(teacherProfileId: string, classroomId: string) {
  const profile = await prisma.teacherProfile.findUnique({
    where: { id: teacherProfileId },
    include: { user: { select: { role: true } } },
  })
  if (!profile) throw new AppError("FORBIDDEN", "No permission for classroom")

  const classroom = await prisma.classroom.findFirst({
    where: {
      id: classroomId,
      // 系统管理员可访问任意班级；班级管理员只能访问自己拥有的班级。
      ...(profile.user.role === UserRole.ADMIN ? {} : { teacherId: teacherProfileId }),
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
