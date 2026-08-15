"use client"

import { useEffect, useState } from "react"
import { ApiClientError, apiRequest } from "@/lib/api-client"
import { PetVisual } from "@/components/pets/PetVisual"

interface Student {
  id: string
  name: string
  studentNo?: string | null
}

interface PetSpecies {
  key: string
  name: string
}

interface StudentFormModalProps {
  open: boolean
  editingStudent: Student | null
  classroomId: string
  onClose: () => void
  onSaved: () => void
}

export function StudentFormModal({ open, editingStudent, classroomId, onClose, onSaved }: StudentFormModalProps) {
  const [name, setName] = useState("")
  const [studentNo, setStudentNo] = useState("")
  const [species, setSpecies] = useState<PetSpecies[]>([])
  const [speciesLoading, setSpeciesLoading] = useState(false)
  const [speciesError, setSpeciesError] = useState(false)
  const [selectedSpeciesKey, setSelectedSpeciesKey] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(editingStudent?.name ?? "")
    setStudentNo(editingStudent?.studentNo ?? "")
    setSelectedSpeciesKey(null)
    setSpecies([])
    setSpeciesLoading(false)
    setSpeciesError(false)
    setError(null)
  }, [open, editingStudent])

  // 创建模式下加载系统中已有的宠物品种供选择；编辑模式不涉及宠物。
  useEffect(() => {
    if (!open || editingStudent) return
    let cancelled = false
    setSpeciesLoading(true)
    setSpeciesError(false)
    apiRequest<{ items: PetSpecies[] }>(`/api/v1/classrooms/${classroomId}/pet-species`)
      .then((data) => {
        if (cancelled) return
        setSpecies(data.items ?? [])
      })
      .catch(() => {
        if (cancelled) return
        setSpeciesError(true)
      })
      .finally(() => {
        if (!cancelled) setSpeciesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, editingStudent, classroomId])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    if (open) window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      if (editingStudent) {
        await apiRequest(`/api/v1/students/${editingStudent.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: name.trim(), studentNo: studentNo.trim() || null }),
        })
      } else {
        await apiRequest(`/api/v1/classrooms/${classroomId}/students`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: name.trim(), studentNo: studentNo.trim() || null, petSpeciesKey: selectedSpeciesKey }),
        })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "保存学生失败")
    } finally {
      setSubmitting(false)
    }
  }

  function speciesCardClass(active: boolean) {
    return `flex flex-col items-center gap-1 rounded-lg border p-2 text-sm transition ${active ? "border-green-500 bg-green-50 text-green-700" : "border-slate-200 text-slate-700 hover:border-slate-300"}`
  }

  const showPetSection = !editingStudent

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editingStudent ? "编辑学生" : "添加学生"}
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl outline-none"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-xl font-bold">{editingStudent ? "编辑学生" : "添加学生"}</h2>
          <button className="rounded-lg border px-3 py-1 text-sm" onClick={onClose}>关闭</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-6">
          {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="student-name">姓名</label>
            <input id="student-name" required value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="姓名" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="student-no">学号（可选）</label>
            <input id="student-no" value={studentNo} onChange={(event) => setStudentNo(event.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="学号（可选）" />
          </div>

          {showPetSection ? (
            <div>
              <div className="mb-2 font-semibold">分配宠物（可选）</div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                <button type="button" className={speciesCardClass(selectedSpeciesKey === null)} onClick={() => setSelectedSpeciesKey(null)}>
                  <span className="text-2xl">🐾</span>
                  <span>不分配宠物</span>
                </button>
                {species.map((item) => (
                  <button type="button" key={item.key} className={speciesCardClass(selectedSpeciesKey === item.key)} onClick={() => setSelectedSpeciesKey(item.key)}>
                    <PetVisual speciesKey={item.key} level={1} size="text-2xl" />
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
              {speciesLoading ? <div className="mt-2 text-sm text-slate-400">加载宠物品种...</div> : null}
              {!speciesLoading && speciesError ? <div className="mt-2 text-sm text-slate-400">宠物品种加载失败，学生将不分配宠物</div> : null}
              {!speciesLoading && !speciesError && species.length === 0 ? <div className="mt-2 text-sm text-slate-400">暂无可选宠物品种，学生将不分配宠物</div> : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 border-t pt-4">
            <button type="button" className="rounded-lg border px-4 py-2" onClick={onClose}>取消</button>
            <button className="rounded-lg bg-green-600 px-4 py-2 text-white disabled:opacity-50" disabled={submitting}>
              {submitting ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
