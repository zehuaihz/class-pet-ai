import { UserRole } from "@prisma/client"
import { prisma } from "@/server/db/prisma"

let seq = 0

function nextEmail(prefix = "teacher") {
  seq += 1
  return `${prefix}-${seq}@test.com`
}

export async function createTeacher(input: { name?: string; email?: string; schoolName?: string } = {}) {
  const user = await prisma.user.create({
    data: {
      role: UserRole.TEACHER,
      name: input.name ?? "张老师",
      email: input.email ?? nextEmail(),
    },
  })

  const teacherProfile = await prisma.teacherProfile.create({
    data: {
      userId: user.id,
      schoolName: input.schoolName ?? "测试小学",
    },
  })

  return { user, teacherProfile }
}
