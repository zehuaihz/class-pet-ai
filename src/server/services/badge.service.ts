import { BadgeStatus, PetStatus, Prisma } from "@prisma/client"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { isGraduated, resolveVisualKey } from "@/server/domain/student-pet-rules"
import { AppError } from "@/server/utils/errors"

type PetLike = {
  id: string
  studentId: string
  speciesKey: string
  name: string
  growthValue: number
  status: PetStatus
}

/**
 * Mark a pet graduated and mint its Lv.10 badge.
 * Idempotent: repeated calls return the existing badge / graduated pet.
 * Returns null when the pet has not reached the final threshold.
 */
export async function graduatePetInTx(
  tx: Prisma.TransactionClient,
  pet: PetLike,
  thresholds: number[],
): Promise<{ pet: { id: string; status: PetStatus; graduatedAt: Date | null }; badge: { id: string } } | null> {
  if (!isGraduated(pet.growthValue, thresholds)) return null

  const existingBadge = await tx.badge.findUnique({ where: { studentPetId: pet.id } })
  if (pet.status === PetStatus.GRADUATED) {
    return existingBadge ? { pet: { id: pet.id, status: pet.status, graduatedAt: null }, badge: { id: existingBadge.id } } : null
  }

  const updated = await tx.studentPet.update({
    where: { id: pet.id },
    data: { status: PetStatus.GRADUATED, graduatedAt: new Date() },
  })
  const badge =
    existingBadge ??
    (await tx.badge.create({
      data: {
        studentId: pet.studentId,
        studentPetId: pet.id,
        name: `Lv.10 毕业 · ${pet.name}`,
        visualKey: resolveVisualKey(pet.speciesKey, 10),
        status: BadgeStatus.AVAILABLE,
      },
    }))

  return { pet: { id: updated.id, status: updated.status, graduatedAt: updated.graduatedAt }, badge: { id: badge.id } }
}

export interface BadgeView {
  id: string
  name: string
  visualKey: string
  status: BadgeStatus
  earnedAt: Date
  consumedAt: Date | null
  consumedByRedemptionId: string | null
}

export async function listStudentBadges(actorTeacherId: string, classroomId: string, studentId: string) {
  await assertTeacherOwnsClassroom(actorTeacherId, classroomId)
  const student = await prisma.student.findFirst({ where: { id: studentId, classroomId } })
  if (!student) throw new AppError("NOT_FOUND", "Student not found", 404)

  const [badges, redemptions] = await Promise.all([
    prisma.badge.findMany({ where: { studentId }, orderBy: { earnedAt: "desc" } }),
    prisma.rewardRedemption.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      include: { rewardItem: { select: { name: true } } },
    }),
  ])

  const available = badges.filter((badge) => badge.status === BadgeStatus.AVAILABLE).length
  const consumed = badges.filter((badge) => badge.status === BadgeStatus.CONSUMED).length

  return {
    student: { id: student.id, name: student.name, avatarUrl: student.avatarUrl },
    total: badges.length,
    available,
    consumed,
    badges: badges.map<BadgeView>((badge) => ({
      id: badge.id,
      name: badge.name,
      visualKey: badge.visualKey,
      status: badge.status,
      earnedAt: badge.earnedAt,
      consumedAt: badge.consumedAt,
      consumedByRedemptionId: badge.consumedByRedemptionId,
    })),
    redemptions: redemptions.map((redemption) => ({
      id: redemption.id,
      itemName: redemption.rewardItem.name,
      badgesSpent: redemption.badgesSpent,
      status: redemption.status,
      createdAt: redemption.createdAt,
    })),
  }
}

export async function listClassroomBadges(actorTeacherId: string, classroomId: string) {
  await assertTeacherOwnsClassroom(actorTeacherId, classroomId)
  const students = await prisma.student.findMany({
    where: { classroomId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    include: { badges: { orderBy: { earnedAt: "desc" } } },
  })
  return students.map((student) => ({
    student: { id: student.id, name: student.name, avatarUrl: student.avatarUrl },
    total: student.badges.length,
    available: student.badges.filter((badge) => badge.status === BadgeStatus.AVAILABLE).length,
    badges: student.badges.map<BadgeView>((badge) => ({
      id: badge.id,
      name: badge.name,
      visualKey: badge.visualKey,
      status: badge.status,
      earnedAt: badge.earnedAt,
      consumedAt: badge.consumedAt,
      consumedByRedemptionId: badge.consumedByRedemptionId,
    })),
  }))
}
