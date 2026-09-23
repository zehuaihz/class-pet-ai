"use client"

import Link from "next/link"
import { FormEvent, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { apiRequest } from "@/lib/api-client"

type Task = { id: string; title: string; rewardPoints: number; stats?: { completedCount: number; totalStudents: number; pendingCount: number; missedCount: number; completionRate: number } }
type PendingRecord = { id: string; studentName: string; taskTitle: string; evidenceUrl?: string | null; status: string }
type StudentOption = { id: string; name: string; studentNo: string | null }

export default function CheckinsPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId
  const [tasks, setTasks] = useState<Task[]>([])
  const [records, setRecords] = useState<PendingRecord[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [manualTaskId, setManualTaskId] = useState("")
  const [manualStudentId, setManualStudentId] = useState("")
  const [manualEvidence, setManualEvidence] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    if (!classroomId) return
    setLoading(true)
    setError(null)
    try {
      const [tasksData, recordsData, studentsData] = await Promise.all([
        apiRequest<{ items: Task[] }>(`/api/v1/classrooms/${classroomId}/checkin-tasks`),
        apiRequest<{ items: PendingRecord[] }>(`/api/v1/classrooms/${classroomId}/checkin-records`),
        apiRequest<{ items: StudentOption[] }>(`/api/v1/classrooms/${classroomId}/students`),
      ])
      setTasks(tasksData.items)
      setRecords(recordsData.items)
      setStudents(studentsData.items)
    } catch {
      setError("加载打卡任务失败")
    } finally {
      setLoading(false)
    }
  }

  async function handleManualCheckin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!classroomId || !manualTaskId || !manualStudentId) return
    setSubmitting(true)
    setError(null)
    setNotice(null)
    try {
      await apiRequest(`/api/v1/classrooms/${classroomId}/checkin-records`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskId: manualTaskId,
          studentId: manualStudentId,
          evidenceUrl: manualEvidence.trim() || null,
        }),
      })
      setNotice("补录成功")
      setManualEvidence("")
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "补录失败，请重试")
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classroomId])

  async function updateRecord(recordId: string, action: "approve" | "reject") {
    try {
      await apiRequest(`/api/v1/checkin-records/${recordId}/${action}`, { method: "PATCH" })
      await load()
    } catch {
      setError(action === "approve" ? "批准失败，请重试" : "驳回失败，请重试")
    }
  }

  async function handleApprove(recordId: string) {
    await updateRecord(recordId, "approve")
  }

  async function handleReject(recordId: string) {
    await updateRecord(recordId, "reject")
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">打卡任务</h1>
            <p className="text-slate-600">创建任务、查看完成率、补录和审批。</p>
          </div>
          <Link href={`/classrooms/${classroomId}/checkins/new`} className="rounded-lg bg-green-600 px-4 py-2 text-white">创建任务</Link>
        </div>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
        {notice ? <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-700">{notice}</div> : null}
        {!classroomId ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">缺少班级上下文，请从班级列表进入。</div> : null}
        {loading ? <div className="rounded-lg bg-white p-5 shadow-sm">加载中...</div> : null}

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">补录打卡</h2>
          <p className="mt-1 text-sm text-slate-500">为学生手动补录打卡记录，是否需要审批取决于任务的证据要求。</p>
          <form className="mt-4 grid gap-3 md:grid-cols-4" onSubmit={handleManualCheckin}>
            <label className="text-sm">
              <span className="text-slate-600">打卡任务</span>
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={manualTaskId}
                onChange={(event) => setManualTaskId(event.target.value)}
                required
              >
                <option value="">请选择任务</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-slate-600">学生</span>
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={manualStudentId}
                onChange={(event) => setManualStudentId(event.target.value)}
                required
              >
                <option value="">请选择学生</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                    {student.studentNo ? ` (${student.studentNo})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-slate-600">证据链接（可选）</span>
              <input
                type="url"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={manualEvidence}
                onChange={(event) => setManualEvidence(event.target.value)}
                placeholder="https://..."
              />
            </label>
            <div className="flex items-end">
              <button
                className="w-full rounded-lg bg-green-600 px-4 py-2 text-white disabled:opacity-50"
                disabled={submitting || !manualTaskId || !manualStudentId}
              >
                {submitting ? "提交中..." : "确认补录"}
              </button>
            </div>
          </form>
        </section>
        <div className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
          {tasks.map((task) => (
            <div key={task.id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  {/* data-testid keeps the task card addressable even though the
                      manual check-in <select> repeats the same title text. */}
                  <div className="font-semibold" data-testid="checkin-task-title">{task.title}</div>
                  <div className="text-sm text-slate-500">完成 {task.stats?.completedCount ?? 0}/{task.stats?.totalStudents ?? 0} · 待审 {task.stats?.pendingCount ?? 0} · 漏卡 {task.stats?.missedCount ?? 0} · {Math.round((task.stats?.completionRate ?? 0) * 100)}%</div>
                </div>
                <span className="font-semibold text-green-600">+{task.rewardPoints}</span>
              </div>
            </div>
          ))}
        </div>
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">待审批</h2>
          <div className="mt-4 space-y-3">
            {records.map((record) => (
              <div key={record.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{record.studentName}</div>
                    <div className="text-sm text-slate-500">{record.taskTitle}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-lg border px-3 py-1" onClick={() => handleReject(record.id)}>驳回</button>
                    <button className="rounded-lg bg-green-600 px-3 py-1 text-white" onClick={() => handleApprove(record.id)}>通过</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
