import { NextRequest, type NextResponse } from "next/server"
import { z } from "zod"
import { requireTeacher } from "@/server/auth/session"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { jsonError, jsonOk } from "@/server/utils/api"
import { AppError } from "@/server/utils/errors"

const importStudentsBodySchema = z.object({
  students: z.array(z.unknown()),
})

const importStudentRowSchema = z.object({
  name: z.unknown().optional(),
  studentNo: z.unknown().optional(),
})

type ImportStudentRow = z.infer<typeof importStudentRowSchema>
type ValidImportStudentRow = {
  name: string
  studentNo: string | null
}

interface ImportFailure {
  row: number
  reason: string
}

interface RouteContext {
  params: Promise<{ classroomId: string }>
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    await assertTeacherOwnsClassroom(teacher.teacherProfileId, classroomId)

    const body: unknown = await request.json()
    const parsedBody = importStudentsBodySchema.safeParse(body)
    const rows = parsedBody.success ? parsedBody.data.students : []
    if (rows.length === 0) throw new AppError("VALIDATION_ERROR", "students required", 422)

    const failures: ImportFailure[] = []
    const validRows = rows.flatMap<ValidImportStudentRow>((row, index) => {
      const parsedRow = importStudentRowSchema.safeParse(row)
      const student: ImportStudentRow = parsedRow.success ? parsedRow.data : {}
      const name = String(student.name ?? "").trim()
      if (!name) {
        failures.push({ row: index + 1, reason: "name required" })
        return []
      }
      return [{ name, studentNo: student.studentNo ? String(student.studentNo) : null }]
    })

    await prisma.student.createMany({
      data: validRows.map((student) => ({ classroomId, ...student })),
    })

    return jsonOk({
      createdCount: validRows.length,
      updatedCount: 0,
      failedCount: failures.length,
      failures,
    })
  } catch (error) {
    return jsonError(error)
  }
}
