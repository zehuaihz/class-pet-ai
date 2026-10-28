import { AiJobStatus, AiJobType, PetStatus, Prisma, UserRole } from "@prisma/client"
import { prisma } from "@/server/db/prisma"
import { createTeacher } from "../factories/user.factory"
import { hashPassword } from "@/server/auth/password"

/** 测试用宠物品种：StudentPet.speciesKey 外键依赖 PetSpecies 存在。 */
const TEST_SPECIES_KEY = "cat-orange"

async function ensureTestPetSpecies() {
  return prisma.petSpecies.upsert({
    where: { key: TEST_SPECIES_KEY },
    update: {},
    create: {
      key: TEST_SPECIES_KEY,
      name: "橘猫",
      category: "cat",
      visualSlots: { "1": `${TEST_SPECIES_KEY}-lv1`, "2": `${TEST_SPECIES_KEY}-lv2`, "3": `${TEST_SPECIES_KEY}-lv3`, "4": `${TEST_SPECIES_KEY}-lv4` },
      sortOrder: 0,
    },
  })
}

/**
 * 给学生发放 count 枚可用徽章。
 *
 * zoo 体系下每枚徽章必须对应一只已毕业的宠物（Badge.studentPetId 唯一），
 * 所以每枚徽章都会先创建一只 GRADUATED 宠物再挂徽章。
 */
export async function grantBadgesToStudent(studentId: string, count: number) {
  const species = await ensureTestPetSpecies()
  const badges = []
  for (let index = 0; index < count; index += 1) {
    const pet = await prisma.studentPet.create({
      data: {
        studentId,
        speciesKey: species.key,
        name: `毕业宠${index + 1}`,
        level: 4,
        growthValue: 60,
        status: PetStatus.GRADUATED,
        graduatedAt: new Date(),
        adoptionSeq: index + 1,
      },
    })
    badges.push(
      await prisma.badge.create({
        data: {
          studentId,
          studentPetId: pet.id,
          name: `${species.name}毕业徽章`,
          visualKey: "badge-default",
        },
      }),
    )
  }
  return badges
}

export interface SeedClassroomInput {
  teacher: { email: string; password?: string; name: string }
  classroom: { name: string }
  students?: Array<{ name: string; totalPoints?: number; status?: string; groupName?: string }>
  groups?: Array<{ name: string; totalPoints?: number }>
  pointRules?: Array<{ name: string; pointDelta: number; enabled?: boolean }>
  pointTransactions?: Array<{ studentName: string; delta: number; reason: string }>
  rewardItems?: Array<{ name: string; costBadges: number; stock?: number | null; enabled?: boolean }>
  checkinTasks?: Array<{ title: string; rewardPoints: number; requireEvidence?: boolean }>
  aiJobs?: Array<{
    type: AiJobType
    status?: AiJobStatus
    attemptCount?: number
    maxAttempts?: number
    claimToken?: string
    lockedAt?: Date
    availableAt?: Date
  }>
  passwordCredential?: { password: string }
  withPet?: boolean
}

export async function seedClassroomForTeacher(input: SeedClassroomInput) {
  const { user: teacherUser, teacherProfile } = await createTeacher({
    email: input.teacher.email,
    name: input.teacher.name,
  })

  const classroom = await prisma.classroom.create({
    data: {
      teacherId: teacherProfile.id,
      name: input.classroom.name,
      inviteCode: `E2E-${teacherProfile.id.slice(-6)}`,
    },
  })

  await ensureTestPetSpecies()

  const groups = await Promise.all(
    (input.groups ?? []).map((group) =>
      prisma.group.create({
        data: {
          classroomId: classroom.id,
          name: group.name,
          totalPoints: group.totalPoints ?? 0,
        },
      }),
    ),
  )

  const students = await Promise.all(
    (input.students ?? []).map((student) =>
      prisma.student.create({
        data: {
          classroomId: classroom.id,
          groupId: student.groupName ? groups.find((group) => group.name === student.groupName)?.id : undefined,
          name: student.name,
          status: student.status ?? "ACTIVE",
          totalPoints: student.totalPoints ?? 0,
        },
      }),
    ),
  )

  // zoo 体系：每位学生一只成长中的宠物（班级宠物已被 StudentPet 取代）。
  const studentPets =
    input.withPet === false
      ? []
      : await Promise.all(
          students.map((student) =>
            prisma.studentPet.create({
              data: {
                studentId: student.id,
                speciesKey: TEST_SPECIES_KEY,
                name: "橘猫",
                level: 1,
                growthValue: 0,
                status: PetStatus.GROWING,
                adoptionSeq: 1,
              },
            }),
          ),
        )

  if (input.passwordCredential) {
    const { passwordHash, passwordSalt } = hashPassword(input.passwordCredential.password)
    await prisma.passwordCredential.create({
      data: { userId: teacherUser.id, passwordHash, passwordSalt },
    })
  }

  const pointRules = await Promise.all(
    (input.pointRules ?? []).map((rule) =>
      prisma.pointRule.create({
        data: {
          classroomId: classroom.id,
          name: rule.name,
          pointDelta: rule.pointDelta,
          enabled: rule.enabled ?? true,
        },
      }),
    ),
  )

  for (const tx of input.pointTransactions ?? []) {
    const student = students.find((item) => item.name === tx.studentName)
    if (!student) continue

    await prisma.pointTransaction.create({
      data: {
        classroomId: classroom.id,
        teacherId: teacherProfile.id,
        studentId: student.id,
        delta: tx.delta,
        reason: tx.reason,
        source: "MANUAL",
      },
    })
  }

  const rewardItems = await Promise.all(
    (input.rewardItems ?? []).map((item) =>
      prisma.rewardItem.create({
        data: {
          classroomId: classroom.id,
          name: item.name,
          costBadges: item.costBadges,
          stock: item.stock === undefined ? null : item.stock,
          enabled: item.enabled ?? true,
        },
      }),
    ),
  )

  const checkinTasks = await Promise.all(
    (input.checkinTasks ?? []).map((task) =>
      prisma.checkinTask.create({
        data: {
          classroomId: classroom.id,
          createdByTeacherId: teacherProfile.id,
          title: task.title,
          rewardPoints: task.rewardPoints,
          requireEvidence: task.requireEvidence ?? false,
        },
      }),
    ),
  )

  const aiJobs = await Promise.all(
    (input.aiJobs ?? []).map((job) =>
      prisma.aiJob.create({
        data: {
          classroomId: classroom.id,
          teacherId: teacherProfile.id,
          type: job.type,
          inputJson: { seed: true } as Prisma.InputJsonValue,
          status: job.status ?? AiJobStatus.PENDING,
          attemptCount: job.attemptCount ?? 0,
          maxAttempts: job.maxAttempts ?? 5,
          claimToken: job.claimToken,
          lockedAt: job.lockedAt,
          availableAt: job.availableAt ?? new Date(),
        },
      }),
    ),
  )

  return {
    teacherUser,
    teacher: teacherProfile,
    classroom,
    studentPets,
    groups,
    students,
    pointRules,
    rewardItems,
    checkinTasks,
    aiJobs,
  }
}

/** Creates a PARENT user linked to a seeded student. */
export async function seedParentForStudent(input: { name?: string; email?: string; studentId: string }) {
  const parent = await prisma.user.create({
    data: {
      role: UserRole.PARENT,
      name: input.name ?? "家长",
      email: input.email ?? null,
    },
  })

  await prisma.parentStudent.create({
    data: { parentId: parent.id, studentId: input.studentId },
  })

  return parent
}
