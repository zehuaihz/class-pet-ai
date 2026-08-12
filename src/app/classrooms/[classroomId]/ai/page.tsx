"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"

type DashboardPayload = {
  topStudents: Array<{ id: string; name: string; totalPoints: number }>
  activeTasks: Array<{ id: string; title: string }>
  zoo: { graduatedCount: number; growingCount: number; availableBadges: number }
}

export default function AiWorkbenchPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId ?? "1"
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const response = await fetch(`/api/v1/classrooms/${classroomId}/dashboard`)
        if (!response.ok) throw new Error("load failed")
        const payload = await response.json()
        setDashboard(payload.data)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [classroomId])

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">AI 教辅工作台</h1>
          <p className="text-slate-600">生成评语草稿、班情总结和打卡任务，不自动外发。</p>
        </div>
        {loading ? <div className="rounded-lg bg-white p-5 shadow-sm">加载中...</div> : null}
        <section className="grid gap-4 md:grid-cols-3">
          <Link href={`/classrooms/${classroomId}/ai/comment`} className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="font-semibold">评语生成</div>
            <div className="mt-2 text-sm text-slate-500">基于积分和打卡生成学生评语草稿</div>
          </Link>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="font-semibold">班情总结</div>
            <div className="mt-2 text-sm text-slate-500">宠物在养 {dashboard?.zoo.growingCount ?? 0} 只 · 毕业 {dashboard?.zoo.graduatedCount ?? 0} 只</div>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="font-semibold">任务生成</div>
            <div className="mt-2 text-sm text-slate-500">当前活跃任务 {dashboard?.activeTasks.length ?? 0} 个</div>
          </div>
        </section>
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">AI 推荐对象</h2>
          <div className="mt-4 space-y-3">
            {(dashboard?.topStudents ?? []).map((student) => (
              <div key={student.id} className="rounded-lg border p-3">
                <div className="font-medium">{student.name}</div>
                <div className="text-sm text-slate-500">{student.totalPoints} 分</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
