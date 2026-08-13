/**
 * Student pet growth rules.
 *
 * A pet starts at Lv1 and grows through Lv.MAX_PET_LEVEL. Levels are derived
 * from the cumulative food (growthValue) against a per-classroom threshold
 * list, e.g. with 4 levels:
 *   thresholds[0] = 0   (Lv1 requires 0 cumulative food)
 *   thresholds[1] = 10  (Lv2 requires 10)
 *   thresholds[2] = 30  (Lv3 requires 30)
 *   thresholds[3] = 60  (Lv4 requires 60 -> graduation)
 */

export const MAX_PET_LEVEL = 4
export const PET_LEVEL_COUNT = 4

export const DEFAULT_LEVEL_THRESHOLDS = [0, 10, 30, 60] as const

export type LevelThresholds = number[]

/** Normalize a threshold list to the expected shape (10 levels, Lv1 = 0, non-negative). */
export function normalizeLevelThresholds(input: unknown): LevelThresholds {
  if (!Array.isArray(input) || input.length !== PET_LEVEL_COUNT) {
    throw new Error(`Level thresholds must contain exactly ${PET_LEVEL_COUNT} entries`)
  }
  const thresholds = input.map((value) => Number(value))
  for (const value of thresholds) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error("Level thresholds must be non-negative integers")
    }
  }
  if (thresholds[0] !== 0) {
    throw new Error("Level 1 threshold must be 0")
  }
  for (let i = 1; i < thresholds.length; i += 1) {
    if (thresholds[i] < thresholds[i - 1]) {
      throw new Error("Level thresholds must be non-decreasing")
    }
  }
  return thresholds
}

/** Derive the pet level from cumulative food against the threshold list. */
export function getStudentPetLevel(
  growthValue: number,
  thresholds: LevelThresholds = [...DEFAULT_LEVEL_THRESHOLDS],
): number {
  const clamped = Math.max(0, growthValue)
  let level = 1
  for (let i = 0; i < thresholds.length; i += 1) {
    if (clamped >= thresholds[i]) level = i + 1
  }
  return Math.min(level, MAX_PET_LEVEL)
}

/** A pet graduates once growth meets the final threshold. */
export function isGraduated(
  growthValue: number,
  thresholds: LevelThresholds = [...DEFAULT_LEVEL_THRESHOLDS],
): boolean {
  return getStudentPetLevel(growthValue, thresholds) >= MAX_PET_LEVEL
}

export interface LevelProgress {
  level: number
  currentThreshold: number
  nextThreshold: number | null // null at max level (graduated)
  remainingToNext: number | null
  progressRatio: number // 0..1 within the current level
  graduated: boolean
}

export function getLevelProgress(
  growthValue: number,
  thresholds: LevelThresholds = [...DEFAULT_LEVEL_THRESHOLDS],
): LevelProgress {
  const level = getStudentPetLevel(growthValue, thresholds)
  const currentThreshold = thresholds[level - 1]
  const graduated = level >= MAX_PET_LEVEL
  if (graduated) {
    return { level, currentThreshold, nextThreshold: null, remainingToNext: null, progressRatio: 1, graduated }
  }
  const nextThreshold = thresholds[level]
  const span = nextThreshold - currentThreshold
  const progressRatio = span <= 0 ? 1 : Math.min(1, Math.max(0, (growthValue - currentThreshold) / span))
  return {
    level,
    currentThreshold,
    nextThreshold,
    remainingToNext: Math.max(0, nextThreshold - growthValue),
    progressRatio,
    graduated,
  }
}

/** Map a species + level to its visual asset key (placeholder slot). */
export function resolveVisualKey(speciesKey: string, level: number): string {
  return `${speciesKey}-lv${Math.min(MAX_PET_LEVEL, Math.max(1, level))}`
}
