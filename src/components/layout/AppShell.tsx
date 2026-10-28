"use client"

import Link from "next/link"
import { ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ClassSwitcher } from "@/components/classrooms/ClassSwitcher"
import { resolveLastClassroomId, type ClassroomOption } from "@/lib/last-classroom"

const baseNav = [
  { href: "/dashboard", label: "首页" },
  { href: "/classrooms", label: "班级" },
]

// 班级子模块：动物园/荣誉墙/小卖部来自 zoo 体系；打卡任务与 AI 工作台为 ai_generate 独有模块。
const classroomNav = [
  { key: "zoo", label: "动物园", href: (id: string) => `/classrooms/${id}/zoo`, icon: "🐾" },
  { key: "students", label: "学生管理", href: (id: string) => `/classrooms/${id}/students`, icon: "🧒" },
  { key: "points", label: "积分管理", href: (id: string) => `/classrooms/${id}/points`, icon: "✨" },
  { key: "checkins", label: "打卡任务", href: (id: string) => `/classrooms/${id}/checkins`, icon: "📅" },
  { key: "honor", label: "荣誉墙", href: (id: string) => `/classrooms/${id}/badges`, icon: "🏅" },
  { key: "rewards", label: "小卖部", href: (id: string) => `/classrooms/${id}/rewards`, icon: "🛍️" },
  { key: "ai", label: "AI 工作台", href: (id: string) => `/classrooms/${id}/ai`, icon: "🤖" },
]

// 设置下挂管理类二级菜单。
const settingsSubNav = [
  { key: "audit", label: "数据台账", href: (id: string) => `/classrooms/${id}/audit` },
  { key: "screen", label: "班级大屏", href: (id: string) => `/classrooms/${id}/screen` },
]

type NavItem = { href: string; label: string; icon?: string; children?: NavItem[] }
type UserRole = "teacher" | "student" | "parent" | "admin"

// 精确匹配的顶级路由，避免子路由（如 /student/rewards）连带高亮父级。
const EXACT_ROUTES = new Set(["/dashboard", "/classrooms", "/student", "/parent"])

function NavLinkList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <div className="space-y-1.5">
      {items.map((item, index) => {
        const childActive = item.children?.some((child) => (EXACT_ROUTES.has(child.href) ? pathname === child.href : pathname.startsWith(child.href))) ?? false
        const active = EXACT_ROUTES.has(item.href) ? pathname === item.href : pathname.startsWith(item.href) || childActive
        return (
          <div key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={pathname === item.href ? "page" : undefined}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 transition ${
                active
                  ? `border-2 border-ink bg-butter font-semibold text-ink shadow-sticker-sm ${index % 2 === 0 ? "tag-tilt-a" : "tag-tilt-b"}`
                  : "border-2 border-transparent font-medium text-ink-soft hover:border-ink hover:bg-paper-deep hover:text-ink"
              }`}
            >
              {item.icon ? <span aria-hidden="true" className="text-base leading-none">{item.icon}</span> : null}
              <span>{item.label}</span>
            </Link>
            {item.children && active ? (
              <nav aria-label={`${item.label}二级菜单`} className="mt-1 space-y-1 border-l-2 border-dashed border-ink/30 pl-4">
                {item.children.map((child) => {
                  const childActive = EXACT_ROUTES.has(child.href) ? pathname === child.href : pathname.startsWith(child.href)
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onNavigate}
                      aria-current={childActive ? "page" : undefined}
                      className={`block rounded-lg px-3 py-1.5 text-sm transition ${
                        childActive
                          ? "border-2 border-ink bg-butter font-semibold text-ink shadow-sticker-sm"
                          : "font-medium text-ink-soft hover:bg-paper-deep hover:text-ink"
                      }`}
                    >
                      {child.label}
                    </Link>
                  )
                })}
              </nav>
            ) : null}
          </div>
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
    if (match?.[1]) return match?.[1]
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
        { href: "/student", label: "我的信息", icon: "🎒" },
        { href: "/student/checkins", label: "我的打卡", icon: "📅" },
        { href: "/student/rewards", label: "小卖部", icon: "🛍️" },
      ]
    }
    if (role === "parent") return [{ href: "/parent", label: "家长端", icon: "🏡" }]
    if (!currentClassroomId) return role === "admin" ? [{ href: "/admin", label: "管理后台", icon: "🛠️" }, ...baseNav] : baseNav

    const settingsChildren = [
      ...settingsSubNav.map((item) => ({ href: item.href(currentClassroomId), label: item.label })),
      ...(role === "admin" ? [{ href: "/admin", label: "管理后台" }] : []),
    ]
    const settingsItem = { href: `/classrooms/${currentClassroomId}/settings`, label: "设置", icon: "⚙️", children: settingsChildren }

    return [
      ...baseNav,
      ...classroomNav.map((item) => ({ href: item.href(currentClassroomId), label: item.label, icon: item.icon })),
      settingsItem,
    ]
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
    <div className="min-h-screen">
      <header className="border-b-2 border-ink bg-paper-deep px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              ref={toggleRef}
              type="button"
              id="mobile-nav-toggle"
              aria-label="打开导航菜单"
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-nav"
              className="sticker-tight shrink-0 bg-white px-2.5 py-1.5 text-base font-bold transition hover:bg-butter active:translate-x-0.5 active:translate-y-0.5 active:shadow-none lg:hidden"
              onClick={() => setMobileNavOpen(true)}
            >
              ☰
            </button>
            <Link href="/dashboard" className="font-display group flex truncate items-center gap-2 text-xl font-bold text-ink sm:text-2xl">
              <span aria-hidden="true" className="inline-block transition-transform group-hover:-rotate-12">🐾</span>
              <span className="truncate">{systemName}</span>
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {canManageClass && <ClassSwitcher classrooms={classrooms} currentClassroomId={currentClassroomId} />}
            <button className="btn-outline hidden !px-3 !py-1.5 text-sm lg:inline-flex" onClick={handleLogout}>退出登录</button>
          </div>
        </div>
      </header>
      <div className="flex">
        <nav className="hidden min-h-[calc(100vh-69px)] w-56 border-r-2 border-ink bg-paper-deep/60 p-4 lg:block" aria-label="主导航">
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
            className={`absolute inset-0 bg-ink/40 transition-opacity ${mobileNavOpen ? "opacity-100" : "opacity-0"}`}
          />
          <nav
            aria-label="移动端导航"
            className={`absolute left-0 top-0 flex h-full w-72 max-w-[80vw] flex-col overflow-y-auto border-r-2 border-ink bg-paper p-4 shadow-sticker-lg transition-transform ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}
          >
            <Link href="/dashboard" className="font-display mb-4 flex items-center gap-2 text-xl font-bold text-ink">
              <span aria-hidden="true">🐾</span>
              <span>{systemName}</span>
            </Link>
            <NavLinkList items={navItems} onNavigate={() => setMobileNavOpen(false)} />
            <div className="mt-6 border-t-2 border-dashed border-ink/30 pt-4">
              <button className="btn-outline w-full" onClick={handleLogout}>退出登录</button>
            </div>
          </nav>
        </div>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
