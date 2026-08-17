"use client"

import Link from "next/link"
import { ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ClassSwitcher } from "@/components/classrooms/ClassSwitcher"
import { resolveLastClassroomId, type ClassroomOption } from "@/lib/last-classroom"

const baseNav = [
  { href: "/dashboard", label: "教师面板" },
  { href: "/classrooms", label: "班级" },
]

// 班级子模块：合并徽章墙+光荣榜为荣誉墙；数据台账与班级大屏从侧栏移入设置/列表入口。
const classroomNav = [
  { key: "zoo", label: "动物园", href: (id: string) => `/classrooms/${id}/zoo` },
  { key: "students", label: "学生管理", href: (id: string) => `/classrooms/${id}/students` },
  { key: "points", label: "积分管理", href: (id: string) => `/classrooms/${id}/points` },
  { key: "honor", label: "荣誉墙", href: (id: string) => `/classrooms/${id}/badges` },
  { key: "rewards", label: "小卖部", href: (id: string) => `/classrooms/${id}/rewards` },
  { key: "settings", label: "设置", href: (id: string) => `/classrooms/${id}/settings` },
]

type NavItem = { href: string; label: string }
type UserRole = "teacher" | "student" | "parent" | "admin"

// 精确匹配的顶级路由，避免子路由（如 /student/rewards）连带高亮父级。
const EXACT_ROUTES = new Set(["/dashboard", "/classrooms", "/student", "/parent"])

function NavLinkList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <div className="space-y-1">
      {items.map((item) => {
        const active = EXACT_ROUTES.has(item.href) ? pathname === item.href : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`block rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-100 ${active ? "bg-green-50 font-medium text-green-700" : ""}`}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([])
  const [systemName, setSystemName] = useState("班级动物园")
  const [role, setRole] = useState<UserRole>("teacher")
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const wasOpenRef = useRef(false)

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
    // 角色感知导航：学生/家长只见各自入口，不显示教师侧栏。
    // 请求失败时保持默认教师导航（e2e 未 mock /me 时即如此，零影响）。
    fetch("/api/v1/me")
      .then(async (response) => {
        if (!response.ok) return
        const payload = await response.json()
        const userRole = payload?.data?.role
        setRole(userRole === "STUDENT" ? "student" : userRole === "PARENT" ? "parent" : userRole === "ADMIN" ? "admin" : "teacher")
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

  const navItems = useMemo<NavItem[]>(() => {
    if (role === "student") {
      return [
        { href: "/student", label: "首页" },
        { href: "/student/rewards", label: "小卖部" },
      ]
    }
    if (role === "parent") return [{ href: "/parent", label: "家长端" }]
    if (role === "admin") {
      return [
        { href: "/admin", label: "用户管理" },
        ...baseNav,
        ...(currentClassroomId ? classroomNav.map((item) => ({ href: item.href(currentClassroomId), label: item.label })) : []),
      ]
    }
    return currentClassroomId
      ? [...baseNav, ...classroomNav.map((item) => ({ href: item.href(currentClassroomId), label: item.label }))]
      : baseNav
  }, [role, currentClassroomId])

  // 抽屉打开时：Escape 关闭、锁定背景滚动、焦点移入抽屉。
  useEffect(() => {
    if (!mobileNavOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    document.body.style.overflow = "hidden"
    drawerRef.current?.focus()
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [mobileNavOpen])

  // 路由变化即关闭抽屉（点击链接 / 系统名 / 登出 push 等）。
  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  // 抽屉从打开变为关闭时，把焦点还给汉堡按钮，避免焦点丢失到 body。
  useEffect(() => {
    if (wasOpenRef.current && !mobileNavOpen) toggleRef.current?.focus()
    wasOpenRef.current = mobileNavOpen
  }, [mobileNavOpen])

  const canManageClass = role === "teacher" || role === "admin"

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              ref={toggleRef}
              type="button"
              id="mobile-nav-toggle"
              aria-label="打开导航菜单"
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-nav"
              className="shrink-0 rounded-lg border px-2.5 py-2 lg:hidden"
              onClick={() => setMobileNavOpen(true)}
            >
              ☰
            </button>
            <Link href="/dashboard" className="truncate text-lg font-bold text-slate-900 sm:text-xl">
              {systemName} 🐾
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {canManageClass && <ClassSwitcher classrooms={classrooms} currentClassroomId={currentClassroomId} />}
            <button className="hidden rounded-lg border px-3 py-2 text-sm lg:block" onClick={handleLogout}>退出登录</button>
          </div>
        </div>
      </header>
      <div className="flex">
        <nav className="hidden min-h-[calc(100vh-65px)] w-52 border-r bg-white p-4 lg:block lg:w-56" aria-label="主导航">
          <NavLinkList items={navItems} />
        </nav>

        {/* 移动端抽屉：常驻 DOM，通过 inert 在关闭时移出可交互与无障碍树 */}
        <div
          ref={drawerRef}
          id="mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="主导航"
          inert={!mobileNavOpen}
          tabIndex={-1}
          className={`fixed inset-0 z-50 lg:hidden ${mobileNavOpen ? "" : "pointer-events-none"}`}
        >
          <div
            aria-hidden="true"
            onClick={() => setMobileNavOpen(false)}
            className={`absolute inset-0 bg-black/40 transition-opacity ${mobileNavOpen ? "opacity-100" : "opacity-0"}`}
          />
          <nav
            aria-label="移动端导航"
            className={`absolute left-0 top-0 flex h-full w-64 max-w-[80vw] flex-col overflow-y-auto bg-white p-4 shadow-xl transition-transform ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}
          >
            <NavLinkList items={navItems} onNavigate={() => setMobileNavOpen(false)} />
            <div className="mt-6 border-t pt-4">
              <button className="w-full rounded-lg border px-3 py-2 text-left text-sm" onClick={handleLogout}>退出登录</button>
            </div>
          </nav>
        </div>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
