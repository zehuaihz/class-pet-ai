import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  CLASSROOM_CHANGE_EVENT,
  LAST_CLASSROOM_STORAGE_KEY,
  LAST_CLASSROOM_USER_STORAGE_KEY,
  lastClassroomBelongsToUser,
  readLastClassroomId,
  rememberClassroomId,
  rememberClassroomUser,
  resolveLastClassroomId,
} from "@/lib/last-classroom"

const classrooms = [
  { id: "class_1", name: "三年级2班" },
  { id: "class_2", name: "四年级1班" },
]

describe("last-classroom persistence", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it("returns null when nothing is persisted", () => {
    expect(readLastClassroomId()).toBeNull()
  })

  it("persists and reads back the classroom id", () => {
    rememberClassroomId("class_2")
    expect(readLastClassroomId()).toBe("class_2")
    expect(window.localStorage.getItem(LAST_CLASSROOM_STORAGE_KEY)).toBe("class_2")
  })

  it("broadcasts a classroom change event when remembered", () => {
    const handler = vi.fn()
    window.addEventListener(CLASSROOM_CHANGE_EVENT, handler)

    rememberClassroomId("class_2")

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { classroomId: "class_2" } }),
    )
    window.removeEventListener(CLASSROOM_CHANGE_EVENT, handler)
  })

  it("resolves to the persisted class when it still belongs to the teacher", () => {
    rememberClassroomId("class_2")
    expect(resolveLastClassroomId(classrooms)).toBe("class_2")
  })

  it("falls back to the first classroom when the persisted id is no longer accessible", () => {
    window.localStorage.setItem(LAST_CLASSROOM_STORAGE_KEY, "deleted_class")
    expect(resolveLastClassroomId(classrooms)).toBe("class_1")
  })

  it("falls back to the first classroom when nothing is persisted", () => {
    expect(resolveLastClassroomId(classrooms)).toBe("class_1")
  })

  it("returns null when the teacher has no classrooms", () => {
    expect(resolveLastClassroomId([])).toBeNull()
  })
})

describe("last-classroom per-user guard", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it("records and matches the owning user", () => {
    rememberClassroomUser("user_a")
    expect(lastClassroomBelongsToUser("user_a")).toBe(true)
    expect(window.localStorage.getItem(LAST_CLASSROOM_USER_STORAGE_KEY)).toBe("user_a")
  })

  it("rejects a different user", () => {
    rememberClassroomUser("user_a")
    expect(lastClassroomBelongsToUser("user_b")).toBe(false)
  })

  it("rejects when no user has been recorded", () => {
    expect(lastClassroomBelongsToUser("user_a")).toBe(false)
  })
})
