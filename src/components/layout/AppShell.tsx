"use client"

import Link from "next/link"
import { ReactNode, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ClassSwitcher } from "@/components/classrooms/ClassSwitcher"
import { resolveLastClassroomId, type ClassroomOption } from "@/lib/last-classroom"

const baseNav = [
  { href: "/dashboard", label: "首页" },
  { href: "/classrooms", label: "班级" },
]

const classroomNav = [
  { key: "zoo", label: "动物园", href: (id: string) => `/classrooms/${id}/zoo` },
  { key: "students", label: "学生管理", href: (id: string) => `/classrooms/${id}/students` },
  { key: "points", label: "积分管理", href: (id: string) => `/classrooms/${id}/points` },
  { key: "badges", label: "徽章墙", href: (id: string) => `/classrooms/${id}/badges` },
  { key: "leaderboard", label: "光荣榜", href: (id: string) => `/classrooms/${id}/leaderboard` },
  { key: "rewards", label: "小卖部", href: (id: string) => `/classrooms/${id}/rewards` },
  { key: "audit", label: "数据台账", href: (id: string) => `/classrooms/${id}/audit` },
  { key: "settings", label: "设置", href: (id: string) => `/classrooms/${id}/settings` },
  { key: "screen", label: "班级大屏", href: (id: string) => `/classrooms/${id}/screen` },
]

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([])
  const [systemName, setSystemName] = useState("班级动物园")

  useEffect(() => {
    fetch("/api/v1/classrooms")
      .then(async (response) => {
        if (!response.ok) return
        const payload = await response.json()
        setClassrooms(payload.data.items ?? [])
      })
      .catch(() => undefined)
    fetch("/api/v1/system-settings")
      .then(async (response) => {
        if (!response.ok) return
        const payload = await response.json()
        setSystemName(payload.data.name ?? "班级动物园")
      })
      .catch(() => undefined)
  }, [])

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

  const navItems = currentClassroomId
    ? [...baseNav, ...classroomNav.map((item) => ({ href: item.href(currentClassroomId), label: item.label }))]
    : baseNav

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link href="/dashboard" className="text-xl font-bold text-slate-900">
            {systemName} 🐾
          </Link>
          <div className="flex items-center gap-3">
            <ClassSwitcher classrooms={classrooms} currentClassroomId={currentClassroomId} />
            <button className="rounded-lg border px-3 py-2 text-sm" onClick={handleLogout}>退出登录</button>
          </div>
        </div>
      </header>
      <div className="flex">
        <nav className="min-h-[calc(100vh-65px)] w-52 border-r bg-white p-4 lg:w-56" aria-label="主导航">
          <div className="space-y-1">
            {navItems.map((item) => {
              const active = item.href === "/dashboard" || item.href === "/classrooms"
                ? pathname === item.href
                : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-100 ${active ? "bg-green-50 font-medium text-green-700" : ""}`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </nav>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
