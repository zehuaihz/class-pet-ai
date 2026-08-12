"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"

type Pet = { name: string; species: string; level: number; growthValue: number; mood: string; hunger: number }
type PetLog = { id: string; reason: string; growthDelta: number; createdAt: string }

export default function PetPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId ?? "1"
  const [pet, setPet] = useState<Pet | null>(null)
  const [logs, setLogs] = useState<PetLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [petResponse, logsResponse] = await Promise.all([
          fetch(`/api/v1/classrooms/${classroomId}/pet`),
          fetch(`/api/v1/classrooms/${classroomId}/pet/logs`),
        ])
        if (!petResponse.ok || !logsResponse.ok) throw new Error("load failed")
        const petPayload = await petResponse.json()
        const logsPayload = await logsResponse.json()
        setPet(petPayload.data)
        setLogs(logsPayload.data.items ?? [])
      } catch {
        setError("加载宠物失败")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [classroomId])

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">班级宠物</h1>
          <p className="text-slate-600">积分推动宠物成长，班级一起养成。</p>
        </div>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
        {loading ? <div className="rounded-lg bg-white p-5 shadow-sm">加载中...</div> : null}
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="text-center text-6xl">🐉</div>
          <div className="mt-4 text-center text-xl font-semibold">{pet ? `${pet.name} Lv.${pet.level}` : "暂无宠物数据"}</div>
          {pet ? <div className="mt-2 text-center text-slate-500">成长值 {pet.growthValue} · 心情 {pet.mood} · 饱食度 {pet.hunger}%</div> : null}
        </section>
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="font-semibold">成长记录</h2>
          <div className="mt-4 space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="rounded-lg border p-3">
                <div className="font-medium">{log.reason}</div>
                <div className="text-sm text-slate-500">成长 +{log.growthDelta}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
