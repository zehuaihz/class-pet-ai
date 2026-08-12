import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { jsonError, jsonOk } from "@/server/utils/api"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"

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
