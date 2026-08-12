"use client"

import { useCallback, useEffect, useState } from "react"
import { apiRequest } from "@/lib/api-client"
import { PetVisual } from "@/components/pets/PetVisual"
import { LevelUpModal } from "@/components/pets/LevelUpModal"
import type { PetView } from "@/lib/zoo-types"

interface PetDetailPayload {
  student: { id: string; name: string }
  pet: PetView | null
  badges: Array<{ id: string; name: string; visualKey: string; status: string; earnedAt: string }>
  logs: Array<{ id: string; reason: string; growthDelta: number; createdAt: string }>
}

interface FeedPayload {
  idempotent: boolean
  applied: number
  results: Array<{
    pet: { id: string; level: number; growthValue: number; graduated: boolean } | null
    badge: { id: string } | null
    growthDelta: number
  }>
}

interface Celebration {
  graduated: boolean
  level: number
}

const QUICK_FEEDS = [
  { label: "课堂表现 +1", delta: 1, reason: "课堂表现优秀" },
  { label: "作业优秀 +2", delta: 2, reason: "作业完成优秀" },
  { label: "积极举手 +1", delta: 1, reason: "积极举手发言" },
  { label: "乐于助人 +2", delta: 2, reason: "乐于助人" },
  { label: "迟到 −1", delta: -1, reason: "迟到" },
  { label: "课堂纪律 −2", delta: -2, reason: "课堂纪律提醒" },
]

interface PetDetailModalProps {
  open: boolean
  classroomId: string
  studentId: string
  studentName: string
  onClose: () => void
  onChanged: () => void
}

