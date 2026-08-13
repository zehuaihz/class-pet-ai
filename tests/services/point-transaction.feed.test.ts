import { Prisma } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

const dbMocks = vi.hoisted(() => ({
  studentFindFirst: vi.fn(),
  studentUpdate: vi.fn(),
  pointTransactionCreate: vi.fn(),
  studentPetFindFirst: vi.fn(),
  studentPetUpdate: vi.fn(),
  petLevelConfigFindMany: vi.fn(),
  petGrowthLogCreate: vi.fn(),
  badgeFindUnique: vi.fn(),
  badgeCreate: vi.fn(),
  pointRuleFindFirst: vi.fn(),
}))

import { createPointTransactionInTx } from "@/server/services/point-transaction.service"

function makeTx(): Prisma.TransactionClient {
  return {
    student: { findFirst: dbMocks.studentFindFirst, update: dbMocks.studentUpdate },
    pointTransaction: { create: dbMocks.pointTransactionCreate },
    studentPet: { findFirst: dbMocks.studentPetFindFirst, update: dbMocks.studentPetUpdate },
    petLevelConfig: { findMany: dbMocks.petLevelConfigFindMany },
    petGrowthLog: { create: dbMocks.petGrowthLogCreate },
    badge: { findUnique: dbMocks.badgeFindUnique, create: dbMocks.badgeCreate },
    pointRule: { findFirst: dbMocks.pointRuleFindFirst },
  } as unknown as Prisma.TransactionClient
}

const input = {
  actorTeacherId: "teacher_1",
  classroomId: "classroom_1",
  studentId: "student_1",
  delta: 5,
  reason: "答对问题",
}

function setPet(pet: { id: string; growthValue: number; status: string }) {
  dbMocks.studentPetFindFirst.mockResolvedValue({ ...pet, studentId: "student_1", speciesKey: "cat-orange", name: "橘猫" })
  dbMocks.studentPetUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: pet.id,
    studentId: "student_1",
    speciesKey: "cat-orange",
    name: "橘猫",
    status: data.status ?? pet.status,
    growthValue: typeof data.growthValue === "number" ? data.growthValue : pet.growthValue,
    level: typeof data.level === "number" ? data.level : 1,
  }))
}

describe("createPointTransactionInTx pet feeding", () => {
  beforeEach(() => {
    dbMocks.studentFindFirst.mockResolvedValue({ id: "student_1", classroomId: "classroom_1" })
    dbMocks.studentUpdate.mockResolvedValue({ totalPoints: 5 })
    dbMocks.pointTransactionCreate.mockResolvedValue({ id: "tx_1" })
    dbMocks.petLevelConfigFindMany.mockResolvedValue([]) // use default thresholds
    dbMocks.badgeFindUnique.mockResolvedValue(null)
    dbMocks.badgeCreate.mockResolvedValue({ id: "badge_1" })
    dbMocks.pointRuleFindFirst.mockResolvedValue(null)
    dbMocks.petGrowthLogCreate.mockResolvedValue({ id: "log_1" })
  })

  it("feeds the growing pet with a positive delta and logs the growth", async () => {
    setPet({ id: "pet_1", growthValue: 0, status: "GROWING" })
    const result = await createPointTransactionInTx(makeTx(), { ...input, delta: 10 })

    expect(dbMocks.studentPetUpdate).toHaveBeenCalledWith({
      where: { id: "pet_1" },
      data: { growthValue: 10, level: 2 },
    })
    expect(dbMocks.petGrowthLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studentPetId: "pet_1",
        pointTransactionId: "tx_1",
        growthDelta: 10,
        reason: "答对问题",
      }),
    })
    expect(result.pet).toEqual({ id: "pet_1", level: 2, growthValue: 10, graduated: false })
  })

  it("removes food for a negative delta (progress regresses) and floors at zero", async () => {
    setPet({ id: "pet_1", growthValue: 3, status: "GROWING" })
    await createPointTransactionInTx(makeTx(), { ...input, delta: -10 })

    expect(dbMocks.studentPetUpdate).toHaveBeenCalledWith({
      where: { id: "pet_1" },
      data: { growthValue: 0, level: 1 },
    })
    expect(dbMocks.petGrowthLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ growthDelta: -10 }),
    })
  })

  it("graduates the pet and mints a badge when food crosses the final threshold", async () => {
    setPet({ id: "pet_1", growthValue: 50, status: "GROWING" })
    const result = await createPointTransactionInTx(makeTx(), { ...input, delta: 10 })

    expect(dbMocks.badgeCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studentId: "student_1",
        studentPetId: "pet_1",
        status: "AVAILABLE",
      }),
    })
    expect(result.pet).toEqual({ id: "pet_1", level: 4, growthValue: 60, graduated: true })
    expect(result.badge).toEqual({ id: "badge_1" })
  })

  it("leaves the pet untouched when the student has no growing pet", async () => {
    dbMocks.studentPetFindFirst.mockResolvedValue(null)
    const result = await createPointTransactionInTx(makeTx(), input)

    expect(dbMocks.studentPetUpdate).not.toHaveBeenCalled()
    expect(dbMocks.petGrowthLogCreate).not.toHaveBeenCalled()
    expect(result.pet).toBeNull()
    expect(result.badge).toBeNull()
  })
})
