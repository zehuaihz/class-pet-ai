import { PetStatus, PrismaClient, UserRole } from "@prisma/client"
import { hashPassword } from "../../src/server/auth/password"
import {
  E2E_CLASSROOM_NAME,
  E2E_CREDENTIALS,
  E2E_REWARD_NAME,
  E2E_TASK_TITLE,
} from "./env"

// 学生用于兑换的徽章数：并发兑换 3 次 × costBadges 10，留足余量。
const E2E_BADGE_COUNT = 30

/**
 * Self-contained seed for the authenticated E2E suite. It resets only the rows
 * it owns, so the suite is repeatable without wiping the whole test database.
 */
export async function seedE2E(prisma: PrismaClient, teacherEmail: string) {
  const teacher = await prisma.user.upsert({
    where: { email: teacherEmail },
    update: { name: "E2E 教师" },
    create: { email: teacherEmail, name: "E2E 教师", role: UserRole.TEACHER },
  })

  const teacherProfile =
    (await prisma.teacherProfile.findUnique({ where: { userId: teacher.id } })) ??
    (await prisma.teacherProfile.create({ data: { userId: teacher.id, schoolName: "E2E 小学" } }))

  await prisma.classroom.deleteMany({ where: { teacherId: teacherProfile.id, name: E2E_CLASSROOM_NAME } })

  const classroom = await prisma.classroom.create({
    data: {
      teacherId: teacherProfile.id,
      name: E2E_CLASSROOM_NAME,
      grade: "三年级",
      inviteCode: `E2E${Date.now().toString(36).toUpperCase().slice(-5)}`,
    },
  })

  const student = await prisma.student.create({
    data: { classroomId: classroom.id, name: "E2E 学生", studentNo: "E2E001", totalPoints: 100 },
  })

  // zoo 体系：学生一只成长宠物 + 若干毕业徽章用于奖励兑换。
  const species = await prisma.petSpecies.upsert({
    where: { key: "cat-orange" },
    update: {},
    create: {
      key: "cat-orange",
      name: "橘猫",
      category: "cat",
      visualSlots: { "1": "cat-orange-lv1", "2": "cat-orange-lv2", "3": "cat-orange-lv3", "4": "cat-orange-lv4" },
      sortOrder: 0,
    },
  })
  await prisma.studentPet.create({
    data: {
      studentId: student.id,
      speciesKey: species.key,
      name: "E2E 橘猫",
      level: 1,
      growthValue: 0,
      status: PetStatus.GROWING,
      adoptionSeq: 1,
    },
  })
  for (let index = 0; index < E2E_BADGE_COUNT; index += 1) {
    const graduated = await prisma.studentPet.create({
      data: {
        studentId: student.id,
        speciesKey: species.key,
        name: `E2E 毕业宠${index + 1}`,
        level: 4,
        growthValue: 60,
        status: PetStatus.GRADUATED,
        graduatedAt: new Date(),
        adoptionSeq: index + 2,
      },
    })
    await prisma.badge.create({
      data: {
        studentId: student.id,
        studentPetId: graduated.id,
        name: "E2E 毕业徽章",
        visualKey: "badge-default",
      },
    })
  }

  const [, studentUser, parentUser, , suspendedUser] = await Promise.all([
    prisma.pointRule.create({
      data: { classroomId: classroom.id, name: "课堂表现", pointDelta: 1, enabled: true },
    }),
    createCredentialUser(prisma, {
      identifier: E2E_CREDENTIALS.student.identifier,
      password: E2E_CREDENTIALS.student.password,
      role: UserRole.STUDENT,
      name: "E2E 学生",
    }),
    createCredentialUser(prisma, {
      identifier: E2E_CREDENTIALS.parent.identifier,
      password: E2E_CREDENTIALS.parent.password,
      role: UserRole.PARENT,
      name: "E2E 家长",
    }),
    createCredentialUser(prisma, {
      identifier: E2E_CREDENTIALS.admin.identifier,
      password: E2E_CREDENTIALS.admin.password,
      role: UserRole.ADMIN,
      name: "E2E 管理员",
    }),
    createCredentialUser(prisma, {
      identifier: E2E_CREDENTIALS.suspended.identifier,
      password: E2E_CREDENTIALS.suspended.password,
      role: UserRole.PARENT,
      name: "E2E 停用家长",
    }),
  ])

  await prisma.student.update({ where: { id: student.id }, data: { userId: studentUser.id } })
  void suspendedUser

  await prisma.parentStudent.upsert({
    where: { parentId_studentId: { parentId: parentUser.id, studentId: student.id } },
    update: {},
    create: { parentId: parentUser.id, studentId: student.id },
  })

  const task = await prisma.checkinTask.create({
    data: {
      classroomId: classroom.id,
      createdByTeacherId: teacherProfile.id,
      title: E2E_TASK_TITLE,
      description: "E2E 自动化任务",
      rewardPoints: 5,
      requireEvidence: true,
      status: "ACTIVE",
    },
  })

  const reward = await prisma.rewardItem.create({
    data: {
      classroomId: classroom.id,
      name: E2E_REWARD_NAME,
      description: "E2E 自动化奖励",
      costBadges: 10,
      stock: 2,
      enabled: true,
    },
  })

  return { classroom, student, task, reward, teacherProfile }
}

async function createCredentialUser(
  prisma: PrismaClient,
  input: { identifier: string; password: string; role: UserRole; name: string },
) {
  const existing = await prisma.user.findFirst({ where: { email: input.identifier } })
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { status: "ACTIVE", name: input.name, role: input.role },
      })
    : await prisma.user.create({
        data: { email: input.identifier, name: input.name, role: input.role, status: "ACTIVE" },
      })

  await prisma.passwordCredential.deleteMany({ where: { userId: user.id } })
  await prisma.passwordCredential.create({ data: { userId: user.id, ...hashPassword(input.password) } })
  return user
}
