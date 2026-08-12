import { AiJobStatus, AiJobType, Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { AppError } from "@/server/utils/errors"

const createAiJobSchema = z.object({
  actorTeacherId: z.string().min(1),
  classroomId: z.string().min(1),
  type: z.nativeEnum(AiJobType),
  inputJson: z.record(z.string(), z.unknown()),
  provider: z.string().optional(),
  modelName: z.string().optional(),
})

export async function createAiJob(input: unknown) {
  const parsed = createAiJobSchema.parse(input)
  await assertTeacherOwnsClassroom(parsed.actorTeacherId, parsed.classroomId)

  return prisma.aiJob.create({
    data: {
      classroomId: parsed.classroomId,
      teacherId: parsed.actorTeacherId,
      type: parsed.type,
      inputJson: parsed.inputJson as Prisma.InputJsonValue,
      provider: parsed.provider ?? process.env.AI_PROVIDER ?? "mock",
      modelName: parsed.modelName ?? process.env.AI_MODEL ?? "mock-model",
      status: AiJobStatus.PENDING,
    },
  })
}

export async function claimAiJob(jobId: string): Promise<{ claimed: boolean }> {
  const updated = await prisma.aiJob.updateMany({
    where: { id: jobId, status: AiJobStatus.PENDING },
    data: { status: AiJobStatus.RUNNING, startedAt: new Date(), lockedAt: new Date() },
  })
  return { claimed: updated.count > 0 }
}

export async function completeAiJob(jobId: string, output: Prisma.InputJsonValue, usage: { inputTokens?: number; outputTokens?: number; latencyMs?: number; providerRequestId?: string }) {
  return prisma.aiJob.updateMany({
    where: { id: jobId, status: AiJobStatus.RUNNING },
    data: {
      status: AiJobStatus.SUCCEEDED,
      outputJson: output,
      finishedAt: new Date(),
      startedAt: null,
      lockedAt: null,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      latencyMs: usage.latencyMs,
      lastErrorCode: null,
      errorMessage: null,
    },
  })
}

export async function failAiJob(jobId: string, errorCode: string, message: string, retryable: boolean, maxAttempts = 5) {
  const requeued = await prisma.aiJob.updateMany({
    where: { id: jobId, status: AiJobStatus.RUNNING, attemptCount: { lt: maxAttempts } },
    data: retryable
      ? { status: AiJobStatus.PENDING, attemptCount: { increment: 1 }, lastErrorCode: errorCode, errorMessage: message, availableAt: new Date(Date.now() + backoffMs(1)), startedAt: null, lockedAt: null }
      : { status: AiJobStatus.FAILED, attemptCount: { increment: 1 }, lastErrorCode: errorCode, errorMessage: message, finishedAt: new Date() },
  })
  if (requeued.count > 0) return requeued

  return prisma.aiJob.updateMany({
    where: { id: jobId, status: AiJobStatus.RUNNING },
    data: { status: AiJobStatus.FAILED, attemptCount: { increment: 1 }, lastErrorCode: errorCode, errorMessage: message, finishedAt: new Date() },
  })
}

function backoffMs(attempt: number): number {
  return Math.min(60_000, 2 ** attempt * 1000)
}

export async function resolveAiJob(jobId: string, outputJson: Prisma.InputJsonValue) {
  return completeAiJob(jobId, outputJson, {})
}

export function sanitizeAiText(input: string): string {
  return input
    .replace(/\b\d{11}\b/g, "[phone]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
}

export async function findOwnedAiJob(actorTeacherId: string, jobId: string) {
  const job = await prisma.aiJob.findUnique({ where: { id: jobId } })
  if (!job) throw new AppError("NOT_FOUND", "AI job not found", 404)
  if (job.teacherId !== actorTeacherId) throw new AppError("FORBIDDEN", "No permission for AI job")
  return job
}

export async function findClaimableAiJobs(limit = 10) {
  return prisma.aiJob.findMany({
    where: {
      OR: [
        { status: AiJobStatus.PENDING, availableAt: { lte: new Date() } },
        { status: AiJobStatus.RUNNING, lockedAt: { lt: new Date(Date.now() - 5 * 60_000) } },
      ],
    },
    take: limit,
    orderBy: { availableAt: "asc" },
  })
}
