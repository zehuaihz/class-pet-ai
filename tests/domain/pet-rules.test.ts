import { describe, expect, it } from "vitest"
import { derivePetState, getPetLevel, getPetHunger, getUnlockedSkins } from "@/server/domain/pet-rules"

describe("pet rules", () => {
  it("converts growth into levels", () => {
    expect(getPetLevel(0)).toBe(1)
    expect(getPetLevel(99)).toBe(1)
    expect(getPetLevel(100)).toBe(2)
  })

  it("decays hunger once per elapsed day", () => {
    const updatedAt = new Date("2026-01-01T00:00:00.000Z")
    expect(getPetHunger(100, updatedAt, new Date("2026-01-03T00:00:00.000Z"))).toBe(90)
  })

  it("derives mood and unlocked skins deterministically", () => {
    const state = derivePetState({
      growthValue: 1000,
      hunger: 80,
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      now: new Date("2026-01-01T00:00:00.000Z"),
      recentGrowthValue: 20,
    })
    expect(state).toMatchObject({ level: 11, hunger: 80, mood: "EXCITED" })
    expect(getUnlockedSkins(state.level)).toEqual(["default", "forest", "rainbow"])
  })
})
