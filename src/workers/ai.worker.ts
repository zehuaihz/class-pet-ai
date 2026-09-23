import { prisma } from "@/server/db/prisma"
import { findClaimableAiJobs } from "@/server/services/ai-job.service"
import { processAiJob } from "@/server/ai/processor"

const POLL_INTERVAL_MS = 2_000

async function tick() {
  const jobs = await findClaimableAiJobs()
  await Promise.allSettled(jobs.map((job) => processAiJob(job.id, job.type, job.inputJson)))
}

export async function runAiWorker(maxIterations?: number) {
  let iteration = 0
  while (maxIterations === undefined || iteration < maxIterations) {
    await tick().catch(() => undefined)
    iteration += 1
    if (maxIterations === undefined) await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

const isMainModule = process.argv[1] !== undefined &&
  new URL(`file://${process.argv[1]}`).href === import.meta.url

if (isMainModule) {
  void runAiWorker()
}

export { prisma }
