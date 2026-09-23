"use client"

import { useCallback, useEffect, useState } from "react"
import { AppShell } from "@/components/layout/AppShell"
import { apiRequest } from "@/lib/api-client"

interface TaskRecord {
  id: string
  status: string
  evidenceUrl: string | null
  submittedAt: string | null
}

interface StudentTask {
  id: string
  title: string
  description: string | null
  rewardPoints: number
  requireEvidence: boolean
  deadlineAt: string | null
  overdue: boolean
  record: TaskRecord | null
}

interface CheckinPayload {
  student: { id: string; name: string; totalPoints: number }
  tasks: StudentTask[]
  records: Array<{
    id: string
    taskTitle: string
    status: string
    rewardPoints: number
    submittedAt: string | null
  }>
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "待老师审批",
  COMPLETED: "已完成",
  APPROVED: "已通过",
  REJECTED: "已驳回",
  MISSED: "未打卡",
}

export default function StudentCheckinsPage() {
  const [data, setData] = useState<CheckinPayload | null>(null)
  const [evidence, setEvidence] = useState<Record<string, string>>({})
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await apiRequest<CheckinPayload>("/api/v1/student/checkins"))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载打卡任务失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function submit(task: StudentTask) {
    if (task.requireEvidence && !evidence[task.id]?.trim()) {
      setError("该任务需要提交证据链接")
      return
    }
    setSubmittingId(task.id)
    setError(null)
    setNotice(null)
    try {
      await apiRequest("/api/v1/student/checkins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: task.id, evidenceUrl: evidence[task.id]?.trim() || null }),
      })
      setNotice(`"${task.title}" 打卡已提交`)
      setEvidence((current) => ({ ...current, [task.id]: "" }))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "打卡失败，请重试")
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">我的打卡</h1>
            <p className="text-slate-600">提交打卡任务并查看审批状态。</p>
          </div>
          {data ? <div className="text-slate-600">当前积分：{data.student.totalPoints}</div> : null}
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
        {notice ? <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-700">{notice}</div> : null}
        {loading ? <div className="rounded-lg bg-white p-5 shadow-sm">加载中...</div> : null}

        <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">进行中的任务</h2>
          {!loading && (data?.tasks.length ?? 0) === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-slate-500">当前没有可打卡的任务</div>
          ) : null}
          {data?.tasks.map((task) => {
            const submitted = task.record !== null
            return (
              <div key={task.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold">{task.title}</div>
                    {task.description ? <div className="text-sm text-slate-500">{task.description}</div> : null}
                    <div className="mt-1 text-sm text-slate-500">
                      奖励 +{task.rewardPoints} 分
                      {task.requireEvidence ? " · 需要证据" : ""}
                      {task.deadlineAt ? ` · 截止 ${String(task.deadlineAt).slice(0, 10)}` : ""}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-lg px-3 py-1 text-sm ${submitted ? "bg-slate-100 text-slate-600" : "bg-green-50 text-green-700"}`}>
                    {submitted ? STATUS_LABELS[task.record?.status ?? ""] ?? task.record?.status : "可打卡"}
                  </span>
                </div>

                {!submitted ? (
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <label className="flex-1">
                      <span className="text-sm text-slate-600">证据链接{task.requireEvidence ? "" : "（可选）"}</span>
                      <input
                        type="url"
                        value={evidence[task.id] ?? ""}
                        onChange={(event) => setEvidence((current) => ({ ...current, [task.id]: event.target.value }))}
                        placeholder="https://..."
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                      />
                    </label>
                    <button
                      className="rounded-lg bg-green-600 px-4 py-2 text-white disabled:opacity-50"
                      disabled={submittingId === task.id || task.overdue}
                      onClick={() => submit(task)}
                    >
                      {submittingId === task.id ? "提交中..." : "打卡"}
                    </button>
                  </div>
                ) : null}
                {!submitted && task.overdue ? <div className="mt-2 text-sm text-amber-700">任务已过截止时间，无法打卡</div> : null}
              </div>
            )
          })}
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">打卡记录</h2>
          {(data?.records.length ?? 0) === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed p-4 text-slate-500">暂无打卡记录</div>
          ) : (
            <div className="mt-3 space-y-2">
              {data?.records.map((record) => (
                <div key={record.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <div className="font-medium">{record.taskTitle}</div>
                    <div className="text-sm text-slate-500">{record.submittedAt ? String(record.submittedAt).slice(0, 10) : "-"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-600">{STATUS_LABELS[record.status] ?? record.status}</div>
                    <div className="text-sm text-green-600">+{record.rewardPoints}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}
