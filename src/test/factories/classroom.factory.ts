import { prisma } from "@/server/db/prisma"
import { createTeacher } from "./user.factory"

let seq = 0

function nextInviteCode() {
  seq += 1
  return `T${seq.toString().padStart(5, "0")}`
}

export async function createTeacherWithClassroomAndStudent(
  input: {
    teacher?: { name?: string; email?: string }
    classroom?: { name?: string; grade?: string }
    student?: { name?: string; totalPoints?: number }
    withGroup?: boolean
  } = {},
) {
  const { user: teacherUser, teacherProfile } = await createTeacher(input.teacher)

  const classroom = await prisma.classroom.create({
    data: {
      teacherId: teacherProfile.id,
      name: input.classroom?.name ?? "三年级2班",
      grade: input.classroom?.grade ?? "3",
      schoolName: "测试小学",
      inviteCode: nextInviteCode(),
    },
  })

  const group = input.withGroup
    ? await prisma.group.create({
        data: {
          classroomId: classroom.id,
          name: "第一组",
        },
      })
    : null

  const student = await prisma.student.create({
    data: {
      classroomId: classroom.id,
      groupId: group?.id,
      name: input.student?.name ?? "小明",
      totalPoints: input.student?.totalPoints ?? 0,
    },
  })

  return { teacherUser, teacher: teacherProfile, classroom, group, student }
}
