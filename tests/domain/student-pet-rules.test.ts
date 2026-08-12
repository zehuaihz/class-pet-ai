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
  it("derives level from cumulative growth against default thresholds", () => {
    expect(getStudentPetLevel(0)).toBe(1)
    expect(getStudentPetLevel(4)).toBe(1)
    expect(getStudentPetLevel(5)).toBe(2)
    expect(getStudentPetLevel(9)).toBe(2)
    expect(getStudentPetLevel(10)).toBe(3)
    expect(getStudentPetLevel(99)).toBe(9)
    expect(getStudentPetLevel(100)).toBe(10)
    expect(getStudentPetLevel(500)).toBe(10)
  })

  it("floors negative growth at level 1", () => {
    expect(getStudentPetLevel(-10)).toBe(1)
    expect(getStudentPetLevel(Number.NEGATIVE_INFINITY)).toBe(1)
  })

  it("uses classroom-specific thresholds", () => {
    const thresholds = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]
    expect(getStudentPetLevel(5, thresholds)).toBe(1)
    expect(getStudentPetLevel(10, thresholds)).toBe(2)
    expect(getStudentPetLevel(90, thresholds)).toBe(10)
  })

  it("detects graduation at the final threshold", () => {
    expect(isGraduated(99)).toBe(false)
    expect(isGraduated(100)).toBe(true)
    expect(isGraduated(200)).toBe(true)
  })

  it("computes level progress within the current level", () => {
    const progress = getLevelProgress(7, [...DEFAULT_LEVEL_THRESHOLDS])
    expect(progress.level).toBe(2)
    expect(progress.currentThreshold).toBe(5)
    expect(progress.nextThreshold).toBe(10)
    expect(progress.remainingToNext).toBe(3)
    expect(progress.progressRatio).toBeCloseTo(0.4)
    expect(progress.graduated).toBe(false)
  })

  it("returns full progress once graduated", () => {
    const progress = getLevelProgress(100)
    expect(progress.graduated).toBe(true)
    expect(progress.nextThreshold).toBeNull()
    expect(progress.remainingToNext).toBeNull()
    expect(progress.progressRatio).toBe(1)
  })

  it("validates threshold lists", () => {
    expect(() => normalizeLevelThresholds([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])).not.toThrow()
    expect(() => normalizeLevelThresholds([0, 5, 10, 20, 30, 45, 60, 75, 90, 100])).not.toThrow()
    expect(() => normalizeLevelThresholds([1, 5, 10, 20, 30, 45, 60, 75, 90, 100])).toThrow() // Lv1 must be 0
    expect(() => normalizeLevelThresholds([0, 5, 10, 20, 30, 45, 60, 75, 90])).toThrow() // needs 10
    expect(() => normalizeLevelThresholds([0, 10, 5, 20, 30, 45, 60, 75, 90, 100])).toThrow() // not monotonic
    expect(() => normalizeLevelThresholds([0, -1, 10, 20, 30, 45, 60, 75, 90, 100])).toThrow()
  })

  it("resolves visual keys per level and caps at max", () => {
    expect(resolveVisualKey("cat-orange", 1)).toBe("cat-orange-lv1")
    expect(resolveVisualKey("cat-orange", 10)).toBe("cat-orange-lv10")
    expect(resolveVisualKey("cat-orange", 11)).toBe("cat-orange-lv10")
    expect(resolveVisualKey("cat-orange", 0)).toBe("cat-orange-lv1")
  })
})
