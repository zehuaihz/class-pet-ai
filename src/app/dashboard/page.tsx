"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { AppShell } from "@/components/layout/AppShell"
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
      const dashboardResponse = await fetch(`/api/v1/classrooms/${classroomId}/dashboard`)
      if (!dashboardResponse.ok) throw new Error("dashboard load failed")
      const dashboardPayload = await dashboardResponse.json()
      setDashboard(dashboardPayload.data)
    } catch {
      setError("加载 Dashboard 失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const classroomResponse = await fetch("/api/v1/classrooms")
        if (!classroomResponse.ok) throw new Error("classrooms load failed")
        const classroomPayload = await classroomResponse.json()
        const classroomItems: ClassroomOption[] = classroomPayload.data.items ?? []
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

  const classroomId = selectedClassroomId ?? "1"

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">教师 Dashboard</h1>
          <p className="mt-1 text-slate-600">今日班级状态、快捷加分、打卡和宠物成长入口。</p>
        </div>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
        {loading ? <div className="rounded-lg bg-white p-5 shadow-sm">加载中...</div> : null}
        <section className="grid gap-4 md:grid-cols-4">
          {[
            ["打卡率", dashboard ? `${Math.round(dashboard.today.checkinRate * 100)}%` : "--"],
            ["今日加分", dashboard ? `${dashboard.today.pointCount}` : "--"],
            ["待补卡", dashboard ? `${dashboard.today.missedCount}` : "--"],
            ["宠物等级", dashboard ? `Lv.${dashboard.pet.level}` : "--"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white p-5 shadow-sm">
              <div className="text-sm text-slate-500">{label}</div>
              <div className="mt-2 text-3xl font-bold text-slate-900">{value}</div>
            </div>
          ))}
        </section>
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="font-semibold">快捷操作</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/classrooms/new" className="rounded-lg bg-green-600 px-4 py-2 text-white">创建班级</Link>
              <Link href="/classrooms" className="rounded-lg border px-4 py-2">班级列表</Link>
              <Link href={`/classrooms/${classroomId}/students`} className="rounded-lg border px-4 py-2">学生管理</Link>
              <Link href={`/classrooms/${classroomId}/points`} className="rounded-lg border px-4 py-2">积分管理</Link>
            </div>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="font-semibold">最近动态</h2>
            <div className="mt-4 space-y-3">
              {(dashboard?.recentTransactions ?? []).map((action) => (
                <div key={action.id} className="rounded-lg border px-3 py-2 text-slate-700">{action.reason} · +{action.delta}</div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
