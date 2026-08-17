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
  petLevel: number
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">班级</h1>
            <p className="text-slate-600">创建班级后导入学生，开始积分和打卡。</p>
          </div>
          <Link href="/classrooms/new" className="rounded-lg bg-green-600 px-4 py-2 text-white">创建班级</Link>
        </div>
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div> : null}
        {loading ? <div className="rounded-xl bg-white p-6 text-slate-600 shadow-sm">加载中...</div> : null}
        {!loading && !error && classrooms.length === 0 ? <div className="rounded-xl bg-white p-6 text-slate-600 shadow-sm">暂无班级。先创建一个试点班级。</div> : null}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classrooms.map((classroom) => (
            <div key={classroom.id} className="rounded-xl bg-white p-5 shadow-sm transition hover:ring-2 hover:ring-green-200">
              <Link href={`/classrooms/${classroom.id}/students`}>
                <div className="text-lg font-semibold">{classroom.name}</div>
                <div className="mt-2 text-sm text-slate-500">{classroom.grade ?? "未设置年级"} · {classroom.schoolName ?? "未设置学校"}</div>
                <div className="mt-4 flex justify-between text-sm"><span>{classroom.studentCount} 名学生</span><span>宠物 Lv.{classroom.petLevel}</span></div>
              </Link>
              <Link href={`/classrooms/${classroom.id}/screen`} className="mt-3 inline-block rounded-lg border px-3 py-1 text-sm text-green-700">📺 投屏</Link>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
