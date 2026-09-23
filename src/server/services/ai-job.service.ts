import { AiJobStatus, AiJobType, Prisma } from "@prisma/client"
import { randomUUID } from "node:crypto"
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

export const AI_JOB_LEASE_MS = 5 * 60_000

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

export async function claimAiJob(jobId: string): Promise<{ claimed: boolean; claimToken?: string }> {
  const now = new Date()
  const claimToken = randomUUID()
  const current = await prisma.aiJob.findUnique({ where: { id: jobId }, select: { maxAttempts: true, attemptCount: true, status: true, lockedAt: true } })
  if (!current) return { claimed: false }
  const stale = current.status === AiJobStatus.RUNNING && current.lockedAt !== null && current.lockedAt < new Date(now.getTime() - AI_JOB_LEASE_MS)
  if (stale && current.attemptCount >= current.maxAttempts) {
    await prisma.aiJob.updateMany({
      where: { id: jobId, status: AiJobStatus.RUNNING, lockedAt: current.lockedAt },
      data: { status: AiJobStatus.FAILED, finishedAt: now, startedAt: null, lockedAt: null, claimToken: null, lastErrorCode: "MAX_ATTEMPTS", errorMessage: "AI job lease expired after max attempts" },
    })
    return { claimed: false }
  }
  const updated = await prisma.aiJob.updateMany({
    where: {
      id: jobId,
      attemptCount: { lt: current.maxAttempts },
      OR: [
        { status: AiJobStatus.PENDING, availableAt: { lte: now } },
        { status: AiJobStatus.RUNNING, lockedAt: { lt: new Date(now.getTime() - AI_JOB_LEASE_MS) } },
      ],
    },
    data: {
      status: AiJobStatus.RUNNING,
      attemptCount: { increment: 1 },
      startedAt: now,
      lockedAt: now,
      claimToken,
      finishedAt: null,
    },
  })
  return updated.count > 0 ? { claimed: true, claimToken } : { claimed: false }
}

export async function completeAiJob(
  jobId: string,
  claimToken: string,
  output: Prisma.InputJsonValue,
  usage: { inputTokens?: number; outputTokens?: number; latencyMs?: number; providerRequestId?: string } = {},
) {
  return prisma.aiJob.updateMany({
    where: { id: jobId, status: AiJobStatus.RUNNING, claimToken },
    data: {
      status: AiJobStatus.SUCCEEDED,
      outputJson: output,
      finishedAt: new Date(),
      startedAt: null,
      lockedAt: null,
      claimToken: null,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      latencyMs: usage.latencyMs,
      lastErrorCode: null,
      errorMessage: null,
    },
  })
}

export async function failAiJob(jobId: string, claimToken: string, errorCode: string, message: string, retryable: boolean) {
  const job = await prisma.aiJob.findUnique({ where: { id: jobId }, select: { maxAttempts: true, attemptCount: true } })
  if (!job) return { count: 0 }

  const canRetry = retryable && job.attemptCount < job.maxAttempts
  const now = new Date()
  return prisma.aiJob.updateMany({
    where: { id: jobId, status: AiJobStatus.RUNNING, claimToken },
    data: canRetry
      ? {
          status: AiJobStatus.PENDING,
          lastErrorCode: errorCode,
          errorMessage: message,
          availableAt: new Date(now.getTime() + backoffMs(job.attemptCount)),
          startedAt: null,
          lockedAt: null,
          claimToken: null,
        }
      : {
          status: AiJobStatus.FAILED,
          lastErrorCode: errorCode,
          errorMessage: message,
          finishedAt: now,
          startedAt: null,
          lockedAt: null,
          claimToken: null,
        },
  })
}

function backoffMs(attempt: number): number {
  return Math.min(60_000, 2 ** Math.max(0, attempt - 1) * 1_000)
}

export async function resolveAiJob(jobId: string, claimToken: string, outputJson: Prisma.InputJsonValue) {
  return completeAiJob(jobId, claimToken, outputJson, {})
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
  const now = new Date()
  return prisma.aiJob.findMany({
    where: {
      OR: [
        { status: AiJobStatus.PENDING, availableAt: { lte: now } },
        { status: AiJobStatus.RUNNING, lockedAt: { lt: new Date(now.getTime() - AI_JOB_LEASE_MS) } },
      ],
    },
    take: limit,
    orderBy: { availableAt: "asc" },
  })
}
