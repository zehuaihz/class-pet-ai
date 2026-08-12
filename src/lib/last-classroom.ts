// Client-side persistence for the teacher's last-selected classroom.
// Shared by the login redirect, the class switcher, the app shell, and the
// dashboard so a class change propagates across every page.

export const LAST_CLASSROOM_STORAGE_KEY = "class_pet_last_classroom_id"
export const LAST_CLASSROOM_USER_STORAGE_KEY = "class_pet_last_classroom_user"
export const CLASSROOM_CHANGE_EVENT = "class-pet:classroom-change"

export interface ClassroomOption {
  id: string
  name: string
}

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(key)
}

function writeStorage(key: string, value: string): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(key, value)
}

/** Returns the persisted last classroom id, or null when nothing is stored. */
export function readLastClassroomId(): string | null {
  return readStorage(LAST_CLASSROOM_STORAGE_KEY)
}

/**
 * Resolves the classroom id to surface: the persisted value when it still
 * belongs to the teacher's classrooms, otherwise the provided fallback (or the
 * first classroom). Never returns an id the teacher cannot access.
 */
export function resolveLastClassroomId(
  classrooms: ClassroomOption[],
  fallback?: string | null,
): string | null {
  const saved = readLastClassroomId()
  if (saved && classrooms.some((classroom) => classroom.id === saved)) {
    return saved
  }
  return fallback ?? classrooms[0]?.id ?? null
}

/** Persists the selected classroom and broadcasts the change to other pages. */
export function rememberClassroomId(classroomId: string): void {
  writeStorage(LAST_CLASSROOM_STORAGE_KEY, classroomId)
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(CLASSROOM_CHANGE_EVENT, { detail: { classroomId } }),
    )
  }
}

/** Records which user the persisted classroom belongs to (cross-user guard). */
export function rememberClassroomUser(userId: string): void {
  writeStorage(LAST_CLASSROOM_USER_STORAGE_KEY, userId)
}

/** True when the persisted classroom belongs to the given user. */
export function lastClassroomBelongsToUser(userId: string): boolean {
  return readStorage(LAST_CLASSROOM_USER_STORAGE_KEY) === userId
}

export interface ClassroomChangeDetail {
  classroomId: string
}

export function isClassroomChangeEvent(
  event: Event,
): event is CustomEvent<ClassroomChangeDetail> {
  return (
    event instanceof CustomEvent &&
    typeof (event as CustomEvent<ClassroomChangeDetail>).detail?.classroomId === "string"
  )
}
