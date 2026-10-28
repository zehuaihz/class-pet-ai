"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AppShell } from "@/components/layout/AppShell"
import { apiRequest } from "@/lib/api-client"

interface StudentSummary {
  student: {
    name: string
    totalPoints: number
    group: string | null
    classroom: { name: string }
    pet: { name: string; level: number } | null
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
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="rise-in flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display flex items-center gap-2 text-3xl font-bold text-ink"><span aria-hidden="true">🎒</span>我的信息</h1>
          <div className="flex gap-2">
            <Link href="/student/checkins" className="btn-outline !px-3 !py-1.5 text-sm">📅 我的打卡</Link>
            <Link href="/student/rewards" className="btn-outline !px-3 !py-1.5 text-sm">🛍️ 奖励兑换</Link>
          </div>
        </div>
        {error ? <div className="sticker sticker-quiet !border-berry bg-berry-soft p-3 text-sm font-semibold text-berry">{error}</div> : null}
        {summary ? (
          <div className="sticker sticker-quiet rise-in stagger-2 p-6">
            <div className="font-display text-2xl font-bold text-ink">{summary.name}</div>
            <div className="mt-2 text-ink-soft">
              {summary.classroom.name} · {summary.group ?? "未分组"} · <span className="font-display text-lg font-bold text-forest">{summary.totalPoints} 分</span>
            </div>
            {summary.pet ? (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-forest-mist px-4 py-1.5 shadow-sticker-sm">
                <span aria-hidden="true" className="text-xl">🐾</span>
                <span className="font-semibold text-ink">我的宠物：{summary.pet.name} <span className="font-display font-bold text-forest">Lv.{summary.pet.level}</span></span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
