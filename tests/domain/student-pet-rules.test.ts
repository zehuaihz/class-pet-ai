import { describe, expect, it } from "vitest"
import {
  DEFAULT_LEVEL_THRESHOLDS,
  getLevelProgress,
  getStudentPetLevel,
  isGraduated,
  normalizeLevelThresholds,
  resolveVisualKey,
} from "@/server/domain/student-pet-rules"

describe("student pet rules", () => {
  it("derives level from cumulative growth against default 4-level thresholds", () => {
    expect(getStudentPetLevel(0)).toBe(1)
    expect(getStudentPetLevel(9)).toBe(1)
    expect(getStudentPetLevel(10)).toBe(2)
    expect(getStudentPetLevel(29)).toBe(2)
    expect(getStudentPetLevel(30)).toBe(3)
    expect(getStudentPetLevel(59)).toBe(3)
    expect(getStudentPetLevel(60)).toBe(4)
    expect(getStudentPetLevel(500)).toBe(4)
  })

  it("floors negative growth at level 1", () => {
    expect(getStudentPetLevel(-10)).toBe(1)
    expect(getStudentPetLevel(Number.NEGATIVE_INFINITY)).toBe(1)
  })

  it("uses classroom-specific thresholds", () => {
    const thresholds = [0, 10, 30, 60]
    expect(getStudentPetLevel(5, thresholds)).toBe(1)
    expect(getStudentPetLevel(10, thresholds)).toBe(2)
    expect(getStudentPetLevel(60, thresholds)).toBe(4)
  })

  it("detects graduation at the final threshold", () => {
    expect(isGraduated(59)).toBe(false)
    expect(isGraduated(60)).toBe(true)
    expect(isGraduated(200)).toBe(true)
  })

  it("computes level progress within the current level", () => {
    const progress = getLevelProgress(7, [...DEFAULT_LEVEL_THRESHOLDS])
    expect(progress.level).toBe(1)
    expect(progress.currentThreshold).toBe(0)
    expect(progress.nextThreshold).toBe(10)
    expect(progress.remainingToNext).toBe(3)
    expect(progress.progressRatio).toBeCloseTo(0.7)
    expect(progress.graduated).toBe(false)
  })

  it("returns full progress once graduated", () => {
    const progress = getLevelProgress(60)
    expect(progress.graduated).toBe(true)
    expect(progress.nextThreshold).toBeNull()
    expect(progress.remainingToNext).toBeNull()
    expect(progress.progressRatio).toBe(1)
  })

  it("validates threshold lists", () => {
    expect(() => normalizeLevelThresholds([0, 10, 30, 60])).not.toThrow()
    expect(() => normalizeLevelThresholds([0, 1, 2, 3])).not.toThrow()
    expect(() => normalizeLevelThresholds([1, 5, 10, 20])).toThrow() // Lv1 must be 0
    expect(() => normalizeLevelThresholds([0, 5, 10])).toThrow() // needs 4
    expect(() => normalizeLevelThresholds([0, 10, 5, 20])).toThrow() // not monotonic
    expect(() => normalizeLevelThresholds([0, -1, 10, 20])).toThrow()
  })

  it("resolves visual keys per level and caps at max", () => {
    expect(resolveVisualKey("cat-orange", 1)).toBe("cat-orange-lv1")
    expect(resolveVisualKey("cat-orange", 4)).toBe("cat-orange-lv4")
    expect(resolveVisualKey("cat-orange", 5)).toBe("cat-orange-lv4")
    expect(resolveVisualKey("cat-orange", 0)).toBe("cat-orange-lv1")
  })
})
