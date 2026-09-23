/**
 * AI job leasing.
 *
 * A job may be claimed by exactly one worker at a time, a stale lease may be
 * reclaimed, a live lease may not, and `maxAttempts` is a hard ceiling.
 */
import { AiJobStatus, AiJobType } from "@prisma/client"
import { describe, expect, it } from "vitest"
import { prisma } from "@/server/db/prisma"
import {
  AI_JOB_LEASE_MS,
  claimAiJob,
  completeAiJob,
  createAiJob,
  failAiJob,
  findClaimableAiJobs,
  resolveAiJob,
} from "@/server/services/ai-job.service"
import { seedClassroomForTeacher } from "@/test/seeds/seed-classroom"
import { CONCURRENCY } from "./setup/integration-env"
import { describeError, settleAll } from "./setup/harness"

interface SeedJobInput {
  maxAttempts?: number
  status?: AiJobStatus
  attemptCount?: number
  claimToken?: string
  lockedAt?: Date
  availableAt?: Date
}

async function seedJob(input: SeedJobInput = {}) {
  const seeded = await seedClassroomForTeacher({
    teacher: { email: "ai-job@test.com", name: "AI老师" },
    classroom: { name: "AI班" },
    aiJobs: [
      {
        type: AiJobType.COMMENT_DRAFT,
        maxAttempts: input.maxAttempts ?? 5,
        status: input.status,
        attemptCount: input.attemptCount,
        claimToken: input.claimToken,
        lockedAt: input.lockedAt,
        availableAt: input.availableAt,
      },
    ],
  })

  return { ...seeded, job: seeded.aiJobs[0] }
}

function staleLockDate(): Date {
  return new Date(Date.now() - AI_JOB_LEASE_MS - 60_000)
}

/** Narrows a claim result to its token, failing the test when the claim was lost. */
function requireClaim(result: { claimed: boolean; claimToken?: string }): string {
  if (!result.claimed || !result.claimToken) throw new Error("expected the claim to succeed")
  return result.claimToken
}

