import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireTeacher } from "@/server/auth/session"
import { createAiJob } from "@/server/services/ai-job.service"
import { processAiJob } from "@/server/ai/processor"
import { jsonError } from "@/server/utils/api"
import { ok } from "@/server/utils/response-envelope"

const commentDraftSchema = z.object({
  classroomId: z.string().min(1),
  studentId: z.string().min(1),
  tone: z.string().trim().default("鼓励"),
  notes: z.string().trim().default(""),
})

export async function POST(request: NextRequest) {
  try {
    const teacher = await requireTeacher()
    const input = commentDraftSchema.parse(await request.json())

    const job = await createAiJob({
      actorTeacherId: teacher.teacherProfileId,
      classroomId: input.classroomId,
      type: "COMMENT_DRAFT",
      inputJson: {
        actorTeacherId: teacher.teacherProfileId,
        classroomId: input.classroomId,
        studentId: input.studentId,
        tone: input.tone,
        notes: input.notes,
      },
    })

    void processAiJob(job.id, job.type, job.inputJson).catch(() => undefined)

    return NextResponse.json(ok({ jobId: job.id, status: job.status }), { status: 202 })
  } catch (error) {
    return jsonError(error)
  }
}
