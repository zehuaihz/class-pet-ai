"use client"

import { useCallback, useEffect, useState } from "react"
import { apiRequest } from "@/lib/api-client"

interface PlatformClassroom {
  id: string
  name: string
  createdAt: string
  studentCount: number
  teacher: string
  teacherEmail: string | null
  teacherStatus: string
  schoolId: string | null
}

interface SchoolOption {
  id: string
  name: string
}

const PAGE_SIZE = 20

export default function ClassroomsTab() {
  const [classrooms, setClassrooms] = useState<PlatformClassroom[]>([])
  const [schools, setSchools] = useState<SchoolOption[]>([])
  const [keyword, setKeyword] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (keyword.trim()) params.set("keyword", keyword.trim())
    try {
      const data = await apiRequest<{ items: PlatformClassroom[]; meta: { total: number } }>(
        `/api/v1/admin/classrooms?${params.toString()}`,
      )
      setClassrooms(data.items)
      setTotal(data.meta?.total ?? data.items.length)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载班级列表失败")
    }
  }, [page, keyword])

  useEffect(() => {
    void load()
    apiRequest<{ items: SchoolOption[] }>("/api/v1/admin/schools")
      .then((data) => setSchools(data.items))
      .catch(() => undefined)
  }, [load])

  const schoolNameById = new Map(schools.map((school) => [school.id, school.name]))
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-5">
      {error ? <div className="sticker sticker-quiet !border-berry bg-berry-soft p-3 text-sm font-semibold text-berry">{error}</div> : null}

      <div className="sticker sticker-quiet rise-in stagger-1 flex flex-wrap items-end gap-3 p-5">
        <label className="min-w-56 flex-1 text-sm">
          <span className="font-semibold text-ink-soft">班级名称关键字</span>
          <input className="sticker-input mt-1 w-full" value={keyword}
            onChange={(event) => { setPage(1); setKeyword(event.target.value) }} placeholder="🔍 搜索班级" />
        </label>
      </div>

      {classrooms.length === 0 ? <div className="sticker sticker-quiet p-8 text-center text-ink-soft">暂无班级</div> : null}

      {classrooms.length > 0 ? (
        <div className="sticker sticker-quiet rise-in stagger-3 overflow-x-auto p-5">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="font-display text-ink-soft">
                <th className="py-2">班级</th>
                <th>教师</th>
                <th>学校</th>
                <th>学生数</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {classrooms.map((classroom) => (
                <tr key={classroom.id} className="border-t-2 border-dashed border-ink/20">
                  <td className="py-2.5 font-semibold text-ink">{classroom.name}</td>
                  <td className="text-ink-soft">
                    {classroom.teacher}
                    {classroom.teacherEmail ? <span className="block text-xs text-ink-faint">{classroom.teacherEmail}</span> : null}
                  </td>
                  <td className="text-ink-soft">{classroom.schoolId ? (schoolNameById.get(classroom.schoolId) ?? "-") : "-"}</td>
                  <td className="font-bold tabular-nums text-ink">{classroom.studentCount}</td>
                  <td className="tabular-nums text-ink-soft">{String(classroom.createdAt).slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
            <span className="font-display font-bold">共 {total} 条 · 第 {page}/{totalPages} 页</span>
            <div className="flex gap-2">
              <button className="btn-outline !px-3 !py-0.5 text-xs disabled:opacity-40" disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}>← 上一页</button>
              <button className="btn-outline !px-3 !py-0.5 text-xs disabled:opacity-40" disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}>下一页 →</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
