"use client"

import { FormEvent, useState } from "react"
import { AppShell } from "@/components/layout/AppShell"

export default function NewClassroomPage() {
  const [name, setName] = useState("三年级2班")
  const [grade, setGrade] = useState("3")
  const [schoolName, setSchoolName] = useState("测试小学")
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const response = await fetch("/api/v1/classrooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, grade, schoolName }),
    })

    const payload = await response.json()
    if (!response.ok) {
      setError(payload.error?.message ?? "创建失败")
      return
    }

    window.location.href = `/classrooms/${payload.data.id}/students`
  }

  return (
    <AppShell>
      <section className="rise-in sticker mx-auto max-w-2xl p-6">
        <h1 className="font-display flex items-center gap-2 text-3xl font-bold text-ink"><span aria-hidden="true">🌱</span>创建班级</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-ink-soft">班级名</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className="sticker-input mt-1 w-full" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink-soft">年级</span>
            <input value={grade} onChange={(event) => setGrade(event.target.value)} className="sticker-input mt-1 w-full" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink-soft">学校</span>
            <input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} className="sticker-input mt-1 w-full" />
          </label>
          {error ? <p className="text-sm font-semibold text-berry">{error}</p> : null}
          <button className="btn-tangerine">💾 保存</button>
        </form>
      </section>
    </AppShell>
  )
}
