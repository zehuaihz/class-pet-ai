import { prisma } from "@/server/db/prisma"
import { createTeacher } from "../factories/user.factory"

export async function seedClassroomForTeacher(input: {
  teacher: { email: string; password?: string; name: string }
  classroom: { name: string }
  students?: Array<{ name: string; totalPoints?: number }>
  pointTransactions?: Array<{ studentName: string; delta: number; reason: string }>
}) {
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

  const pet = await prisma.pet.create({
    data: {
      classroomId: classroom.id,
      name: "云朵龙",
      species: "dragon",
    },
  })

  const students = await Promise.all(
    (input.students ?? []).map((student) =>
      prisma.student.create({
        data: {
          classroomId: classroom.id,
          name: student.name,
          totalPoints: student.totalPoints ?? 0,
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

  return {
    teacherUser,
    teacher: teacherProfile,
    classroom,
    pet,
    students,
  }
}
