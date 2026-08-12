"use client"

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
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">学生端</h1>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
        {summary ? (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="text-lg font-semibold">{summary.name}</div>
            <div className="mt-2 text-slate-500">{summary.classroom.name} · {summary.group ?? "未分组"} · {summary.totalPoints} 分</div>
            {summary.pet ? <div className="mt-2 text-slate-500">班级宠物：{summary.pet.name} Lv.{summary.pet.level}</div> : null}
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
