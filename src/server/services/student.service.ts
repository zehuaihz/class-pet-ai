import { PetStatus } from "@prisma/client"
import { prisma } from "@/server/db/prisma"
import { assertGroupBelongsToClassroom, assertTeacherOwnsClassroom } from "@/server/services/classroom.service"
import { AppError } from "@/server/utils/errors"

export interface CreateStudentInput {
  name: string
  studentNo?: string | null
  groupId?: string | null
  avatarUrl?: string | null
  /** 可选：从系统中已有的宠物品种中选择一只，创建学生时一并分配。 */
  petSpeciesKey?: string | null
}

/**
 * 创建学生，并在传入 petSpeciesKey 时在同一事务内为其分配一只指定品种的宠物。
 * 品种必须来自系统中已启用的 PetSpecies；学生与宠物要么同时创建，要么都不创建。
 */
export async function createStudent(actorTeacherId: string, classroomId: string, input: CreateStudentInput) {
  const name = input.name.trim()
  if (!name) throw new AppError("VALIDATION_ERROR", "student name required", 422)

  await assertTeacherOwnsClassroom(actorTeacherId, classroomId)
  if (input.groupId) await assertGroupBelongsToClassroom(input.groupId, classroomId)

  return prisma.$transaction(async (tx) => {
    let species = null
    if (input.petSpeciesKey) {
      species = await tx.petSpecies.findUnique({ where: { key: input.petSpeciesKey } })
      if (!species || !species.enabled) throw new AppError("VALIDATION_ERROR", "宠物品种不可用", 422)
    }

    const student = await tx.student.create({
      data: {
        classroomId,
        name,
        studentNo: input.studentNo ?? null,
        groupId: input.groupId ?? null,
        avatarUrl: input.avatarUrl ?? null,
      },
    })

    if (species) {
      await tx.studentPet.create({
        data: {
          studentId: student.id,
          speciesKey: species.key,
          name: species.name,
          level: 1,
          growthValue: 0,
          status: PetStatus.GROWING,
          adoptionSeq: 1,
        },
      })
    }

    return student
  })
}
