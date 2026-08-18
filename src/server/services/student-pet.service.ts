import { BadgeStatus, PetStatus, Prisma } from "@prisma/client"
import { prisma } from "@/server/db/prisma"
import { AppError } from "@/server/utils/errors"
import { assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { getClassroomThresholds } from "@/server/services/pet-level-config.service"
import { graduatePetInTx } from "@/server/services/badge.service"
import { getLevelProgress, isGraduated, resolveVisualKey } from "@/server/domain/student-pet-rules"

export interface PetView {
  id: string
  name: string
  speciesKey: string
  speciesName: string
  visualKey: string
  growthValue: number
  status: PetStatus
  adoptionSeq: number
  graduatedAt: Date | null
  level: number
  currentThreshold: number
  nextThreshold: number | null
  remainingToNext: number | null
  progressRatio: number
  graduated: boolean
}

export type GrowingPet = Prisma.StudentPetGetPayload<{ include: { species: true } }>

export function buildStudentPetView(pet: GrowingPet, thresholds: number[]): PetView {
  const progress = getLevelProgress(pet.growthValue, thresholds)
  return {
    id: pet.id,
    name: pet.name,
    speciesKey: pet.speciesKey,
    speciesName: pet.species?.name ?? pet.speciesKey,
    visualKey: resolveVisualKey(pet.speciesKey, progress.level),
    growthValue: pet.growthValue,
    status: pet.status,
    adoptionSeq: pet.adoptionSeq,
    graduatedAt: pet.graduatedAt,
    ...progress,
  }
}

export async function listPetSpecies(actorTeacherId: string, classroomId: string) {
  await assertTeacherOwnsClassroom(actorTeacherId, classroomId)
  return prisma.petSpecies.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } })
}

/**
 * Assign a random pet species to students that do not yet own a growing pet.
 * Skips students that already have one; supports one-click whole-class assignment.
 */
export async function assignRandomPet(actorTeacherId: string, classroomId: string, studentIds: string[]) {
  await assertTeacherOwnsClassroom(actorTeacherId, classroomId)
  if (studentIds.length === 0) throw new AppError("VALIDATION_ERROR", "studentIds required", 422)

  const species = await prisma.petSpecies.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } })
  if (species.length === 0) throw new AppError("CONFLICT", "No pet species available", 409)

  const students = await prisma.student.findMany({ where: { id: { in: studentIds }, classroomId, status: "ACTIVE" } })
  if (students.length !== studentIds.length) {
    throw new AppError("FORBIDDEN", "Some students are not in this classroom", 403)
  }

  const startIndex = Math.floor(Math.random() * species.length)
  const assigned: Array<{ id: string; studentId: string; speciesKey: string; adoptionSeq: number }> = []
  for (const [index, student] of students.entries()) {
    const existing = await prisma.studentPet.findFirst({ where: { studentId: student.id, status: PetStatus.GROWING } })
    if (existing) continue
    const last = await prisma.studentPet.findFirst({ where: { studentId: student.id }, orderBy: { adoptionSeq: "desc" } })
    const speciesEntry = species[(startIndex + index) % species.length]
    const pet = await prisma.studentPet.create({
      data: {
        studentId: student.id,
        speciesKey: speciesEntry.key,
        name: speciesEntry.name,
        level: 1,
        growthValue: 0,
        status: PetStatus.GROWING,
        adoptionSeq: (last?.adoptionSeq ?? 0) + 1,
      },
    })
    assigned.push({ id: pet.id, studentId: pet.studentId, speciesKey: pet.speciesKey, adoptionSeq: pet.adoptionSeq })
  }
  return assigned
}

/**
 * Adopt the next pet after the current one graduates. Also graduates the
 * current pet defensively when it already crossed the threshold but the
 * graduation transaction has not been finalized.
 */
export async function adoptNextPet(actorTeacherId: string, classroomId: string, studentId: string) {
  await assertTeacherOwnsClassroom(actorTeacherId, classroomId)
  const student = await prisma.student.findFirst({ where: { id: studentId, classroomId } })
  if (!student) throw new AppError("NOT_FOUND", "Student not found", 404)

  const species = await prisma.petSpecies.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } })
  if (species.length === 0) throw new AppError("CONFLICT", "No pet species available", 409)

  return prisma.$transaction(async (tx) => {
    const thresholds = await getClassroomThresholds(classroomId, tx)
    const current = await tx.studentPet.findFirst({ where: { studentId, status: PetStatus.GROWING } })
    if (current) {
      if (!isGraduated(current.growthValue, thresholds)) {
        throw new AppError("CONFLICT", "Current pet has not graduated yet", 409)
      }
      await graduatePetInTx(tx, current, thresholds)
    }
    const last = await tx.studentPet.findFirst({ where: { studentId }, orderBy: { adoptionSeq: "desc" } })
    const speciesEntry = species[Math.floor(Math.random() * species.length)]
    return tx.studentPet.create({
      data: {
        studentId,
        speciesKey: speciesEntry.key,
        name: speciesEntry.name,
        level: 1,
        growthValue: 0,
        status: PetStatus.GROWING,
        adoptionSeq: (last?.adoptionSeq ?? 0) + 1,
      },
    })
  })
}

/** The zoo wall: every active student with their growing pet and progress. */
export async function listZoo(actorTeacherId: string, classroomId: string) {
  await assertTeacherOwnsClassroom(actorTeacherId, classroomId)
  const [students, thresholds] = await Promise.all([
    prisma.student.findMany({
      where: { classroomId, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      include: {
        studentPets: {
          where: { status: PetStatus.GROWING },
          include: { species: true },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { badges: { where: { status: BadgeStatus.AVAILABLE } } } },
      },
    }),
    getClassroomThresholds(classroomId),
  ])

  return students.map((student) => ({
    student: { id: student.id, name: student.name, studentNo: student.studentNo, avatarUrl: student.avatarUrl },
    badgeCount: student._count.badges,
    pet: student.studentPets[0] ? buildStudentPetView(student.studentPets[0], thresholds) : null,
  }))
}

/** One student's pet detail: active pet, growth log, and badge wall. */
export async function getStudentPet(actorTeacherId: string, classroomId: string, studentId: string) {
  await assertTeacherOwnsClassroom(actorTeacherId, classroomId)
  const student = await prisma.student.findFirst({ where: { id: studentId, classroomId } })
  if (!student) throw new AppError("NOT_FOUND", "Student not found", 404)

  const [pet, badges, thresholds] = await Promise.all([
    prisma.studentPet.findFirst({ where: { studentId, status: PetStatus.GROWING }, include: { species: true } }),
    prisma.badge.findMany({ where: { studentId }, orderBy: { earnedAt: "desc" } }),
    getClassroomThresholds(classroomId),
  ])

  const growingPet = pet
  const petLogs = growingPet
    ? await prisma.petGrowthLog.findMany({ where: { studentPetId: growingPet.id }, orderBy: { createdAt: "desc" }, take: 50 })
    : []

  return {
    student: { id: student.id, name: student.name, avatarUrl: student.avatarUrl },
    pet: growingPet ? buildStudentPetView(growingPet, thresholds) : null,
    badges: badges.map((badge) => ({
      id: badge.id,
      name: badge.name,
      visualKey: badge.visualKey,
      status: badge.status,
      earnedAt: badge.earnedAt,
      consumedAt: badge.consumedAt,
    })),
    logs: petLogs.map((log) => ({ id: log.id, reason: log.reason, growthDelta: log.growthDelta, createdAt: log.createdAt })),
  }
}
