"use client"

import { FormEvent, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { apiRequest, ApiClientError } from "@/lib/api-client"

interface StudentOption {
  id: string
  name: string
  studentNo?: string | null
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
  const [loadingStudents, setLoadingStudents] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">评语生成</h1>
          <p className="text-slate-600">先出草稿，再由教师确认。</p>
        </div>
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium">选择学生</span>
              <select
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                disabled={loadingStudents || students.length === 0}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              >
                {students.length === 0 ? <option value="">暂无可选学生</option> : null}
                {students.map((student) => <option key={student.id} value={student.id}>{student.name}{student.studentNo ? `（${student.studentNo}）` : ""}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">语气</span>
              <select className="mt-1 w-full rounded-lg border px-3 py-2" value={tone} onChange={(event) => setTone(event.target.value)}>
                <option>鼓励</option>
                <option>温和</option>
                <option>严谨</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">补充说明</span>
              <textarea value={teacherNote} onChange={(event) => setTeacherNote(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" rows={3} />
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {status && status !== "SUCCEEDED" && status !== "FAILED" ? <p className="text-sm text-slate-500">任务状态：{status}...</p> : null}
            <button className="rounded-lg bg-green-600 px-4 py-2 text-white" disabled={!classroomId || !studentId || loadingStudents || status === "PENDING" || status === "RUNNING"}>{status === "PENDING" || status === "RUNNING" ? "生成中..." : "生成草稿"}</button>
          </form>
          {draft ? (
            <div className="mt-6 rounded-lg border bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-500">AI 草稿</div>
              <textarea className="mt-2 min-h-32 w-full rounded-lg border p-3" value={draft} onChange={(event) => setDraft(event.target.value)} />
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  )
}
