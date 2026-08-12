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
      <section className="max-w-2xl rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">创建班级</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium">班级名</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">年级</span>
            <input value={grade} onChange={(event) => setGrade(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">学校</span>
            <input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button className="rounded-lg bg-green-600 px-4 py-2 text-white">保存</button>
        </form>
      </section>
    </AppShell>
  )
}
