"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { apiRequest } from "@/lib/api-client"

interface BadgeView {
  id: string
  name: string
  visualKey: string
  status: "AVAILABLE" | "CONSUMED"
  earnedAt: string
  consumedAt?: string | null
}

interface BadgeWallItem {
  student: { id: string; name: string; avatarUrl?: string | null }
  total: number
  available: number
  badges: BadgeView[]
}

export default function BadgesPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId ?? "1"
  const [items, setItems] = useState<BadgeWallItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiRequest<{ items: BadgeWallItem[] }>(`/api/v1/classrooms/${classroomId}/badges`)
      .then((data) => setItems(data.items))
      .catch(() => setError("加载徽章墙失败"))
      .finally(() => setLoading(false))
  }, [classroomId])

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">徽章墙</h1>
          <p className="text-slate-600">宠物养到满级毕业即自动获得徽章；徽章可在小卖部兑换奖励。</p>
        </div>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
        {loading ? <div className="rounded-lg bg-white p-5 text-slate-500 shadow-sm">加载中...</div> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <section key={item.student.id} className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{item.student.name}</div>
                <div className="text-sm text-amber-600">
                  🏅 可用 <span className="text-lg font-bold">{item.available}</span> / 共 {item.total}
                </div>
              </div>
              {item.badges.length === 0 ? (
                <div className="mt-4 rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-400">还没有养成毕业的宠物</div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.badges.map((badge) => (
                    <div
                      key={badge.id}
                      title={badge.consumedAt ? `已于兑换消耗` : undefined}
                      className={`inline-flex flex-col items-center rounded-xl border p-3 ${badge.status === "CONSUMED" ? "border-slate-100 bg-slate-50 opacity-60" : "border-amber-100 bg-amber-50"}`}
                    >
                      <span className="text-3xl">🏅</span>
                      <span className="mt-1 max-w-28 truncate text-xs text-slate-600">{badge.name}</span>
                      <span className="text-[10px] text-slate-400">{badge.status === "CONSUMED" ? "已消耗" : "可用"}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
