"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AppShell } from "@/components/layout/AppShell"
import { PetVisual } from "@/components/pets/PetVisual"
import { apiRequest } from "@/lib/api-client"
import type { PetView } from "@/lib/zoo-types"

interface StudentSummary {
  student: {
    name: string
    totalPoints: number
    group: string | null
    classroom: { id: string; name: string }
    availableBadges: number
    pet: PetView | null
  } | null
}

export default function StudentPage() {
  const [summary, setSummary] = useState<StudentSummary["student"]>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiRequest<StudentSummary>("/api/v1/student/summary")
      .then((data) => setSummary(data.student))
      .catch(() => setError("加载学生信息失败"))
  }, [])

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">学生端</h1>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
        {summary ? (
          <>
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold">{summary.name}</div>
              <div className="mt-2 text-slate-500">{summary.classroom.name} · {summary.group ?? "未分组"} · {summary.totalPoints} 分</div>
            </div>
            <div className="rounded-xl bg-white p-6 text-center shadow-sm">
              {summary.pet ? (
                <>
                  <div className="flex justify-center">
                    <PetVisual speciesKey={summary.pet.speciesKey} level={summary.pet.level} size="text-8xl" />
                  </div>
                  <div className="mt-3 text-lg font-semibold">{summary.pet.name} <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-sm text-green-700">Lv.{summary.pet.level}</span></div>
                  <div className="mt-2 text-sm text-slate-500">
                    {summary.pet.graduated ? "已毕业 🎓，可以领养新宠物" : `累计食物 ${summary.pet.growthValue}`}
                  </div>
                  {!summary.pet.graduated && summary.pet.nextThreshold != null ? (
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.round(summary.pet.progressRatio * 100)}%` }} />
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="py-6 text-slate-400">还没有宠物</div>
              )}
            </div>
            <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
              <span className="text-slate-600">🏅 我的徽章</span>
              <span className="text-lg font-bold text-amber-600">{summary.availableBadges}</span>
            </div>
            <Link href="/student/rewards" className="block rounded-xl bg-green-600 p-4 text-center text-white shadow-sm">去小卖部兑换奖励</Link>
          </>
        ) : null}
      </div>
    </AppShell>
  )
}
