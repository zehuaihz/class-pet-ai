"use client"

import Link from "next/link"
import { ReactNode, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ClassSwitcher } from "@/components/classrooms/ClassSwitcher"
import { resolveLastClassroomId, type ClassroomOption } from "@/lib/last-classroom"

// Navigation is a convenience layer only — access control lives in the
// server-side page guards and API route guards.
const navItems = [
  { href: "/dashboard", label: "首页", roles: ["TEACHER"] },
  { href: "/classrooms", label: "班级", roles: ["TEACHER"] },
  { href: "/student", label: "我的信息", roles: ["STUDENT"] },
  { href: "/student/checkins", label: "我的打卡", roles: ["STUDENT"] },
  { href: "/student/rewards", label: "奖励兑换", roles: ["STUDENT"] },
  { href: "/parent", label: "家长端", roles: ["PARENT"] },
  { href: "/admin", label: "管理后台", roles: ["ADMIN"] },
]

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([])
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/v1/me")
      .then(async (response) => {
        if (!response.ok) return
        const payload = await response.json()
        setRole(payload.data?.role ?? null)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (role !== "TEACHER") return
    fetch("/api/v1/classrooms")
      .then(async (response) => {
        if (!response.ok) return
        const payload = await response.json()
        setClassrooms(payload.data.items ?? [])
      })
      .catch(() => undefined)
  }, [role])

  const currentClassroomId = useMemo(() => {
    const match = pathname.match(/\/classrooms\/([^/]+)/)
    if (match?.[1]) return match[1]
    // On non-scoped routes (e.g. /dashboard) surface the persisted last class
    // so the switcher reflects the class the teacher is actually working with.
    return resolveLastClassroomId(classrooms)
  }, [classrooms, pathname])

  async function handleLogout() {
    await fetch("/api/v1/auth/logout", { method: "POST" })
    router.push("/auth/login")
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link href="/dashboard" className="text-xl font-bold text-slate-900">
            班级宠物积分 AI 教辅系统
          </Link>
          <div className="flex items-center gap-3">
            {role === "TEACHER" ? <ClassSwitcher classrooms={classrooms} currentClassroomId={currentClassroomId} /> : null}
            <button className="rounded-lg border px-3 py-2 text-sm" onClick={handleLogout}>退出登录</button>
          </div>
        </div>
      </header>
      <div className="flex">
        <nav className="min-h-[calc(100vh-65px)] w-56 border-r bg-white p-4" aria-label="主导航">
          <div className="space-y-2">
            {navItems.filter((item) => role !== null && item.roles.includes(role)).map((item) => (
              <Link key={item.href} href={item.href} className="block rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100">
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
