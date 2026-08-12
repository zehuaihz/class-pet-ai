"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">光荣榜</h1>
          <p className="text-slate-600">按持有徽章数量排序，徽章来自宠物满级毕业。</p>
        </div>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
        {loading ? <div className="rounded-lg bg-white p-5 text-slate-500 shadow-sm">加载中...</div> : null}

        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          {rows.map((row, index) => (
            <div key={row.student.id} className={`flex items-center gap-4 px-5 py-3 ${index > 0 ? "border-t" : ""} ${index < 3 ? "bg-amber-50/60" : ""}`}>
              <div className="w-10 text-center text-xl">{MEDALS[index] ?? `${index + 1}`}</div>
              {row.pet ? (
                <div className="flex w-16 items-center justify-center">
                  <PetVisual speciesKey={row.pet.speciesKey} level={row.pet.level} size="text-3xl" />
                </div>
              ) : (
                <div className="flex w-16 items-center justify-center text-3xl">🐾</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{row.student.name}</div>
                <div className="text-xs text-slate-500">
                  {row.pet ? `${row.pet.speciesName} · Lv.${row.pet.level} · 累计食物 ${row.pet.growthValue}` : "未分配宠物"}
                </div>
              </div>
              {row.pet ? (
                <div className="hidden w-32 sm:block">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.round(row.pet.progressRatio * 100)}%` }} />
                  </div>
                </div>
              ) : null}
              <div className="w-20 text-right">
                <div className="text-2xl font-bold text-amber-500">{row.badgeCount}</div>
                <div className="text-[10px] text-slate-400">徽章</div>
              </div>
            </div>
          ))}
        </div>
        {!loading && rows.length === 0 ? <div className="rounded-lg bg-white p-5 text-slate-500 shadow-sm">暂无学生</div> : null}
      </div>
    </AppShell>
  )
}