export function PetDetailModal({ open, classroomId, studentId, studentName, onClose, onChanged }: PetDetailModalProps) {
  const [detail, setDetail] = useState<PetDetailPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [delta, setDelta] = useState(1)
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [celebration, setCelebration] = useState<Celebration | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest<PetDetailPayload>(`/api/v1/classrooms/${classroomId}/students/${studentId}/pet`)
      setDetail(data)
    } catch {
      setError("加载宠物详情失败")
    } finally {
      setLoading(false)
    }
  }, [classroomId, studentId])

  useEffect(() => {
    if (open) {
      setDetail(null)
      setReason("")
      setDelta(1)
      load()
    }
  }, [open, load])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    if (open) window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const pet = detail?.pet ?? null

  async function feed(deltaValue: number, reasonValue: string) {
    if (!reasonValue.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const data = await apiRequest<FeedPayload>(`/api/v1/classrooms/${classroomId}/points/feed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentIds: [studentId], delta: deltaValue, reason: reasonValue.trim() }),
      })
      const result = data.results?.[0]
      if (result?.pet) {
        const previousLevel = detail?.pet?.level
        if (result.pet.graduated) {
          setCelebration({ graduated: true, level: result.pet.level })
        } else if (previousLevel != null && result.pet.level > previousLevel) {
          setCelebration({ graduated: false, level: result.pet.level })
        }
      }
      setReason("")
      await load()
      onChanged()
    } catch {
      setError("喂食失败，请重试")
    } finally {
      setSubmitting(false)
    }
  }

  async function adoptNext() {
    setSubmitting(true)
    setError(null)
    try {
      await apiRequest(`/api/v1/classrooms/${classroomId}/students/${studentId}/pet/adopt`, { method: "POST" })
      await load()
      onChanged()
    } catch {
      setError("领养失败")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl outline-none"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-xl font-bold">{studentName} 的宠物</h2>
            <p className="text-sm text-slate-500">喂食推进成长，扣分会让进度倒退。</p>
          </div>
          <button className="rounded-lg border px-3 py-1 text-sm" onClick={onClose}>关闭</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
          {loading && !pet ? <div className="p-6 text-center text-slate-500">加载中...</div> : null}

          {!loading && !pet ? (
            <div className="space-y-4 text-center">
              <div className="text-6xl">🐾</div>
              <p className="text-slate-500">该学生还没有宠物，请先分配。</p>
            </div>
          ) : null}

          {pet ? (
            <>
              <section className="rounded-2xl bg-gradient-to-b from-green-50 to-white p-6 text-center">
                <div className="flex justify-center">
                  <PetVisual speciesKey={pet.speciesKey} level={pet.level} size="text-8xl" />
                </div>
                <div className="mt-3 text-lg font-semibold">
                  {pet.name} <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-sm text-green-700">Lv.{pet.level}</span>
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {pet.graduated ? "已毕业 🎓" : `累计食物 ${pet.growthValue}`}
                </div>
                {!pet.graduated ? (
                  <>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-500 transition-all" style={{ width: `${Math.round(pet.progressRatio * 100)}%` }} />
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {pet.nextThreshold != null ? `距离 Lv.${pet.level + 1} 还差 ${pet.remainingToNext} 食物` : ""}
                    </div>
                  </>
                ) : null}
              </section>

              {pet.graduated ? (
                <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                  <div className="font-semibold text-amber-800">🎓 养成毕业，获得 1 枚徽章！</div>
                  <button className="mt-3 rounded-lg bg-green-600 px-4 py-2 text-white disabled:opacity-50" disabled={submitting} onClick={adoptNext}>
                    领养下一只新宠物
                  </button>
                </section>
              ) : (
                <section className="mt-4 space-y-3 rounded-xl border p-4">
                  <div className="font-semibold">喂食 / 扣分</div>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_FEEDS.map((quick) => (
                      <button
                        key={quick.label}
                        type="button"
                        disabled={submitting}
                        className={`rounded-full px-3 py-1.5 text-sm transition disabled:opacity-50 ${quick.delta >= 0 ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200"}`}
                        onClick={() => feed(quick.delta, quick.reason)}
                      >
                        {quick.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" className="rounded-lg border px-3 py-2" onClick={() => setDelta((value) => Math.max(-99, value - 1))}>−</button>
                    <span className={`w-8 text-center font-bold ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>{delta > 0 ? `+${delta}` : delta}</span>
                    <button type="button" className="rounded-lg border px-3 py-2" onClick={() => setDelta((value) => Math.min(99, value + 1))}>＋</button>
                    <input value={reason} onChange={(event) => setReason(event.target.value)} className="flex-1 rounded-lg border px-3 py-2" placeholder="填写原因" />
                    <button type="button" disabled={submitting || !reason.trim()} className="rounded-lg bg-green-600 px-4 py-2 text-white disabled:opacity-50" onClick={() => feed(delta, reason)}>
                      确认
                    </button>
                  </div>
                </section>
              )}

              {detail && detail.badges.length > 0 ? (
                <section className="mt-4">
                  <div className="font-semibold">已获徽章</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detail.badges.map((badge) => (
                      <span key={badge.id} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ${badge.status === "CONSUMED" ? "bg-slate-100 text-slate-400 line-through" : "bg-amber-100 text-amber-700"}`}>
                        🏅 {badge.name}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="mt-4">
                <div className="font-semibold">成长记录</div>
                <div className="mt-2 space-y-2">
                  {(detail?.logs ?? []).slice(0, 15).map((log) => (
                    <div key={log.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <span className="text-slate-700">{log.reason}</span>
                      <span className={`font-semibold ${log.growthDelta >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {log.growthDelta >= 0 ? "+" : ""}{log.growthDelta}
                      </span>
                    </div>
                  ))}
                  {(detail?.logs ?? []).length === 0 ? <div className="text-sm text-slate-400">暂无记录</div> : null}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>

      <LevelUpModal
        open={celebration != null}
        petName={pet?.name ?? ""}
        newLevel={celebration?.level ?? 1}
        graduated={celebration?.graduated ?? false}
        onClose={() => setCelebration(null)}
      />
    </div>
  )
}
