"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AppShell } from "@/components/layout/AppShell"
import { apiRequest } from "@/lib/api-client"

interface ClassroomSummary {
  id: string
  name: string
  grade?: string | null
  schoolName?: string | null
  studentCount: number
  petCount: number
}

export default function ClassroomsPage() {
  const [classrooms, setClassrooms] = useState<ClassroomSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiRequest<{ items: ClassroomSummary[] }>("/api/v1/classrooms")
      .then((data) => setClassrooms(data.items))
      .catch(() => setError("加载班级失败，请重试"))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="rise-in flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display flex items-center gap-2 text-3xl font-bold text-ink"><span aria-hidden="true">🏫</span>我的班级</h1>
            <p className="mt-1 text-sm text-ink-soft">创建班级后导入学生，开始积分和打卡。</p>
          </div>
          <Link href="/classrooms/new" className="btn-tangerine">🌱 创建班级</Link>
        </div>
        {error ? <div className="sticker sticker-quiet !border-berry bg-berry-soft p-4 font-semibold text-berry">{error}</div> : null}
        {loading ? <div className="sticker sticker-quiet animate-pulse p-6 text-ink-soft">加载中...</div> : null}
        {!loading && !error && classrooms.length === 0 ? (
          <div className="sticker sticker-quiet p-10 text-center text-ink-soft">暂无班级。先创建一个试点班级，动物园等着大家！🐾</div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classrooms.map((classroom, index) => (
            <Link key={classroom.id} href={`/classrooms/${classroom.id}/students`} className={`sticker sticker-hover rise-in stagger-${Math.min(index + 1, 6)} block p-5`}>
              <div className="font-display flex items-center gap-2 text-xl font-bold text-ink">
                <span aria-hidden="true">🏫</span>
                <span className="truncate">{classroom.name}</span>
              </div>
              <div className="mt-2 text-sm text-ink-soft">{classroom.grade ?? "未设置年级"} · {classroom.schoolName ?? "未设置学校"}</div>
              <div className="mt-4 flex items-center justify-between text-sm font-semibold">
                <span className="rounded-full border-2 border-ink/15 bg-paper-deep px-2.5 py-0.5 text-ink-soft">🧒 {classroom.studentCount} 名学生</span>
                <span className="rounded-full border-2 border-ink bg-butter px-2.5 py-0.5 text-ink shadow-sticker-sm">🐾 宠物 ×{classroom.petCount}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
