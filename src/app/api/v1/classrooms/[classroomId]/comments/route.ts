import { NextRequest } from "next/server"
import { z } from "zod"
import { requireTeacher } from "@/server/auth/session"
import { AppError } from "@/server/utils/errors"
import { jsonError, jsonOk } from "@/server/utils/api"
import { listStudentComments, saveStudentComment } from "@/server/services/student-comment.service"

const saveSchema = z.object({
  studentId: z.string().min(1),
  content: z.string().trim().min(1, "评语内容不能为空").max(2000),
  tone: z.string().max(20).optional(),
})

export async function GET(_request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    const url = new URL(_request.url)
    const studentId = url.searchParams.get("studentId")
    const comments = await listStudentComments(teacher.teacherProfileId, classroomId, studentId)
    return jsonOk({ items: comments })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    const parsed = saveSchema.safeParse(await request.json())
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "请求参数不合法", 422)
    }
    const comment = await saveStudentComment(teacher.teacherProfileId, classroomId, {
      ...parsed.data,
      teacherProfileId: teacher.teacherProfileId,
    })
    return jsonOk(comment, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