describe("ai job claiming", () => {
  it("lets exactly one of N parallel claims win", async () => {
    const { job } = await seedJob()

    const { fulfilled, rejected } = await settleAll(
      Array.from({ length: CONCURRENCY }, () => claimAiJob(job.id)),
    )

    expect(rejected.map(describeError)).toEqual([])
    const winners = fulfilled.filter((result) => result.claimed)
    const losers = fulfilled.filter((result) => !result.claimed)

    expect(winners).toHaveLength(1)
    expect(losers).toHaveLength(CONCURRENCY - 1)
    expect(winners[0].claimToken).toBeTruthy()

    const stored = await prisma.aiJob.findUniqueOrThrow({ where: { id: job.id } })
    expect(stored.status).toBe(AiJobStatus.RUNNING)
    expect(stored.attemptCount).toBe(1)
    expect(stored.claimToken).toBe(winners[0].claimToken)
    expect(stored.lockedAt).not.toBeNull()
    expect(stored.startedAt).not.toBeNull()
  })

  it("refuses to reclaim a live RUNNING job", async () => {
    const { job } = await seedJob()

    const first = await claimAiJob(job.id)
    expect(first.claimed).toBe(true)

    const second = await claimAiJob(job.id)
    expect(second.claimed).toBe(false)
    expect(second.claimToken).toBeUndefined()

    const stored = await prisma.aiJob.findUniqueOrThrow({ where: { id: job.id } })
    expect(stored.attemptCount).toBe(1)
    expect(stored.claimToken).toBe(first.claimToken)
  })

  it("reclaims a stale RUNNING job whose lease expired", async () => {
    const { job } = await seedJob()

    const first = await claimAiJob(job.id)
    await prisma.aiJob.update({ where: { id: job.id }, data: { lockedAt: staleLockDate() } })

    const second = await claimAiJob(job.id)
    expect(second.claimed).toBe(true)
    expect(second.claimToken).not.toBe(first.claimToken)

    const stored = await prisma.aiJob.findUniqueOrThrow({ where: { id: job.id } })
    expect(stored.status).toBe(AiJobStatus.RUNNING)
    expect(stored.attemptCount).toBe(2)
    expect(stored.claimToken).toBe(second.claimToken)
  })

  it("lets exactly one of N parallel reclaims of a stale job win", async () => {
    const { job } = await seedJob()
    await claimAiJob(job.id)
    await prisma.aiJob.update({ where: { id: job.id }, data: { lockedAt: staleLockDate() } })

    const { fulfilled } = await settleAll(Array.from({ length: CONCURRENCY }, () => claimAiJob(job.id)))
    const winners = fulfilled.filter((result) => result.claimed)

    expect(winners).toHaveLength(1)
    const stored = await prisma.aiJob.findUniqueOrThrow({ where: { id: job.id } })
    expect(stored.attemptCount).toBe(2)
    expect(stored.claimToken).toBe(winners[0].claimToken)
  })

  it("honours maxAttempts for pending jobs", async () => {
    const { job } = await seedJob({ maxAttempts: 2 })

    expect((await claimAiJob(job.id)).claimed).toBe(true)
    await prisma.aiJob.update({
      where: { id: job.id },
      data: { status: AiJobStatus.PENDING, lockedAt: null, claimToken: null, attemptCount: 2 },
    })

    const exhausted = await claimAiJob(job.id)
    expect(exhausted.claimed).toBe(false)

    const stored = await prisma.aiJob.findUniqueOrThrow({ where: { id: job.id } })
    expect(stored.attemptCount).toBe(2)
    expect(stored.status).toBe(AiJobStatus.PENDING)
  })

  it("fails a stale RUNNING job that already exhausted its attempts", async () => {
    const { job } = await seedJob({
      maxAttempts: 3,
      status: AiJobStatus.RUNNING,
      attemptCount: 3,
      lockedAt: staleLockDate(),
      claimToken: "stale-token",
    })

    const result = await claimAiJob(job.id)
    expect(result.claimed).toBe(false)

    const stored = await prisma.aiJob.findUniqueOrThrow({ where: { id: job.id } })
    expect(stored.status).toBe(AiJobStatus.FAILED)
    expect(stored.lastErrorCode).toBe("MAX_ATTEMPTS")
    expect(stored.claimToken).toBeNull()
    expect(stored.lockedAt).toBeNull()
    expect(stored.finishedAt).not.toBeNull()
  })

  it("does not let a worker complete a job it does not hold the token for", async () => {
    const { job } = await seedJob()

    const claim = await claimAiJob(job.id)
    const stolen = await completeAiJob(job.id, "not-the-token", { text: "hijacked" }, {})
    expect(stolen.count).toBe(0)

    const stillRunning = await prisma.aiJob.findUniqueOrThrow({ where: { id: job.id } })
    expect(stillRunning.status).toBe(AiJobStatus.RUNNING)
    expect(stillRunning.outputJson).toBeNull()

    const completed = await completeAiJob(job.id, requireClaim(claim), { text: "draft" }, { inputTokens: 12, outputTokens: 7 })
    expect(completed.count).toBe(1)

    const stored = await prisma.aiJob.findUniqueOrThrow({ where: { id: job.id } })
    expect(stored.status).toBe(AiJobStatus.SUCCEEDED)
    expect(stored.outputJson).toEqual({ text: "draft" })
    expect(stored.claimToken).toBeNull()
    expect(stored.lockedAt).toBeNull()
    expect(stored.startedAt).toBeNull()
    expect(stored.inputTokens).toBe(12)
    expect(stored.outputTokens).toBe(7)
  })

  it("makes a retryable failure claimable again only after the backoff elapses", async () => {
    const { job } = await seedJob()
    const claim = await claimAiJob(job.id)

    const failed = await failAiJob(job.id, requireClaim(claim), "PROVIDER_ERROR", "upstream 503", true)
    expect(failed.count).toBe(1)

    const afterFailure = await prisma.aiJob.findUniqueOrThrow({ where: { id: job.id } })
    expect(afterFailure.status).toBe(AiJobStatus.PENDING)
    expect(afterFailure.lastErrorCode).toBe("PROVIDER_ERROR")
    expect(afterFailure.errorMessage).toBe("upstream 503")
    expect(afterFailure.claimToken).toBeNull()
    expect(afterFailure.attemptCount).toBe(1)
    expect(afterFailure.availableAt.getTime()).toBeGreaterThan(Date.now())

    expect((await claimAiJob(job.id)).claimed).toBe(false)

    await prisma.aiJob.update({ where: { id: job.id }, data: { availableAt: new Date(Date.now() - 1_000) } })
    const reclaimed = await claimAiJob(job.id)
    expect(reclaimed.claimed).toBe(true)

    const stored = await prisma.aiJob.findUniqueOrThrow({ where: { id: job.id } })
    expect(stored.attemptCount).toBe(2)
    expect(stored.errorMessage).toBe("upstream 503")
  })

  it("fails the job immediately for a non-retryable error", async () => {
    const { job } = await seedJob()
    const claim = await claimAiJob(job.id)

    await failAiJob(job.id, requireClaim(claim), "INVALID_INPUT", "bad prompt", false)

    const stored = await prisma.aiJob.findUniqueOrThrow({ where: { id: job.id } })
    expect(stored.status).toBe(AiJobStatus.FAILED)
    expect(stored.lastErrorCode).toBe("INVALID_INPUT")
    expect(stored.finishedAt).not.toBeNull()
  })

  it("ignores a stale worker when it tries to fail a reclaimed job", async () => {
    const { job } = await seedJob()
    const stale = await claimAiJob(job.id)
    await prisma.aiJob.update({ where: { id: job.id }, data: { lockedAt: staleLockDate() } })

    const fresh = await claimAiJob(job.id)
    expect(fresh.claimed).toBe(true)

    const staleResult = await failAiJob(job.id, requireClaim(stale), "PROVIDER_ERROR", "late failure", true)
    expect(staleResult.count).toBe(0)

    const stored = await prisma.aiJob.findUniqueOrThrow({ where: { id: job.id } })
    expect(stored.status).toBe(AiJobStatus.RUNNING)
    expect(stored.claimToken).toBe(fresh.claimToken)
  })

  it("exposes only genuinely claimable jobs to workers", async () => {
    const { teacher, classroom } = await seedClassroomForTeacher({
      teacher: { email: "ai-queue@test.com", name: "队列老师" },
      classroom: { name: "队列班" },
    })

    const claimable = await createAiJob({
      actorTeacherId: teacher.id,
      classroomId: classroom.id,
      type: AiJobType.CLASS_SUMMARY,
      inputJson: { classroomId: classroom.id },
    })
    const backoff = await createAiJob({
      actorTeacherId: teacher.id,
      classroomId: classroom.id,
      type: AiJobType.STUDENT_INSIGHT,
      inputJson: { studentId: "student-1" },
    })
    await prisma.aiJob.update({
      where: { id: backoff.id },
      data: { availableAt: new Date(Date.now() + 60_000) },
    })
    const live = await createAiJob({
      actorTeacherId: teacher.id,
      classroomId: classroom.id,
      type: AiJobType.HOMEWORK_GENERATE,
      inputJson: { topic: "分数" },
    })
    await claimAiJob(live.id)

    const claimableIds = (await findClaimableAiJobs()).map((job) => job.id)
    expect(claimableIds).toContain(claimable.id)
    expect(claimableIds).not.toContain(backoff.id)
    expect(claimableIds).not.toContain(live.id)
  })

  it("resolves a job through resolveAiJob using the claim token", async () => {
    const { job } = await seedJob()
    const claim = await claimAiJob(job.id)

    const resolved = await resolveAiJob(job.id, requireClaim(claim), { summary: "本周表现良好" })
    expect(resolved.count).toBe(1)

    const stored = await prisma.aiJob.findUniqueOrThrow({ where: { id: job.id } })
    expect(stored.status).toBe(AiJobStatus.SUCCEEDED)
    expect(stored.outputJson).toEqual({ summary: "本周表现良好" })
  })
})
