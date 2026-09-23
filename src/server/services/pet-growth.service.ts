import { prisma } from "@/server/db/prisma"
import { derivePetState } from "@/server/domain/pet-rules"

export async function getClassroomPet(classroomId: string) {
  const existing = await prisma.pet.findUnique({ where: { classroomId } })
  const pet = existing ?? await prisma.pet.create({ data: { classroomId, name: "云朵龙", species: "dragon" } })

  const now = new Date()
  const derived = derivePetState({ growthValue: pet.growthValue, hunger: pet.hunger, updatedAt: pet.updatedAt, now })

  if (derived.hunger !== pet.hunger || derived.level !== pet.level || derived.mood !== pet.mood) {
    return prisma.pet.update({ where: { id: pet.id }, data: { level: derived.level, hunger: derived.hunger, mood: derived.mood, updatedAt: now } })
  }

  return pet
}

export async function listPetLogs(classroomId: string) {
  const pet = await getClassroomPet(classroomId)
  return prisma.petGrowthLog.findMany({
    where: { petId: pet.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  })
}
