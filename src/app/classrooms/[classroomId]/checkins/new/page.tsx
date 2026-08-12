"use client"

import { FormEvent, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"

export default function NewCheckinPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId ?? "1"
  const [title, setTitle] = useState("阅读 20 分钟")
  const [rewardPoints, setRewardPoints] = useState("2")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const response = await fetch(`/api/v1/classrooms/${classroomId}/checkin-tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        taskType: "READING",
        scheduleType: "DAILY",
        rewardPoints: Number(rewardPoints),
      }),
    })
    if (!response.ok) {
      setError("创建失败")
    }
    setSaving(false)
  }

  return (
    <AppShell>
      <section className="max-w-2xl rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">创建打卡任务</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium">任务名称</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">奖励分</span>
            <input value={rewardPoints} onChange={(event) => setRewardPoints(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button className="rounded-lg bg-green-600 px-4 py-2 text-white" disabled={saving}>{saving ? "保存中..." : "保存"}</button>
        </form>
      </section>
    </AppShell>
  )
}
