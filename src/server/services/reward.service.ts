import { z } from "zod"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { AppError } from "@/server/utils/errors"

const rewardItemSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  costBadges: z.number().int().min(1),
  stock: z.number().int().min(0).nullable().optional(),
  enabled: z.boolean().default(true),
})

export async function listRewardItems(actorTeacherId: string, classroomId: string) {
  await assertTeacherOwnsClassroom(actorTeacherId, classroomId)
  return prisma.rewardItem.findMany({ where: { classroomId }, orderBy: { createdAt: "desc" } })
}

export async function createRewardItem(actorTeacherId: string, classroomId: string, input: unknown) {
  await assertTeacherOwnsClassroom(actorTeacherId, classroomId)
  const data = rewardItemSchema.parse(input)
  return prisma.rewardItem.create({ data: { classroomId, ...data, stock: data.stock ?? null } })
}

export async function updateRewardItem(actorTeacherId: string, rewardItemId: string, input: unknown) {
  const item = await prisma.rewardItem.findUnique({ where: { id: rewardItemId } })
  if (!item) throw new AppError("NOT_FOUND", "Reward item not found", 404)
  await assertTeacherOwnsClassroom(actorTeacherId, item.classroomId)
  const data = rewardItemSchema.partial().parse(input)
  return prisma.rewardItem.update({ where: { id: rewardItemId }, data })
}

export async function deleteRewardItem(actorTeacherId: string, rewardItemId: string) {
  const item = await prisma.rewardItem.findUnique({ where: { id: rewardItemId } })
  if (!item) throw new AppError("NOT_FOUND", "Reward item not found", 404)
  await assertTeacherOwnsClassroom(actorTeacherId, item.classroomId)
  return prisma.rewardItem.update({ where: { id: rewardItemId }, data: { enabled: false } })
}
