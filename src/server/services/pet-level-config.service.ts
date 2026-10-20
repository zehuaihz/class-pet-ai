import { z } from "zod"
import { Prisma } from "@prisma/client"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import {
  DEFAULT_LEVEL_THRESHOLDS,
  PET_LEVEL_COUNT,
  normalizeLevelThresholds,
} from "@/server/domain/student-pet-rules"
import { AppError } from "@/server/utils/errors"

type DbClient = Prisma.TransactionClient | typeof prisma

/**
 * Read the cumulative food threshold per level for a classroom.
 * Falls back to defaults when the classroom has no configuration yet.
 */
export async function getClassroomThresholds(classroomId: string, db: DbClient = prisma): Promise<number[]> {
  const configs = await db.petLevelConfig.findMany({ where: { classroomId }, orderBy: { level: "asc" } })
  if (configs.length === 0) return [...DEFAULT_LEVEL_THRESHOLDS]
  const thresholds = Array.from({ length: PET_LEVEL_COUNT }, () => 0)
  for (const config of configs) {
    if (config.level >= 1 && config.level <= PET_LEVEL_COUNT) {
      thresholds[config.level - 1] = config.requiredGrowth
    }
  }
  return thresholds
}

export async function getLevelConfig(actorTeacherId: string, classroomId: string) {
  await assertTeacherOwnsClassroom(actorTeacherId, classroomId)
  const thresholds = await getClassroomThresholds(classroomId)
  return thresholds.map((requiredGrowth, index) => ({ level: index + 1, requiredGrowth }))
}

const levelConfigSchema = z.object({
  thresholds: z.array(z.number().int().min(0)).length(PET_LEVEL_COUNT),
})

export async function saveLevelConfig(actorTeacherId: string, classroomId: string, input: unknown) {
  await assertTeacherOwnsClassroom(actorTeacherId, classroomId)
  const parsed = levelConfigSchema.parse(input)
  let thresholds: number[]
  try {
    thresholds = normalizeLevelThresholds(parsed.thresholds)
  } catch {
    throw new AppError("VALIDATION_ERROR", "Level thresholds must start at 0 and be non-decreasing", 422)
  }

  await prisma.$transaction(async (tx) => {
    await tx.petLevelConfig.deleteMany({ where: { classroomId } })
    await tx.petLevelConfig.createMany({
      data: thresholds.map((requiredGrowth, index) => ({
        classroomId,
        level: index + 1,
        requiredGrowth,
      })),
    })
  })

  return getLevelConfig(actorTeacherId, classroomId)
}
