import { PrismaClient, UserRole } from "@prisma/client"

/**
 * The mocked specs address a fixed classroom id in their URLs, so the guarded
 * pages need a real classroom with that id owned by the logged-in teacher.
 * Only the browser-suite database is ever touched.
 */
export async function seedMockedSpecFixtures(prisma: PrismaClient, teacherEmail: string, classroomId: string) {
  const user = await prisma.user.upsert({
    where: { email: teacherEmail },
    update: { role: UserRole.TEACHER, status: "ACTIVE" },
    create: { email: teacherEmail, name: "E2E 教师", role: UserRole.TEACHER },
  })

  const teacherProfile =
    (await prisma.teacherProfile.findUnique({ where: { userId: user.id } })) ??
    (await prisma.teacherProfile.create({ data: { userId: user.id, schoolName: "E2E 小学" } }))

  await prisma.classroom.upsert({
    where: { id: classroomId },
    update: { teacherId: teacherProfile.id },
    create: {
      id: classroomId,
      teacherId: teacherProfile.id,
      name: "三年级2班",
      grade: "三年级",
      inviteCode: "MOCKED1",
    },
  })

  const pet = await prisma.pet.findUnique({ where: { classroomId } })
  if (!pet) {
    await prisma.pet.create({ data: { classroomId, name: "小宠", species: "cat", level: 1 } })
  }
}
