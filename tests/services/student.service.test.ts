import { beforeEach, describe, expect, it, vi } from "vitest"

const dbMocks = vi.hoisted(() => ({
  classroomFindFirst: vi.fn(),
  teacherProfileFindUnique: vi.fn(),
  groupFindFirst: vi.fn(),
  transaction: vi.fn(),
  petSpeciesFindUnique: vi.fn(),
  studentCreate: vi.fn(),
  studentPetCreate: vi.fn(),
}))

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    classroom: { findFirst: dbMocks.classroomFindFirst },
    teacherProfile: { findUnique: dbMocks.teacherProfileFindUnique },
    group: { findFirst: dbMocks.groupFindFirst },
    $transaction: dbMocks.transaction,
  },
}))

import { createStudent } from "@/server/services/student.service"

const tx = {
  petSpecies: { findUnique: dbMocks.petSpeciesFindUnique },
  student: { create: dbMocks.studentCreate },
  studentPet: { create: dbMocks.studentPetCreate },
}

const species = { key: "cat-orange", name: "橘猫", category: "cat", enabled: true }
const student = { id: "student_1", classroomId: "classroom_1", name: "小明" }

describe("createStudent", () => {
  beforeEach(() => {
    dbMocks.classroomFindFirst.mockResolvedValue({ id: "classroom_1", teacherId: "teacher_1" })
    dbMocks.teacherProfileFindUnique.mockResolvedValue({ id: "teacher_1", user: { role: "TEACHER" } })
    dbMocks.groupFindFirst.mockResolvedValue(null)
    dbMocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx))
    dbMocks.petSpeciesFindUnique.mockResolvedValue(species)
    dbMocks.studentCreate.mockResolvedValue(student)
    dbMocks.studentPetCreate.mockResolvedValue({ id: "pet_1" })
  })

  it("creates a student without a pet by default", async () => {
    const result = await createStudent("teacher_1", "classroom_1", { name: "小明" })

    expect(dbMocks.studentCreate).toHaveBeenCalledWith({
      data: { classroomId: "classroom_1", name: "小明", studentNo: null, groupId: null, avatarUrl: null },
    })
    expect(dbMocks.petSpeciesFindUnique).not.toHaveBeenCalled()
    expect(dbMocks.studentPetCreate).not.toHaveBeenCalled()
    expect(result).toEqual(student)
  })

  it("creates a student with the chosen pet species in the same transaction", async () => {
    await createStudent("teacher_1", "classroom_1", { name: "小红", petSpeciesKey: "cat-orange" })

    expect(dbMocks.petSpeciesFindUnique).toHaveBeenCalledWith({ where: { key: "cat-orange" } })
    expect(dbMocks.studentCreate).toHaveBeenCalled()
    expect(dbMocks.studentPetCreate).toHaveBeenCalledWith({
      data: {
        studentId: "student_1",
        speciesKey: "cat-orange",
        name: "橘猫",
        level: 1,
        growthValue: 0,
        status: "GROWING",
        adoptionSeq: 1,
      },
    })
  })

  it("rejects a disabled pet species", async () => {
    dbMocks.petSpeciesFindUnique.mockResolvedValue({ ...species, enabled: false })

    await expect(createStudent("teacher_1", "classroom_1", { name: "小红", petSpeciesKey: "cat-orange" })).rejects.toThrow("宠物品种不可用")
    expect(dbMocks.studentCreate).not.toHaveBeenCalled()
  })

  it("rejects an unknown pet species", async () => {
    dbMocks.petSpeciesFindUnique.mockResolvedValue(null)

    await expect(createStudent("teacher_1", "classroom_1", { name: "小红", petSpeciesKey: "cat-ghost" })).rejects.toThrow("宠物品种不可用")
    expect(dbMocks.studentCreate).not.toHaveBeenCalled()
  })

  it("rejects an empty name", async () => {
    await expect(createStudent("teacher_1", "classroom_1", { name: "   " })).rejects.toThrow("student name required")
    expect(dbMocks.studentCreate).not.toHaveBeenCalled()
  })

  it("rejects when the teacher does not own the classroom", async () => {
    dbMocks.classroomFindFirst.mockResolvedValue(null)

    await expect(createStudent("teacher_1", "classroom_1", { name: "小明" })).rejects.toThrow("No permission for classroom")
    expect(dbMocks.studentCreate).not.toHaveBeenCalled()
  })

  it("rejects a group that does not belong to the classroom", async () => {
    await expect(createStudent("teacher_1", "classroom_1", { name: "小明", groupId: "group_x" })).rejects.toThrow("No permission for group")
    expect(dbMocks.studentCreate).not.toHaveBeenCalled()
  })
})
