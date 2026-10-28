"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"

type DashboardPayload = {
  topStudents: Array<{ id: string; name: string; totalPoints: number }>
  activeTasks: Array<{ id: string; title: string }>
  pet: { name: string; level: number }
}

export default function AiWorkbenchPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId
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
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rise-in">
          <h1 className="font-display flex items-center gap-2 text-3xl font-bold text-ink"><span aria-hidden="true">🤖</span>AI 教辅工作台</h1>
          <p className="mt-1 text-sm text-ink-soft">生成评语草稿、班情总结和打卡任务，不自动外发。</p>
        </div>
        {loading ? <div className="sticker sticker-quiet animate-pulse p-6 text-ink-soft">加载中...</div> : null}
        {!classroomId ? <div className="sticker sticker-quiet bg-butter-soft p-4 font-semibold text-tangerine">缺少班级上下文，请从班级列表进入。</div> : null}
        <section className="grid gap-4 md:grid-cols-3">
          <Link href={classroomId ? `/classrooms/${classroomId}/ai/comment` : "/classrooms"} className="sticker sticker-hover rise-in stagger-2 block p-5">
            <div className="sticker-dot bg-sky-soft" aria-hidden="true">✍️</div>
            <div className="font-display mt-3 text-lg font-bold text-ink">评语生成</div>
            <div className="mt-1 text-sm text-ink-soft">基于积分和打卡生成学生评语草稿</div>
          </Link>
          <div className="sticker sticker-hover rise-in stagger-3 p-5">
            <div className="sticker-dot bg-butter-soft" aria-hidden="true">📊</div>
            <div className="font-display mt-3 text-lg font-bold text-ink">班情总结</div>
            <div className="mt-1 text-sm text-ink-soft">班级宠物 {dashboard?.pet.name ?? "云朵龙"} Lv.{dashboard?.pet.level ?? 8}</div>
          </div>
          <div className="sticker sticker-hover rise-in stagger-4 p-5">
            <div className="sticker-dot bg-forest-mist" aria-hidden="true">📝</div>
            <div className="font-display mt-3 text-lg font-bold text-ink">任务生成</div>
            <div className="mt-1 text-sm text-ink-soft">当前活跃任务 {dashboard?.activeTasks.length ?? 0} 个</div>
          </div>
        </section>
        <section className="sticker sticker-quiet rise-in stagger-5 p-5">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">💡</span>AI 推荐对象</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(dashboard?.topStudents ?? []).map((student) => (
              <div key={student.id} className="flex items-center justify-between gap-3 rounded-xl border-2 border-ink/15 bg-white p-3">
                <div className="font-semibold text-ink">{student.name}</div>
                <div className="font-display font-bold text-forest">{student.totalPoints} 分</div>
              </div>
            ))}
            {(dashboard?.topStudents ?? []).length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-ink/30 p-6 text-center text-sm text-ink-faint sm:col-span-2 lg:col-span-3">暂无推荐数据</div>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
