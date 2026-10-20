import { BadgeStatus, PetStatus } from "@prisma/client"
import { prisma } from "@/server/db/prisma"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { getClassroomThresholds } from "@/server/services/pet-level-config.service"
import { getLevelProgress, resolveVisualKey } from "@/server/domain/student-pet-rules"

/** 光荣榜: students ranked by available badge count, then pet growth. */
export async function getGloryBoard(actorTeacherId: string, classroomId: string) {
  await assertTeacherOwnsClassroom(actorTeacherId, classroomId)

  const [students, thresholds] = await Promise.all([
    prisma.student.findMany({
      where: { classroomId, status: "ACTIVE" },
      include: {
        studentPets: {
          where: { status: PetStatus.GROWING },
          include: { species: true },
          orderBy: { createdAt: "desc" },
        },
        badges: { select: { status: true } },
      },
    }),
    getClassroomThresholds(classroomId),
  ])

  return students
    .map((student) => {
      const badgeCount = student.badges.filter((badge) => badge.status === BadgeStatus.AVAILABLE).length
      const pet = student.studentPets[0] ?? null
      const progress = pet ? getLevelProgress(pet.growthValue, thresholds) : null
      return {
        student: { id: student.id, name: student.name, avatarUrl: student.avatarUrl },
        badgeCount,
        pet: pet
          ? {
              name: pet.name,
              speciesKey: pet.speciesKey,
              speciesName: pet.species?.name ?? pet.speciesKey,
              visualKey: resolveVisualKey(pet.speciesKey, progress!.level),
              level: progress!.level,
              growthValue: pet.growthValue,
              progressRatio: progress!.progressRatio,
              graduated: progress!.graduated,
            }
          : null,
      }
    })
    .sort(
      (a, b) =>
        b.badgeCount - a.badgeCount ||
        (b.pet?.growthValue ?? 0) - (a.pet?.growthValue ?? 0) ||
        a.student.name.localeCompare(b.student.name),
    )
}
