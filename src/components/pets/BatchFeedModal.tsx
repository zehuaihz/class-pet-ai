"use client"

import { useEffect, useState } from "react"
import { apiRequest } from "@/lib/api-client"

interface BatchFeedModalProps {
  open: boolean
  classroomId: string
  mode: "batch" | "all"
  targetCount: number
  studentIds?: string[]
  onClose: () => void
  onDone: () => void
}

export function BatchFeedModal({ open, classroomId, mode, targetCount, studentIds = [], onClose, onDone }: BatchFeedModalProps) {
  const [delta, setDelta] = useState(1)
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDelta(1)
      setReason("")
      setError(null)
    }
  }, [open])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    if (open) window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  async function handleSubmit() {
    if (!reason.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await apiRequest(`/api/v1/classrooms/${classroomId}/points/feed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(mode === "batch" ? { studentIds } : { allStudents: true }),
          delta,
          reason: reason.trim(),
          idempotencyKey: `feed:${classroomId}:${mode}:${Date.now()}`,
        }),
      })
      onDone()
      onClose()
    } catch {
      setError("操作失败，请重试")
    } finally {
      setSubmitting(false)
    }
  }

  const title = mode === "all" ? "全班加减分" : `批量加减分（${targetCount} 人）`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="animate-pop-in w-full max-w-md rounded-sticker-lg border-2 border-ink bg-paper p-6 shadow-sticker-lg"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 className="font-display text-xl font-bold text-ink">🍖 {title}</h2>
        <p className="mt-1 text-sm text-ink-soft">加减分即喂食/扣食物，同量作用于每位学生的宠物。</p>
        <div className="mt-4 space-y-4">
          {error ? <div className="sticker-tight !border-berry bg-berry-soft p-3 text-sm font-semibold text-berry">{error}</div> : null}
          <div>
            <label className="text-sm font-semibold text-ink">分值</label>
            <div className="mt-1 flex items-center gap-2">
              <button type="button" className="btn-outline !px-3 !py-1.5" onClick={() => setDelta((value) => value - 1)}>−</button>
              <span className={`font-display w-10 text-center text-lg font-bold ${delta >= 0 ? "text-forest" : "text-berry"}`}>{delta > 0 ? `+${delta}` : delta}</span>
              <button type="button" className="btn-outline !px-3 !py-1.5" onClick={() => setDelta((value) => value + 1)}>＋</button>
            </div>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-ink">原因</span>
            <input value={reason} onChange={(event) => setReason(event.target.value)} className="sticker-input mt-1 w-full" placeholder="例如：早读表现优秀" />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn-outline" onClick={onClose}>取消</button>
          <button type="button" disabled={submitting || !reason.trim()} className="btn-tangerine disabled:opacity-40" onClick={handleSubmit}>
            {submitting ? "提交中..." : "确认"}
          </button>
        </div>
      </div>
    </div>
  )
}
