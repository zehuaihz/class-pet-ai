import { PetMood } from "@prisma/client"

export interface PetStateInput {
  growthValue: number
  hunger: number
  updatedAt: Date
  now: Date
  recentGrowthValue?: number
}

export interface DerivedPetState {
  level: number
  hunger: number
  mood: PetMood
}

export function getPetLevel(growthValue: number): number {
  return Math.max(1, Math.floor(Math.max(0, growthValue) / 100) + 1)
}

export function getPetHunger(hunger: number, updatedAt: Date, now: Date): number {
  const elapsedDays = Math.max(0, Math.floor((now.getTime() - updatedAt.getTime()) / 86_400_000))
  return Math.max(0, Math.min(100, hunger - elapsedDays * 5))
}

export function getPetMood(hunger: number, recentGrowthValue = 0): PetMood {
  if (recentGrowthValue >= 20 && hunger >= 40) return PetMood.EXCITED
  if (hunger >= 60) return PetMood.HAPPY
  if (hunger >= 30) return PetMood.NORMAL
  return PetMood.TIRED
}

export function derivePetState(input: PetStateInput): DerivedPetState {
  const hunger = getPetHunger(input.hunger, input.updatedAt, input.now)
  return {
    level: getPetLevel(input.growthValue),
    hunger,
    mood: getPetMood(hunger, input.recentGrowthValue),
  }
}

export function getUnlockedSkins(level: number): string[] {
  return ["default", ...(level >= 5 ? ["forest"] : []), ...(level >= 10 ? ["rainbow"] : []), ...(level >= 20 ? ["legendary"] : [])]
}
