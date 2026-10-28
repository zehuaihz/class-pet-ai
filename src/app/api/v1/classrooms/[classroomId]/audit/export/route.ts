import { NextRequest, NextResponse } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { exportClassroomAudit } from "@/server/services/audit-export.service"
import { jsonError } from "@/server/utils/api"

export async function GET(_request: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { classroomId } = await context.params
    const csv = await exportClassroomAudit(teacher.teacherProfileId, classroomId)
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-${classroomId}.csv"`,
      },
    })
  } catch (error) {
    return jsonError(error)
  }
}
