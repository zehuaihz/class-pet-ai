import { AiJobStatus, AiJobType, Prisma, UserRole } from "@prisma/client"
import { prisma } from "@/server/db/prisma"
import { createTeacher } from "../factories/user.factory"
import { hashPassword } from "@/server/auth/password"

export interface SeedClassroomInput {
  teacher: { email: string; password?: string; name: string }
  classroom: { name: string }
  students?: Array<{ name: string; totalPoints?: number; status?: string; groupName?: string }>
  groups?: Array<{ name: string; totalPoints?: number }>
  pointRules?: Array<{ name: string; pointDelta: number; enabled?: boolean }>
  pointTransactions?: Array<{ studentName: string; delta: number; reason: string }>
  rewardItems?: Array<{ name: string; costPoints: number; stock?: number | null; enabled?: boolean }>
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

  const pet =
    input.withPet === false
      ? null
      : await prisma.pet.create({
          data: {
            classroomId: classroom.id,
            name: "云朵龙",
            species: "dragon",
          },
        })

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
          costPoints: item.costPoints,
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
    pet,
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
