"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { apiRequest, ApiClientError } from "@/lib/api-client"

interface StudentOption {
  id: string
  name: string
  studentNo?: string | null
}

interface SavedComment {
  id: string
  content: string
  tone: string
  createdAt: string
  student: { id: string; name: string; studentNo?: string | null }
}

type JobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED"

export default function AiCommentPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId
  const [students, setStudents] = useState<StudentOption[]>([])
  const [draft, setDraft] = useState("")
  const [studentId, setStudentId] = useState("")
  const [tone, setTone] = useState("鼓励")
  const [teacherNote, setTeacherNote] = useState("")
  const [status, setStatus] = useState<JobStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedComments, setSavedComments] = useState<SavedComment[]>([])
  const [loadingStudents, setLoadingStudents] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadSavedComments = useCallback(() => {
    if (!classroomId) return
    apiRequest<{ items: SavedComment[] }>(`/api/v1/classrooms/${classroomId}/comments`)
      .then((data) => setSavedComments(data.items))
      .catch(() => undefined)
  }, [classroomId])

  useEffect(() => {
    if (!classroomId) return
    loadSavedComments()
  }, [classroomId, loadSavedComments])

  useEffect(() => {
    if (!classroomId) return
    let active = true
    setLoadingStudents(true)
    apiRequest<{ items: StudentOption[] }>(`/api/v1/classrooms/${classroomId}/students`)
      .then((data) => {
        if (!active) return
        setStudents(data.items)
        setStudentId(data.items[0]?.id ?? "")
      })
      .catch(() => {
        if (active) setError("加载学生失败")
      })
      .finally(() => {
        if (active) setLoadingStudents(false)
      })
    return () => { active = false }
  }, [classroomId])

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  async function pollJob(jobId: string) {
    pollRef.current = setInterval(async () => {
      try {
        const job = await apiRequest<{ status: JobStatus; outputJson?: { text?: string }; errorMessage?: string }>(`/api/v1/ai/jobs/${jobId}`)
        setStatus(job.status)
        if (job.status === "SUCCEEDED") {
          setDraft(job.outputJson?.text ?? "")
          if (pollRef.current) clearInterval(pollRef.current)
        } else if (job.status === "FAILED") {
          setError(job.errorMessage ?? "生成失败")
          if (pollRef.current) clearInterval(pollRef.current)
        }
      } catch {
        // keep polling
      }
    }, 1500)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus("PENDING")
    setError(null)
    setDraft("")
    try {
      const payload = await apiRequest<{ jobId: string }>("/api/v1/ai/comment-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ classroomId, studentId, tone, notes: teacherNote }),
      })
      await pollJob(payload.jobId)
    } catch (error: unknown) {
      setError(error instanceof ApiClientError ? error.message : "生成失败")
      setStatus(null)
    }
  }

  async function handleSaveDraft() {
    if (!studentId || !draft.trim() || saving) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await apiRequest(`/api/v1/classrooms/${classroomId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentId, content: draft.trim(), tone }),
      })
      setNotice("✅ 评语已保存")
      setDraft("")
      loadSavedComments()
    } catch (error: unknown) {
      setError(error instanceof ApiClientError ? error.message : "保存评语失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rise-in">
          <h1 className="font-display flex items-center gap-2 text-3xl font-bold text-ink"><span aria-hidden="true">✍️</span>评语生成</h1>
          <p className="mt-1 text-sm text-ink-soft">先出草稿，再由教师确认。</p>
        </div>
        <section className="sticker sticker-quiet rise-in stagger-2 p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-ink-soft">选择学生</span>
              <select
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                disabled={loadingStudents || students.length === 0}
                className="sticker-input mt-1 w-full cursor-pointer disabled:opacity-50"
              >
                {students.length === 0 ? <option value="">暂无可选学生</option> : null}
                {students.map((student) => <option key={student.id} value={student.id}>{student.name}{student.studentNo ? `（${student.studentNo}）` : ""}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-ink-soft">语气</span>
              <select className="sticker-input mt-1 w-full cursor-pointer" value={tone} onChange={(event) => setTone(event.target.value)}>
                <option>鼓励</option>
                <option>温和</option>
                <option>严谨</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-ink-soft">补充说明</span>
              <textarea value={teacherNote} onChange={(event) => setTeacherNote(event.target.value)} className="sticker-input mt-1 w-full" rows={3} />
            </label>
            {error ? <p className="text-sm font-semibold text-berry">{error}</p> : null}
            {notice ? <p className="text-sm font-semibold text-forest-deep">{notice}</p> : null}
            {status && status !== "SUCCEEDED" && status !== "FAILED" ? <p className="animate-pulse text-sm font-semibold text-ink-soft">🤖 任务状态：{status}...</p> : null}
            <button className="btn-tangerine disabled:opacity-40" disabled={!classroomId || !studentId || loadingStudents || status === "PENDING" || status === "RUNNING"}>{status === "PENDING" || status === "RUNNING" ? "生成中..." : "✨ 生成草稿"}</button>
          </form>
          {draft ? (
            <div className="mt-6 rounded-sticker border-2 border-ink bg-butter-soft p-4 shadow-sticker-sm">
              <div className="font-display font-bold text-ink">📝 AI 草稿（可编辑，确认后存档）</div>
              <textarea className="sticker-input mt-2 min-h-32 w-full" value={draft} onChange={(event) => setDraft(event.target.value)} />
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn-ink disabled:opacity-40" disabled={saving || !draft.trim()} onClick={handleSaveDraft}>
                  {saving ? "保存中..." : "✅ 确认保存评语"}
                </button>
                <button type="button" className="btn-outline" disabled={status === "PENDING" || status === "RUNNING"} onClick={() => { setDraft(""); setNotice(null) }}>
                  🗑️ 放弃草稿
                </button>
              </div>
              <p className="mt-2 text-xs text-ink-faint">保存后可在下方「已保存评语」中查看。</p>
            </div>
          ) : null}
        </section>

        <section className="sticker sticker-quiet rise-in stagger-4 p-5">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">📚</span>已保存评语</h2>
          {savedComments.length === 0 ? (
            <div className="mt-3 rounded-xl border-2 border-dashed border-ink/30 p-4 text-center text-sm text-ink-faint">还没有保存过评语</div>
          ) : (
            <div className="mt-3 space-y-2">
              {savedComments.map((comment) => (
                <div key={comment.id} className="rounded-xl border-2 border-ink/15 bg-white p-3">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold text-ink">{comment.student.name}{comment.student.studentNo ? `（${comment.student.studentNo}）` : ""}</span>
                    <span className="shrink-0 text-xs text-ink-faint">{String(comment.createdAt).slice(0, 10)} · {comment.tone}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{comment.content}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}
