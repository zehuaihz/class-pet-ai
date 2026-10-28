"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { HonorTabs } from "@/components/classrooms/HonorTabs"
import { PetVisual } from "@/components/pets/PetVisual"
import { apiRequest } from "@/lib/api-client"

interface GloryRow {
  student: { id: string; name: string; avatarUrl?: string | null }
  badgeCount: number
  pet: {
    name: string
    speciesKey: string
    speciesName: string
    visualKey: string
    level: number
    growthValue: number
    progressRatio: number
    graduated: boolean
  } | null
}

const MEDALS = ["🥇", "🥈", "🥉"]

export default function LeaderboardPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId ?? "1"
  const [rows, setRows] = useState<GloryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiRequest<{ items: GloryRow[] }>(`/api/v1/classrooms/${classroomId}/leaderboard`)
      .then((data) => setRows(data.items))
      .catch(() => setError("加载光荣榜失败"))
      .finally(() => setLoading(false))
  }, [classroomId])

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rise-in flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display flex items-center gap-2 text-3xl font-bold text-ink"><span aria-hidden="true">🏆</span>光荣榜</h1>
            <p className="mt-1 text-sm text-ink-soft">按持有徽章数量排序，徽章来自宠物满级毕业。</p>
          </div>
          <HonorTabs />
        </div>
        {error ? <div className="sticker sticker-quiet !border-berry bg-berry-soft p-3 text-sm font-semibold text-berry">{error}</div> : null}
        {loading ? <div className="sticker sticker-quiet animate-pulse p-6 text-ink-soft">加载中...</div> : null}

        <div className="sticker sticker-quiet overflow-hidden rise-in stagger-2">
          {rows.map((row, index) => (
            <div key={row.student.id} className={`flex items-center gap-4 px-5 py-3.5 ${index > 0 ? "border-t-2 border-dashed border-ink/20" : ""} ${index === 0 ? "bg-butter-soft" : index < 3 ? "bg-butter-soft/50" : ""}`}>
              <div className="sticker-dot w-10 shrink-0 !h-8 !w-8 text-sm" aria-hidden="true">
                <span className={index >= 3 ? "font-display" : ""}>{MEDALS[index] ?? index + 1}</span>
              </div>
              {row.pet ? (
                <div className="flex w-14 shrink-0 items-center justify-center">
                  <PetVisual speciesKey={row.pet.speciesKey} level={row.pet.level} size="text-3xl" />
                </div>
              ) : (
                <div className="flex w-14 shrink-0 items-center justify-center text-3xl opacity-40">🐾</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-display truncate text-lg font-bold text-ink">{row.student.name}</div>
                <div className="truncate text-xs text-ink-soft">
                  {row.pet ? `${row.pet.speciesName} · Lv.${row.pet.level} · 累计食物 ${row.pet.growthValue}` : "未分配宠物"}
                </div>
              </div>
              {row.pet ? (
                <div className="hidden w-32 shrink-0 sm:block">
                  <div className="h-2.5 overflow-hidden rounded-full border-2 border-ink bg-white">
                    <div className="h-full rounded-full bg-forest" style={{ width: `${Math.round(row.pet.progressRatio * 100)}%` }} />
                  </div>
                </div>
              ) : null}
              <div className="w-16 shrink-0 text-right">
                <div className="font-display text-2xl font-bold text-tangerine">{row.badgeCount}</div>
                <div className="text-[10px] font-bold text-ink-faint">徽章</div>
              </div>
            </div>
          ))}
        </div>
        {!loading && rows.length === 0 ? <div className="sticker sticker-quiet p-8 text-center text-ink-soft">暂无学生</div> : null}
      </div>
    </AppShell>
  )
}
