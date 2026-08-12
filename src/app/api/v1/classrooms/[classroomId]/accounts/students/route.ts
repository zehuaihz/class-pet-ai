import { NextRequest } from "next/server"
import { z } from "zod"
import { UserRole } from "@prisma/client"
import { requireTeacher } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { provisionAccount } from "@/server/services/auth.service"
import { jsonError, jsonOk } from "@/server/utils/api"

const provisionSchema = z.object({
  studentId: z.string().min(1),
  identifier: z.string().trim().min(1),
  password: z.string().min(8),
  role: z.enum([UserRole.STUDENT, UserRole.PARENT]),
})

export async function POST(request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    await assertTeacherOwnsClassroom(teacher.teacherProfileId, classroomId)
    const input = provisionSchema.parse(await request.json())

    const student = await prisma.student.findFirst({ where: { id: input.studentId, classroomId } })
    if (!student) throw new Error("NOT_FOUND")

    const user = await provisionAccount({
      role: input.role,
      name: input.role === UserRole.PARENT ? `${student.name}家长` : student.name,
      email: input.identifier,
      password: input.password,
      studentId: student.id,
    })
    return jsonOk({ userId: user.id })
  } catch (error) {
    return jsonError(error)
  }
}
