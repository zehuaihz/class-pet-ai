"use client"

import { useEffect, useRef, useState } from "react"

interface DefaultRule {
  id: string
  name: string
  pointDelta: number
}

interface StudentTarget {
  id: string
  name: string
  totalPoints: number
}

interface QuickAddModalProps {
  open: boolean
  student: StudentTarget | null
  defaultRules: DefaultRule[]
  onSubmit: (input: { studentId: string; delta: number; reason: string; ruleId?: string; syncPetGrowth: boolean }) => Promise<void>
  onOpenChange: (open: boolean) => void
}

export function QuickAddModal({ open, student, defaultRules, onSubmit, onOpenChange }: QuickAddModalProps) {
  const [delta, setDelta] = useState(1)
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null
      dialogRef.current?.focus()
    } else {
      previousFocusRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false)
    }
    if (open) window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onOpenChange])

  if (!open || !student) return null

  async function handleSubmit() {
    if (!reason.trim() || !student) return
    setSubmitting(true)
    try {
      await onSubmit({
        studentId: student.id,
        delta,
        reason: reason.trim(),
        syncPetGrowth: true,
      })
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={() => onOpenChange(false)}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-title"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl outline-none"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="quick-add-title" className="text-xl font-bold">给 {student.name} 加分</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium">分值</label>
            <div className="mt-1 flex items-center gap-2">
              <button type="button" className="rounded-lg border px-3 py-2" onClick={() => setDelta((value) => Math.max(1, value - 1))}>-</button>
              <span className="w-10 text-center text-lg font-semibold">{delta}</span>
              <button type="button" className="rounded-lg border px-3 py-2" onClick={() => setDelta((value) => value + 1)}>+</button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">常用原因</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {defaultRules.map((rule) => (
                <button key={rule.id} type="button" className="rounded-full border px-3 py-1 text-sm" onClick={() => {
                  setReason(rule.name)
                  setDelta(rule.pointDelta)
                }}>{rule.name}</button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-sm font-medium">自定义原因</span>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" rows={3} />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="rounded-lg border px-4 py-2" onClick={() => onOpenChange(false)}>取消</button>
          <button type="button" disabled={submitting || !reason.trim()} className="rounded-lg bg-green-600 px-4 py-2 text-white disabled:opacity-50" onClick={handleSubmit}>
            {submitting ? "提交中..." : "确认加分"}
          </button>
        </div>
      </div>
    </div>
  )
}
