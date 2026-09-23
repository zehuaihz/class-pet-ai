import { NextRequest } from "next/server"
import { z } from "zod"
import { requireTeacher } from "@/server/auth/session"
import { jsonError, jsonOk } from "@/server/utils/api"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { submitCheckinRecord } from "@/server/services/checkin-record.service"
import { AppError } from "@/server/utils/errors"

const manualCheckinSchema = z.object({
  studentId: z.string().min(1),
  taskId: z.string().min(1),
  evidenceUrl: z.string().url().optional().nullable(),
})

export async function GET(_request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    await assertTeacherOwnsClassroom(teacher.teacherProfileId, classroomId)

    const records = await prisma.checkinRecord.findMany({
      where: { task: { classroomId }, status: "PENDING" },
      include: { student: true, task: true },
      orderBy: { createdAt: "desc" },
    })

    return jsonOk({
      items: records.map((record) => ({
        id: record.id,
        studentName: record.student.name,
        taskTitle: record.task.title,
        evidenceUrl: record.evidenceUrl,
        status: record.status,
      })),
    })
  } catch (error) {
    return jsonError(error)
  }
}

/**
 * Teacher manual check-in (补录). The route classroom is authoritative: both the
 * task and the student must belong to it, so a teacher cannot record a check-in
 * against another classroom by passing foreign ids.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    await assertTeacherOwnsClassroom(teacher.teacherProfileId, classroomId)

    const parsed = manualCheckinSchema.parse(await request.json())

    const [task, student] = await Promise.all([
      prisma.checkinTask.findFirst({ where: { id: parsed.taskId, classroomId }, select: { id: true } }),
      prisma.student.findFirst({ where: { id: parsed.studentId, classroomId }, select: { id: true } }),
    ])
    if (!task) throw new AppError("NOT_FOUND", "Task not found in this classroom", 404)
    if (!student) throw new AppError("NOT_FOUND", "Student not found in this classroom", 404)

    const record = await submitCheckinRecord({
      actorTeacherId: teacher.teacherProfileId,
      studentId: parsed.studentId,
      taskId: parsed.taskId,
      evidenceUrl: parsed.evidenceUrl ?? null,
    })
    return jsonOk(record)
  } catch (error) {
    return jsonError(error)
  }
}
