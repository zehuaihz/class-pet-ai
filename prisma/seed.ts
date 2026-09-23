import { UserRole } from "@prisma/client"
import { prisma } from "../src/server/db/prisma"

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "teacher@example.com" },
    update: {},
    create: {
      email: "teacher@example.com",
      name: "张老师",
      role: UserRole.TEACHER,
    },
  })

  const teacher = await prisma.teacherProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      schoolName: "测试小学",
    },
  })

  const classroom = await prisma.classroom.upsert({
    where: { inviteCode: "DEMO01" },
    update: {},
    create: {
      teacherId: teacher.id,
      name: "三年级2班",
      grade: "3",
      schoolName: "测试小学",
      inviteCode: "DEMO01",
    },
  })

  await prisma.pet.upsert({
    where: { classroomId: classroom.id },
    update: {},
    create: {
      classroomId: classroom.id,
      name: "云朵龙",
      species: "dragon",
    },
  })

  await prisma.student.createMany({
    data: ["小明", "小红", "小刚", "小丽"].map((name, index) => ({
      classroomId: classroom.id,
      name,
      studentNo: `${index + 1}`.padStart(3, "0"),
      totalPoints: 0,
    })),
    skipDuplicates: true,
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
