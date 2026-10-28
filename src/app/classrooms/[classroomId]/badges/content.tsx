"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { HonorTabs } from "@/components/classrooms/HonorTabs"
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
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rise-in flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display flex items-center gap-2 text-3xl font-bold text-ink"><span aria-hidden="true">🏅</span>荣誉墙</h1>
            <p className="mt-1 text-sm text-ink-soft">宠物养到满级毕业即自动获得徽章；徽章可在小卖部兑换奖励。</p>
          </div>
          <HonorTabs />
        </div>
        {error ? <div className="sticker sticker-quiet !border-berry bg-berry-soft p-3 text-sm font-semibold text-berry">{error}</div> : null}
        {loading ? <div className="sticker sticker-quiet animate-pulse p-6 text-ink-soft">加载中...</div> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => (
            <section key={item.student.id} className={`sticker sticker-hover rise-in stagger-${Math.min(index + 1, 6)} p-5`}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-display truncate text-lg font-bold text-ink">{item.student.name}</div>
                <div className="shrink-0 rounded-full border-2 border-ink bg-butter px-2.5 py-0.5 text-xs font-bold text-ink shadow-sticker-sm">
                  🏅 可用 <span className="text-sm">{item.available}</span> / {item.total}
                </div>
              </div>
              {item.badges.length === 0 ? (
                <div className="mt-4 rounded-xl border-2 border-dashed border-ink/25 bg-paper-deep/50 p-4 text-center text-sm text-ink-faint">还没有养成毕业的宠物</div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.badges.map((badge) => (
                    <div
                      key={badge.id}
                      title={badge.consumedAt ? `已于兑换消耗` : undefined}
                      className={`inline-flex flex-col items-center rounded-xl border-2 p-3 transition ${badge.status === "CONSUMED" ? "border-ink/10 bg-paper-deep opacity-50" : "border-ink bg-butter-soft shadow-sticker-sm hover:-translate-y-0.5"}`}
                    >
                      <span className={`text-3xl ${badge.status === "CONSUMED" ? "grayscale" : ""}`}>{badge.status === "CONSUMED" ? "⚪" : "🏅"}</span>
                      <span className="mt-1 max-w-28 truncate text-xs font-semibold text-ink">{badge.name}</span>
                      <span className={`text-[10px] font-bold ${badge.status === "CONSUMED" ? "text-ink-faint" : "text-tangerine"}`}>{badge.status === "CONSUMED" ? "已消耗" : "可用"}</span>
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
