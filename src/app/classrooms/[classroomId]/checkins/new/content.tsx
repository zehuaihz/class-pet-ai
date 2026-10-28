"use client"

import { FormEvent, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { apiRequest } from "@/lib/api-client"

export default function NewCheckinPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId
  const [title, setTitle] = useState("阅读 20 分钟")
  const [rewardPoints, setRewardPoints] = useState("2")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (!classroomId) throw new Error("缺少班级上下文")
      await apiRequest(`/api/v1/classrooms/${classroomId}/checkin-tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          taskType: "READING",
          scheduleType: "DAILY",
          rewardPoints: Number(rewardPoints),
        }),
      })
    } catch {
      setError("创建失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <section className="rise-in sticker mx-auto max-w-2xl p-6">
        <h1 className="font-display flex items-center gap-2 text-3xl font-bold text-ink"><span aria-hidden="true">🌱</span>创建打卡任务</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-ink-soft">任务名称</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="sticker-input mt-1 w-full" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink-soft">奖励分</span>
            <input value={rewardPoints} onChange={(event) => setRewardPoints(event.target.value)} className="sticker-input mt-1 w-full" />
          </label>
          {error ? <p className="text-sm font-semibold text-berry">{error}</p> : null}
          <button className="btn-tangerine disabled:opacity-40" disabled={saving}>{saving ? "保存中..." : "💾 保存"}</button>
        </form>
      </section>
    </AppShell>
  )
}
