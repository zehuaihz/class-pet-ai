import { NextRequest } from "next/server"
import { requireTeacher } from "@/server/auth/session"
import { findOwnedAiJob } from "@/server/services/ai-job.service"
import { jsonError, jsonOk } from "@/server/utils/api"
import { AppError } from "@/server/utils/errors"

export async function GET(_request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  try {
    const teacher = await requireTeacher()
    const { jobId } = await context.params
    const job = await findOwnedAiJob(teacher.teacherProfileId, jobId)
    if (!job) throw new AppError("NOT_FOUND", "AI job not found", 404)
    return jsonOk(job)
  } catch (error) {
    return jsonError(error)
  }
}
