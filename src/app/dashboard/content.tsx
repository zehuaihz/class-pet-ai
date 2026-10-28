"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { AppShell } from "@/components/layout/AppShell"
import { apiRequest } from "@/lib/api-client"
import {
  CLASSROOM_CHANGE_EVENT,
  resolveLastClassroomId,
  type ClassroomOption,
} from "@/lib/last-classroom"

type DashboardPayload = {
  today: { checkinRate: number; pointCount: number; missedCount: number }
  pet: { name: string; level: number }
  topStudents: Array<{ id: string; name: string; totalPoints: number }>
  activeTasks: Array<{ id: string; title: string }>
  recentTransactions: Array<{ id: string; reason: string; delta: number }>
}

const stats = [
  { key: "checkinRate", label: "今日打卡率", icon: "📅", accent: "bg-sky-soft", text: "text-sky" },
  { key: "pointCount", label: "今日加分", icon: "✨", accent: "bg-tangerine-soft", text: "text-tangerine" },
  { key: "missedCount", label: "待补卡", icon: "📮", accent: "bg-berry-soft", text: "text-berry" },
  { key: "petLevel", label: "宠物等级", icon: "🐾", accent: "bg-forest-mist", text: "text-forest" },
] as const

export default function DashboardPage() {
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([])
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = useCallback(async (classroomId: string | null) => {
    setLoading(true)
    setError(null)
    if (!classroomId) {
      setDashboard(null)
      setLoading(false)
      return
    }

    try {
      const dashboardData = await apiRequest<DashboardPayload>(`/api/v1/classrooms/${classroomId}/dashboard`)
      setDashboard(dashboardData)
    } catch {
      setError("加载 Dashboard 失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const classroomData = await apiRequest<{ items: ClassroomOption[] }>("/api/v1/classrooms")
        const classroomItems = classroomData.items
        setClassrooms(classroomItems)
        const classroomId = resolveLastClassroomId(classroomItems)
        setSelectedClassroomId(classroomId)
        await loadDashboard(classroomId)
      } catch {
        setError("加载 Dashboard 失败")
        setLoading(false)
      }
    }

    load()
  }, [loadDashboard])

  // Sync with class switches made anywhere in the app (e.g. from the header
  // switcher) so the dashboard stays on the selected class without navigating.
  useEffect(() => {
    function handleClassroomChange(event: Event) {
      const detail = (event as CustomEvent<{ classroomId: string }>).detail
      if (!detail?.classroomId) return
      if (!classrooms.some((classroom) => classroom.id === detail.classroomId)) return
      setSelectedClassroomId(detail.classroomId)
      loadDashboard(detail.classroomId)
    }
    window.addEventListener(CLASSROOM_CHANGE_EVENT, handleClassroomChange)
    return () => window.removeEventListener(CLASSROOM_CHANGE_EVENT, handleClassroomChange)
  }, [classrooms, loadDashboard])

  const statValues: Record<string, string> = {
    checkinRate: dashboard ? `${Math.round(dashboard.today.checkinRate * 100)}%` : "--",
    pointCount: dashboard ? `${dashboard.today.pointCount}` : "--",
    missedCount: dashboard ? `${dashboard.today.missedCount}` : "--",
    petLevel: dashboard ? `Lv.${dashboard.pet.level}` : "--",
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rise-in">
          <h1 className="font-display text-3xl font-bold text-ink">教师手册</h1>
          <p className="mt-1 text-sm text-ink-soft">今日班级状态、快捷加分、打卡和宠物成长入口。</p>
        </div>

        {error ? <div className="sticker sticker-quiet !border-berry bg-berry-soft p-3 text-sm font-semibold text-berry">{error}</div> : null}

        {loading ? (
          <div className="sticker sticker-quiet animate-pulse p-6 text-ink-soft">翻开手册中…</div>
        ) : null}

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <div key={stat.key} className={`sticker sticker-hover rise-in stagger-${index + 1} p-4 sm:p-5`}>
              <div className="flex items-center gap-2">
                <span className={`sticker-dot ${stat.accent} !h-8 !w-8 text-base`} aria-hidden="true">{stat.icon}</span>
                <span className="text-xs font-semibold tracking-wide text-ink-soft sm:text-sm">{stat.label}</span>
              </div>
              <div className={`font-display mt-3 text-3xl font-bold sm:text-4xl ${stat.text}`}>{statValues[stat.key]}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="sticker sticker-quiet rise-in stagger-5 p-5">
            <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink">
              <span aria-hidden="true">🔖</span>快捷操作
            </h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/classrooms/new" className="btn-tangerine">🌱 创建班级</Link>
              <Link href="/classrooms" className="btn-outline">🏫 班级列表</Link>
              {selectedClassroomId ? (
                <>
                  <Link href={`/classrooms/${selectedClassroomId}/students`} className="btn-outline">🧒 学生管理</Link>
                  <Link href={`/classrooms/${selectedClassroomId}/points`} className="btn-outline">✨ 积分管理</Link>
                  <Link href={`/classrooms/${selectedClassroomId}/zoo`} className="btn-outline">🐾 动物园</Link>
                </>
              ) : (
                <span className="rounded-xl border-2 border-dashed border-ink/40 px-4 py-2 text-sm text-ink-faint">请先创建班级</span>
              )}
            </div>
          </div>

          <div className="sticker sticker-quiet rise-in stagger-6 p-5">
            <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink">
              <span aria-hidden="true">📜</span>最近动态
            </h2>
            <div className="mt-4 space-y-2.5">
              {(dashboard?.recentTransactions ?? []).length === 0 ? (
                <p className="rounded-xl border-2 border-dashed border-ink/30 px-4 py-6 text-center text-sm text-ink-faint">今天还没有新的积分记录</p>
              ) : (
                (dashboard?.recentTransactions ?? []).map((action) => (
                  <div key={action.id} className="flex items-center justify-between gap-3 rounded-xl border-2 border-ink/15 bg-paper px-3 py-2 text-sm text-ink">
                    <span className="truncate">{action.reason}</span>
                    <span className={`font-display shrink-0 text-base font-bold ${action.delta >= 0 ? "text-forest" : "text-berry"}`}>
                      {action.delta >= 0 ? `+${action.delta}` : action.delta}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
