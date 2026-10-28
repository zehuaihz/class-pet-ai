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
        <div className="rise-in flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display flex items-center gap-2 text-3xl font-bold text-ink">
              <span aria-hidden="true" className="inline-block">🐾</span>
              {systemName}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">每位学生一只专属宠物，喂食推进成长，满级毕业领徽章。</p>
          </div>
          <button
            className="btn-tangerine disabled:pointer-events-none disabled:opacity-40"
            disabled={assigning || unassigned === 0}
            onClick={assignAll}
          >
            {assigning ? "分配中..." : unassigned > 0 ? `🎲 一键分配宠物（${unassigned} 人）` : "✅ 已全部拥有宠物"}
          </button>
        </div>

        {error ? <div className="sticker sticker-quiet !border-berry bg-berry-soft p-3 text-sm font-semibold text-berry">{error}</div> : null}
        {loading ? <div className="sticker sticker-quiet animate-pulse p-6 text-ink-soft">动物们正在集合…</div> : null}
        {!loading && items.length === 0 ? (
          <div className="sticker sticker-quiet p-8 text-center text-ink-soft">班级暂无学生，先去「学生管理」添加吧。</div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item, index) => (
            <div key={item.student.id} className={`rise-in stagger-${Math.min(index + 1, 8)}`}>
              <PetCard
                studentName={item.student.name}
                badgeCount={item.badgeCount}
                pet={item.pet}
                onClick={() => setSelected(item)}
              />
            </div>
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
