"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { PetCard } from "@/components/pets/PetCard"
import { PetDetailModal } from "@/components/pets/PetDetailModal"
import { apiRequest } from "@/lib/api-client"
import type { ZooItem } from "@/lib/zoo-types"

export default function ZooPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId ?? "1"
  const [items, setItems] = useState<ZooItem[]>([])
  const [selected, setSelected] = useState<ZooItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assigning, setAssigning] = useState(false)
  const [systemName, setSystemName] = useState("班级动物园")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest<{ items: ZooItem[] }>(`/api/v1/classrooms/${classroomId}/zoo`)
      setItems(data.items)
    } catch {
      setError("加载动物园失败")
    } finally {
      setLoading(false)
    }
  }, [classroomId])

  useEffect(() => {
    load()
    apiRequest<{ name: string }>("/api/v1/system-settings")
      .then((data) => setSystemName(data.name))
      .catch(() => undefined)
  }, [load])

  async function assignAll() {
    if (!window.confirm("一键为尚未拥有宠物的学生随机分配宠物？")) return
    setAssigning(true)
    setError(null)
    try {
      await apiRequest(`/api/v1/classrooms/${classroomId}/pets/assign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ all: true }),
      })
      await load()
    } catch {
      setError("分配宠物失败")
    } finally {
      setAssigning(false)
    }
  }

  const unassigned = items.filter((item) => !item.pet).length

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{systemName}</h1>
            <p className="text-slate-600">每位学生一只专属宠物，喂食推进成长，满级毕业领徽章。</p>
          </div>
          <button className="rounded-lg bg-green-600 px-4 py-2 text-white disabled:opacity-50" disabled={assigning || unassigned === 0} onClick={assignAll}>
            {assigning ? "分配中..." : unassigned > 0 ? `一键分配宠物（${unassigned} 人）` : "已全部拥有宠物"}
          </button>
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
        {loading ? <div className="rounded-lg bg-white p-5 text-slate-500 shadow-sm">加载中...</div> : null}
        {!loading && items.length === 0 ? <div className="rounded-lg bg-white p-5 text-slate-500 shadow-sm">班级暂无学生</div> : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <PetCard
              key={item.student.id}
              studentName={item.student.name}
              badgeCount={item.badgeCount}
              pet={item.pet}
              onClick={() => setSelected(item)}
            />
          ))}
        </div>
      </div>

      <PetDetailModal
        open={selected != null}
        classroomId={classroomId}
        studentId={selected?.student.id ?? ""}
        studentName={selected?.student.name ?? ""}
        onClose={() => setSelected(null)}
        onChanged={load}
      />
    </AppShell>
  )
}
