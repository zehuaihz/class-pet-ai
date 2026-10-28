"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  CLASSROOM_CHANGE_EVENT,
  resolveLastClassroomId,
  rememberClassroomId,
  type ClassroomOption,
} from "@/lib/last-classroom"

interface ClassSwitcherProps {
  classrooms: ClassroomOption[]
  currentClassroomId?: string | null
}

function isClassroomScopedPath(pathname: string): boolean {
  return pathname.startsWith("/classrooms/") && !pathname.startsWith("/classrooms/new")
}

function nextClassroomPath(pathname: string, nextClassroomId: string) {
  return pathname.replace(/\/classrooms\/[^/]+/, `/classrooms/${nextClassroomId}`)
}

export function ClassSwitcher({ classrooms, currentClassroomId }: ClassSwitcherProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [value, setValue] = useState(
    currentClassroomId ?? resolveLastClassroomId(classrooms) ?? "",
  )

  useEffect(() => {
    // Prefer the URL-scoped classroom, then the persisted last class, then the
    // first classroom so the select always reflects the active context.
    const resolved =
      currentClassroomId ?? resolveLastClassroomId(classrooms) ?? classrooms[0]?.id ?? ""
    setValue(resolved)
  }, [classrooms, currentClassroomId])

  function handleChange(nextClassroomId: string) {
    setValue(nextClassroomId)
    rememberClassroomId(nextClassroomId)

    // On classroom-scoped routes, rewrite the URL so the sub-page (AI, points,
    // ...) reloads for the new class. Elsewhere (e.g. /dashboard) stay put and
    // let the page react to the broadcast event.
    if (isClassroomScopedPath(pathname)) {
      router.push(nextClassroomPath(pathname, nextClassroomId))
    }
  }

  // Keep the select in sync when another page broadcasts a class change.
  useEffect(() => {
    function handleExternalChange(event: Event) {
      const detail = (event as CustomEvent<{ classroomId: string }>).detail
      if (detail?.classroomId) setValue(detail.classroomId)
    }
    window.addEventListener(CLASSROOM_CHANGE_EVENT, handleExternalChange)
    return () => window.removeEventListener(CLASSROOM_CHANGE_EVENT, handleExternalChange)
  }, [])

  if (classrooms.length === 0) return null

  return (
    <label className="sticker-tight flex items-center gap-2 bg-white px-3 py-1.5 text-sm">
      <span aria-hidden="true">🏫</span>
      <select aria-label="班级切换器" value={value} onChange={(event) => handleChange(event.target.value)} className="max-w-[9rem] cursor-pointer bg-transparent font-semibold text-ink outline-none">
        {classrooms.map((classroom) => (
          <option key={classroom.id} value={classroom.id}>{classroom.name}</option>
        ))}
      </select>
    </label>
  )
}
