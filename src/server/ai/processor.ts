import { AiJobType } from "@prisma/client"
import { getAiProvider } from "@/server/ai/provider-config"
import { ProviderError } from "@/server/ai/ai-provider"
import { claimAiJob, completeAiJob, failAiJob } from "@/server/services/ai-job.service"
import { buildCommentContext } from "@/server/services/ai-comment.service"

export async function processAiJob(jobId: string, type: AiJobType, inputJson: unknown): Promise<void> {
  const { claimed } = await claimAiJob(jobId)
  if (!claimed) return

  try {
    if (type !== AiJobType.COMMENT_DRAFT) {
      throw new ProviderError("job type not supported", "INVALID_REQUEST", false)
    }
    const input = inputJson as { actorTeacherId: string; classroomId: string; studentId: string; tone: string; notes: string }
    const context = await buildCommentContext(input.actorTeacherId, input.classroomId, input.studentId, input.tone, input.notes)
    const result = await getAiProvider().generateCommentDraft(context)
    await completeAiJob(jobId, { text: result.text }, {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: result.latencyMs,
      providerRequestId: result.providerRequestId,
    })
  } catch (error: unknown) {
    if (error instanceof ProviderError) {
      await failAiJob(jobId, error.code, error.message, error.retryable)
    } else {
      await failAiJob(jobId, "UNKNOWN", error instanceof Error ? error.message : "unknown error", true)
    }
  }
}
